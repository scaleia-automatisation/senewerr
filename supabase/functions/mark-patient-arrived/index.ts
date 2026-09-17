import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const { appointmentId } = await req.json()

    if (!appointmentId) {
      return errorResponse('MISSING_FIELDS', 'appointmentId est requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch appointment with related profiles
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .select(`
        id, patient_id, professional_id, establishment_id,
        starts_at, ends_at, status,
        professionals!inner(profile_id)
      `)
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appointment) {
      return errorResponse('APPOINTMENT_NOT_FOUND', 'Rendez-vous introuvable', 404)
    }

    // Check status
    if (!['confirmed', 'paid'].includes(appointment.status)) {
      return errorResponse(
        'INVALID_STATUS',
        `Le statut '${appointment.status}' ne permet pas de marquer l'arrivée du patient`,
        409
      )
    }

    // Check authorization: must be reception/establishment staff, professional, or the patient themselves
    // For simplicity: any authenticated user with access to this appointment (professional or patient)
    const professional = appointment.professionals as { profile_id: string }
    const { data: patientRecord } = await supabase
      .from('patients')
      .select('profile_id')
      .eq('id', appointment.patient_id)
      .single()

    const isAllowed =
      auth.profileId === professional.profile_id ||
      auth.profileId === patientRecord?.profile_id ||
      ['establishment_admin', 'receptionist'].includes(auth.role)

    if (!isAllowed) {
      return errorResponse('FORBIDDEN', 'Accès non autorisé', 403)
    }

    // Check time window: starts_at - 60min <= now <= starts_at + 30min
    const startsAt = new Date(appointment.starts_at)
    const now = new Date()
    const windowStart = new Date(startsAt.getTime() - 60 * 60 * 1000)
    const windowEnd = new Date(startsAt.getTime() + 30 * 60 * 1000)

    if (now < windowStart || now > windowEnd) {
      return errorResponse(
        'OUTSIDE_WINDOW',
        'L\'arrivée du patient ne peut être enregistrée qu\'entre 60 min avant et 30 min après le rendez-vous',
        400
      )
    }

    const nowIso = now.toISOString()

    // Update appointment
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ status: 'patient_arrived', arrived_at: nowIso })
      .eq('id', appointmentId)

    if (updateErr) {
      return errorResponse('UPDATE_FAILED', 'Erreur lors de la mise à jour', 500, updateErr.message)
    }

    // Status history
    await supabase.from('appointment_status_history').insert({
      appointment_id: appointmentId,
      status: 'patient_arrived',
      changed_by: auth.profileId,
    })

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'PATIENT_ARRIVED',
      entity_type: 'appointment',
      entity_id: appointmentId,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: appointment.patient_id,
      payload: { appointmentId, arrivedAt: nowIso },
    })

    // Notify professional and establishment staff
    const notifications: Record<string, unknown>[] = [
      {
        user_id: professional.profile_id,
        type: 'patient_arrived',
        title: 'Patient arrivé',
        body: `Votre patient est arrivé pour le rendez-vous de ${startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        data: { appointmentId },
      },
    ]
    await supabase.from('notifications').insert(notifications)

    return successResponse({ message: 'Arrivée du patient enregistrée', appointmentId })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
