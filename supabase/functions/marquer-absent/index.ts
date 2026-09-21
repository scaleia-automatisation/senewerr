import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { appointment_id } = body ?? {}
  if (!appointment_id) return errorResponse('INVALID_BODY', 'appointment_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier ownership
  const { data: appt } = await admin
    .from('appointments')
    .select('id, professional_id, patient_id, status, starts_at')
    .eq('id', appointment_id)
    .single()

  if (!appt) return errorResponse('NOT_FOUND', 'Rendez-vous introuvable', 404)
  if (appt.professional_id !== auth.profileId) return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  if (['completed', 'no_show', 'cancelled_patient', 'cancelled_professional'].includes(appt.status)) {
    return errorResponse('INVALID_STATUS', 'Ce rendez-vous ne peut pas être modifié', 409)
  }

  // Obtenir patient profile pour notification
  const { data: patient } = await admin
    .from('patients')
    .select('profile_id')
    .eq('id', appt.patient_id)
    .maybeSingle()

  const patientProfileId = patient?.profile_id ?? appt.patient_id

  // Marquer absent
  const { error } = await admin
    .from('appointments')
    .update({ status: 'no_show' })
    .eq('id', appointment_id)

  if (error) return errorResponse('DB_ERROR', 'Erreur mise à jour', 500)

  // Notifier le patient
  await admin.from('notifications').insert({
    user_id: patientProfileId,
    type: 'rdv_patient_absent',
    titre: 'Absence constatée',
    corps: 'Votre absence à votre rendez-vous a été enregistrée. Pensez à annuler à l\'avance la prochaine fois.',
    data: { appointment_id, starts_at: appt.starts_at },
  }).catch(() => {})

  return successResponse({ ok: true })
})
