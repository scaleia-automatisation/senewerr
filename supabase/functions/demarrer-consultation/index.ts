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

  // Vérifier que le RDV appartient bien à ce praticien
  const { data: appt } = await admin
    .from('appointments')
    .select('id, professional_id, patient_id, status')
    .eq('id', appointment_id)
    .single()

  if (!appt) return errorResponse('NOT_FOUND', 'Rendez-vous introuvable', 404)
  if (appt.professional_id !== auth.profileId) return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  if (!['confirmed', 'patient_arrived', 'pending'].includes(appt.status)) {
    return errorResponse('INVALID_STATUS', 'Ce rendez-vous ne peut pas être démarré', 409)
  }

  // Obtenir le nom du praticien
  const { data: prof } = await admin.from('profiles').select('full_name').eq('id', auth.profileId).single()
  const drNom = prof?.full_name ? `Dr. ${prof.full_name}` : 'Votre médecin'

  // Obtenir le user_id du patient pour la notification
  const { data: patient } = await admin
    .from('patients')
    .select('profile_id')
    .eq('id', appt.patient_id)
    .maybeSingle()

  const patientProfileId = patient?.profile_id ?? appt.patient_id

  // Mettre à jour le statut
  const { error } = await admin
    .from('appointments')
    .update({ status: 'in_consultation', started_at: new Date().toISOString() })
    .eq('id', appointment_id)

  if (error) return errorResponse('DB_ERROR', 'Erreur mise à jour', 500)

  // Notifier le patient (push)
  await admin.from('notifications').insert({
    user_id: patientProfileId,
    type: 'consultation_demarree',
    titre: 'Consultation démarrée',
    corps: `${drNom} est prêt à vous recevoir.`,
    data: { appointment_id },
  }).catch(() => {})

  return successResponse({ ok: true, started_at: new Date().toISOString() })
})
