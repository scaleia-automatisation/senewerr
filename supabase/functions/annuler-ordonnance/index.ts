import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body: { ordonnance_id, motif? }
// Only the prescribing praticien can annuler

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { ordonnance_id, motif } = body ?? {}

  if (!ordonnance_id) return errorResponse('INVALID_BODY', 'ordonnance_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch and verify ownership
  const { data: ord } = await admin.from('ordonnances')
    .select('id, praticien_id, patient_id, statut, qr_invalidated_at')
    .eq('id', ordonnance_id)
    .maybeSingle()

  if (!ord) return errorResponse('NOT_FOUND', 'Ordonnance introuvable', 404)
  if (ord.praticien_id !== auth.profileId) return errorResponse('FORBIDDEN', 'Non autorisé', 403)
  if (ord.statut === 'annulee') return errorResponse('ALREADY_CANCELLED', 'Déjà annulée', 409)
  if (ord.qr_invalidated_at) return errorResponse('ALREADY_CANCELLED', 'QR déjà invalidé', 409)

  const now = new Date().toISOString()

  // Invalidate QR + set statut
  await admin.from('ordonnances').update({
    statut:              'annulee',
    qr_invalidated_at:   now,
    updated_at:          now,
  }).eq('id', ordonnance_id)

  // Notify patient
  const { data: patient } = await admin.from('profiles')
    .select('id').eq('id', ord.patient_id).single()

  if (patient) {
    const { data: praticien } = await admin.from('profiles')
      .select('full_name').eq('id', auth.profileId).single()
    const drNom = praticien?.full_name ? `Dr. ${praticien.full_name}` : 'Votre médecin'

    await admin.from('notifications').insert({
      user_id: ord.patient_id,
      type:    'ordonnance_annulee',
      titre:   'Ordonnance annulée',
      corps:   `Une ordonnance prescrite par ${drNom} a été annulée.${motif ? ` Motif : ${motif}` : ''}`,
      data:    { ordonnance_id },
    }).catch(() => {})
  }

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  ord.patient_id,
    action:     'ordonnance_cancelled',
    table_name: 'ordonnances',
    metadata:   { ordonnance_id, motif: motif ?? null },
  }).catch(() => {})

  return successResponse({ ok: true })
})
