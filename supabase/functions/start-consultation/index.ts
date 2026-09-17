import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)

    // Professional role only
    if (auth.role !== 'professional') {
      return errorResponse('FORBIDDEN', 'Seuls les professionnels peuvent démarrer une consultation', 403)
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) {
      return errorResponse('MISSING_FIELDS', 'appointmentId est requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch professional record for this profile
    const { data: professional, error: proErr } = await supabase
      .from('professionals')
      .select('id, profile_id')
      .eq('profile_id', auth.profileId)
      .single()

    if (proErr || !professional) {
      return errorResponse('PROFESSIONAL_NOT_FOUND', 'Profil professionnel introuvable', 404)
    }

    // Fetch appointment
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, professional_id, establishment_id,
        starts_at, ends_at, reason, status,
        patients!inner(profile_id)
      `)
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appointment) {
      return errorResponse('APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable', 404)
    }

    // Verify this professional owns the appointment
    if (appointment.professional_id !== professional.id) {
      return errorResponse('FORBIDDEN', 'Ce rendez-vous ne vous appartient pas', 403)
    }

    // Check valid statuses
    const validStatuses = ['confirmed', 'paid', 'patient_arrived']
    if (!validStatuses.includes(appointment.status)) {
      return errorResponse(
        'INVALID_STATUS',
        `Le statut '${appointment.status}' ne permet pas de démarrer la consultation`,
        409
      )
    }

    const now = new Date().toISOString()

    // Update appointment status
    const { error: apptUpdateErr } = await supabase
      .from('appointments')
      .update({ status: 'in_consultation' })
      .eq('id', appointmentId)

    if (apptUpdateErr) {
      return errorResponse('UPDATE_FAILED', 'Erreur lors du démarrage de la consultation', 500, apptUpdateErr.message)
    }

    // Create consultation record
    const { data: consultation, error: consultErr } = await supabase
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        professional_id: professional.id,
        establishment_id: appointment.establishment_id,
        reason: appointment.reason,
        status: 'in_progress',
        started_at: now,
      })
      .select('id')
      .single()

    if (consultErr || !consultation) {
      // Rollback appointment status
      await supabase.from('appointments').update({ status: appointment.status }).eq('id', appointmentId)
      return errorResponse('CONSULTATION_CREATE_FAILED', 'Erreur lors de la création de la consultation', 500, consultErr?.message)
    }

    // Status history
    await supabase.from('appointment_status_history').insert({
      appointment_id: appointmentId,
      status: 'in_consultation',
      changed_by: auth.profileId,
    })

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'CONSULTATION_STARTED',
      entity_type: 'consultation',
      entity_id: consultation.id,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: appointment.patient_id,
      payload: { consultationId: consultation.id, appointmentId, startedAt: now },
    })

    // Notify patient
    const patientProfile = appointment.patients as { profile_id: string }
    await supabase.from('notifications').insert({
      user_id: patientProfile.profile_id,
      type: 'consultation_started',
      title: 'Consultation démarrée',
      body: 'Votre consultation a commencé',
      data: { consultationId: consultation.id, appointmentId },
    })

    return successResponse({ consultationId: consultation.id })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
