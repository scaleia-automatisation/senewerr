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

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { appointment_id, motif_refus } = body ?? {}
  if (!appointment_id) return errorResponse('INVALID_BODY', 'appointment_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: appt } = await admin
    .from('appointments')
    .select('id, professional_id, patient_id, starts_at, status')
    .eq('id', appointment_id)
    .single()

  if (!appt) return errorResponse('NOT_FOUND', 'RDV introuvable', 404)
  if (appt.professional_id !== auth.profileId) return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  await admin.from('appointments')
    .update({ status: 'cancelled_professional', notes_pro: motif_refus ?? null })
    .eq('id', appointment_id)

  const dateFormatted = new Date(appt.starts_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeFormatted = new Date(appt.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const motifMsg = motif_refus ? ` Motif : ${motif_refus}.` : ''

  await admin.from('notifications').insert({
    user_id: appt.patient_id,
    type: 'rdv_refuse',
    titre: 'Demande de RDV non acceptée',
    corps: `Votre demande de RDV du ${dateFormatted} à ${timeFormatted} n'a pas pu être acceptée.${motifMsg}`,
    data: { appointment_id },
  }).catch(() => {})

  return successResponse({ ok: true })
})
