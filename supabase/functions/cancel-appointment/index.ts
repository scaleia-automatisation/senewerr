import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const { appointmentId, reason } = await req.json()

    if (!appointmentId || !reason) {
      return errorResponse('MISSING_FIELDS', 'appointmentId et reason sont requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch appointment with establishment data
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, professional_id, establishment_id, slot_id,
        starts_at, ends_at, status,
        establishments!inner(cancellation_min_hours),
        patients!inner(profile_id),
        professionals!inner(profile_id)
      `)
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appointment) {
      return errorResponse('APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable', 404)
    }

    if (['cancelled_patient', 'cancelled_professional', 'cancelled_establishment', 'completed', 'no_show'].includes(appointment.status)) {
      return errorResponse('ALREADY_CANCELLED', 'Ce rendez-vous ne peut plus être annulé', 409)
    }

    // Determine caller's relationship to appointment
    const estab = appointment.establishments as { cancellation_min_hours: number }
    const patient = appointment.patients as { profile_id: string }
    const professional = appointment.professionals as { profile_id: string }

    const isPatient = patient.profile_id === auth.profileId
    const isProfessional = professional.profile_id === auth.profileId
    const isEstablishmentAdmin = auth.role === 'establishment_admin' && auth.orgIds?.length > 0

    if (!isPatient && !isProfessional && !isEstablishmentAdmin) {
      return errorResponse('FORBIDDEN', 'Accès non autorisé', 403)
    }

    // Enforce cancellation window for patients
    if (isPatient) {
      const minHours = estab.cancellation_min_hours ?? 2
      const startsAt = new Date(appointment.starts_at)
      const diffHours = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60)
      if (diffHours < minHours) {
        return errorResponse(
          'CANCEL_TOO_LATE',
          `L'annulation doit être effectuée au moins ${minHours}h avant le rendez-vous`,
          409
        )
      }
    }

    // Determine cancel status
    let cancelStatus: string
    if (isPatient) cancelStatus = 'cancelled_patient'
    else if (isProfessional) cancelStatus = 'cancelled_professional'
    else cancelStatus = 'cancelled_establishment'

    const now = new Date().toISOString()

    // Update appointment
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: cancelStatus,
        cancelled_at: now,
        cancellation_reason: reason,
        cancelled_by: auth.profileId,
      })
      .eq('id', appointmentId)

    if (updateErr) {
      return errorResponse('UPDATE_FAILED', 'Erreur lors de l\'annulation', 500, updateErr.message)
    }

    // Release slot
    if (appointment.slot_id) {
      await supabase
        .from('appointment_slots')
        .update({ status: 'available', appointment_id: null })
        .eq('id', appointment.slot_id)
    }

    // Status history
    await supabase.from('appointment_status_history').insert({
      appointment_id: appointmentId,
      status: cancelStatus,
      changed_by: auth.profileId,
    })

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'APPOINTMENT_CANCELLED',
      entity_type: 'appointment',
      entity_id: appointmentId,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: appointment.patient_id,
      payload: { cancelStatus, reason, cancelledBy: auth.profileId },
    })

    // Notify other party
    const notifications = []
    if (isPatient) {
      notifications.push({
        user_id: professional.profile_id,
        type: 'appointment_cancelled',
        title: 'Rendez-vous annulé',
        body: `Un patient a annulé son rendez-vous du ${new Date(appointment.starts_at).toLocaleString('fr-FR')}`,
        data: { appointmentId },
      })
    } else {
      notifications.push({
        user_id: patient.profile_id,
        type: 'appointment_cancelled',
        title: 'Rendez-vous annulé',
        body: `Votre rendez-vous du ${new Date(appointment.starts_at).toLocaleString('fr-FR')} a été annulé`,
        data: { appointmentId },
      })
    }
    if (notifications.length > 0) await supabase.from('notifications').insert(notifications)

    return successResponse({ message: 'Rendez-vous annulé' })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
