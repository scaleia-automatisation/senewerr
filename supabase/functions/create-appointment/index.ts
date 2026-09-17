import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const { slotId, professionalId, establishmentId, reason, appointmentType, beneficiaryId } =
      await req.json()

    if (!slotId || !professionalId || !establishmentId || !reason || !appointmentType) {
      return errorResponse('MISSING_FIELDS', 'Champs requis manquants', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch establishment cancellation policy
    const { data: establishment, error: estErr } = await supabase
      .from('establishments')
      .select('id, organization_id, cancellation_min_hours')
      .eq('id', establishmentId)
      .single()
    if (estErr || !establishment) return errorResponse('ESTABLISHMENT_NOT_FOUND', 'Établissement introuvable', 404)

    // Fetch professional to verify they are verified
    const { data: professional, error: proErr } = await supabase
      .from('professionals')
      .select('id, profile_id, verification_status')
      .eq('id', professionalId)
      .single()
    if (proErr || !professional) return errorResponse('PROFESSIONAL_NOT_FOUND', 'Professionnel introuvable', 404)
    if (professional.verification_status !== 'verified') {
      return errorResponse('PROFESSIONAL_NOT_VERIFIED', 'Le professionnel n\'est pas vérifié', 403)
    }

    // Fetch slot details first (need starts_at/ends_at before booking)
    const { data: slotData, error: slotReadErr } = await supabase
      .from('appointment_slots')
      .select('id, starts_at, ends_at, status')
      .eq('id', slotId)
      .single()
    if (slotReadErr || !slotData) return errorResponse('SLOT_NOT_FOUND', 'Créneau introuvable', 404)
    if (slotData.status !== 'available') return errorResponse('SLOT_ALREADY_BOOKED', 'Ce créneau n\'est plus disponible', 409)

    // Get patient_id from profile
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', auth.profileId)
      .single()
    if (patientErr || !patient) return errorResponse('PATIENT_NOT_FOUND', 'Profil patient introuvable', 404)

    // Check monthly appointment limit (20 per professional)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { count: usageCount } = await supabase
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', professionalId)
      .eq('feature', 'appointments')
      .gte('created_at', monthStart)
    if ((usageCount ?? 0) >= 20) {
      return errorResponse('PRO_MONTHLY_LIMIT', 'Le professionnel a atteint sa limite mensuelle de rendez-vous', 409)
    }

    // ATOMIC: book slot + create appointment via RPC or sequential ops with optimistic locking
    // Step 1: Try to book the slot atomically
    const { data: bookedSlot, error: bookErr } = await supabase
      .from('appointment_slots')
      .update({ status: 'booked' })
      .eq('id', slotId)
      .eq('status', 'available')
      .select('id')
      .single()
    if (bookErr || !bookedSlot) {
      return errorResponse('SLOT_ALREADY_BOOKED', 'Ce créneau vient d\'être réservé', 409)
    }

    // Step 2: Insert appointment
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        patient_id: patient.id,
        beneficiary_id: beneficiaryId ?? null,
        professional_id: professionalId,
        establishment_id: establishmentId,
        slot_id: slotId,
        starts_at: slotData.starts_at,
        ends_at: slotData.ends_at,
        appointment_type: appointmentType,
        reason,
        status: 'confirmed',
        payment_status: 'pending',
        created_by: auth.profileId,
        created_by_role: auth.role,
      })
      .select('id, appointment_number, starts_at')
      .single()

    if (apptErr || !appointment) {
      // Rollback slot
      await supabase.from('appointment_slots').update({ status: 'available', appointment_id: null }).eq('id', slotId)
      return errorResponse('APPOINTMENT_CREATE_FAILED', 'Erreur lors de la création du rendez-vous', 500, apptErr?.message)
    }

    // Link slot to appointment
    await supabase.from('appointment_slots').update({ appointment_id: appointment.id }).eq('id', slotId)

    // Step 3: Status history
    await supabase.from('appointment_status_history').insert({
      appointment_id: appointment.id,
      status: 'confirmed',
      changed_by: auth.profileId,
    })

    // Step 4: patient_professional_access
    const accessUntil = new Date(slotData.ends_at)
    accessUntil.setDate(accessUntil.getDate() + 30)
    await supabase.from('patient_professional_access').insert({
      patient_id: patient.id,
      professional_id: professionalId,
      appointment_id: appointment.id,
      granted_via: 'appointment',
      valid_until: accessUntil.toISOString(),
    })

    // Step 5: Domain event
    await supabase.from('domain_events').insert({
      event_type: 'APPOINTMENT_CREATED',
      entity_type: 'appointment',
      entity_id: appointment.id,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: patient.id,
      payload: { appointmentId: appointment.id, professionalId, establishmentId, startsAt: slotData.starts_at },
    })

    // Step 6: Usage event
    await supabase.from('usage_events').insert({
      professional_id: professionalId,
      feature: 'appointments',
      reference_id: appointment.id,
    })

    // Step 7: Notifications
    await supabase.from('notifications').insert([
      {
        user_id: professional.profile_id,
        type: 'appointment_created',
        title: 'Nouveau rendez-vous',
        body: `Un rendez-vous a été confirmé pour le ${new Date(slotData.starts_at).toLocaleString('fr-FR')}`,
        data: { appointmentId: appointment.id },
      },
    ])

    return successResponse({
      appointmentId: appointment.id,
      appointmentNumber: appointment.appointment_number,
      startsAt: appointment.starts_at,
    })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
