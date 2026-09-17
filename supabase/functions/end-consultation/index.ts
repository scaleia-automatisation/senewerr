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
      return errorResponse('FORBIDDEN', 'Seuls les professionnels peuvent terminer une consultation', 403)
    }

    const {
      consultationId,
      clinicalNotes,
      diagnosis,
      treatmentPlan,
      summary,
      shareWithPatient,
    } = await req.json()

    if (!consultationId) {
      return errorResponse('MISSING_FIELDS', 'consultationId est requis', 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch professional record
    const { data: professional, error: proErr } = await supabase
      .from('professionals')
      .select('id')
      .eq('profile_id', auth.profileId)
      .single()

    if (proErr || !professional) {
      return errorResponse('PROFESSIONAL_NOT_FOUND', 'Profil professionnel introuvable', 404)
    }

    // Fetch consultation
    const { data: consultation, error: consultErr } = await supabase
      .from('consultations')
      .select('id, appointment_id, patient_id, professional_id, status')
      .eq('id', consultationId)
      .single()

    if (consultErr || !consultation) {
      return errorResponse('CONSULTATION_NOT_FOUND', 'Consultation introuvable', 404)
    }

    // Verify ownership
    if (consultation.professional_id !== professional.id) {
      return errorResponse('FORBIDDEN', 'Cette consultation ne vous appartient pas', 403)
    }

    if (consultation.status !== 'in_progress') {
      return errorResponse(
        'INVALID_STATUS',
        `La consultation est déjà '${consultation.status}'`,
        409
      )
    }

    const now = new Date().toISOString()

    // Update consultation
    const { error: consultUpdateErr } = await supabase
      .from('consultations')
      .update({
        ended_at: now,
        status: 'completed',
        clinical_notes: clinicalNotes ?? null,
        diagnosis: diagnosis ?? null,
        treatment_plan: treatmentPlan ?? null,
        summary: summary ?? null,
        notes_shared_with_patient: shareWithPatient ?? false,
      })
      .eq('id', consultationId)

    if (consultUpdateErr) {
      return errorResponse('UPDATE_FAILED', 'Erreur lors de la mise à jour de la consultation', 500, consultUpdateErr.message)
    }

    // Update appointment
    const { error: apptUpdateErr } = await supabase
      .from('appointments')
      .update({ status: 'completed', ended_at: now })
      .eq('id', consultation.appointment_id)

    if (apptUpdateErr) {
      return errorResponse('UPDATE_FAILED', 'Erreur lors de la mise à jour du rendez-vous', 500, apptUpdateErr.message)
    }

    // Status history
    await supabase.from('appointment_status_history').insert({
      appointment_id: consultation.appointment_id,
      status: 'completed',
      changed_by: auth.profileId,
    })

    // Domain event
    await supabase.from('domain_events').insert({
      event_type: 'CONSULTATION_COMPLETED',
      entity_type: 'consultation',
      entity_id: consultationId,
      actor_id: auth.profileId,
      actor_role: auth.role,
      patient_id: consultation.patient_id,
      payload: {
        consultationId,
        appointmentId: consultation.appointment_id,
        endedAt: now,
        hasNotes: !!clinicalNotes,
        hasDiagnosis: !!diagnosis,
        sharedWithPatient: shareWithPatient ?? false,
      },
    })

    return successResponse({ message: 'Consultation terminée', consultationId })
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'Erreur interne', 500, err instanceof Error ? err.message : String(err))
  }
})
