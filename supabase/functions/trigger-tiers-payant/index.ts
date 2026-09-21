import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body:
// { adhesion_id, patient_id, mutuelle_id,
//   type_acte: 'consultation'|'acte_technique'|'urgence',
//   montant_total: number,
//   montant_tp: number,
//   montant_patient: number,
//   consultation_id?: string }
//
// Retourne: { tiers_payant_id, numero_tp, statut: 'pending' }

function generateNumeroTP(): string {
  const now = new Date()
  const y   = now.getFullYear().toString().slice(2)
  const m   = String(now.getMonth() + 1).padStart(2, '0')
  const d   = String(now.getDate()).padStart(2, '0')
  const rnd = Math.floor(1000 + Math.random() * 9000)
  return `TP-${y}${m}${d}-${rnd}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const {
    adhesion_id, patient_id, mutuelle_id,
    type_acte, montant_total, montant_tp, montant_patient,
    consultation_id,
  } = body ?? {}

  if (!adhesion_id || !patient_id || !mutuelle_id || !type_acte
      || montant_total == null || montant_tp == null || montant_patient == null) {
    return errorResponse('INVALID_BODY', 'Champs obligatoires manquants', 400)
  }

  // Validate amounts server-side (never trust client amounts alone)
  if (montant_tp + montant_patient !== montant_total) {
    return errorResponse('INVALID_AMOUNTS', 'Montants incohérents : TP + patient ≠ total', 400)
  }
  if (montant_tp < 0 || montant_patient < 0 || montant_total <= 0) {
    return errorResponse('INVALID_AMOUNTS', 'Montants invalides', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Re-verify eligibility server-side (defense in depth)
  const { data: adhesion } = await admin.from('adhesions_mutuelles')
    .select('id, patient_id, statut, date_expiration, plafond_restant_consultation')
    .eq('id', adhesion_id)
    .eq('patient_id', patient_id)
    .maybeSingle()

  if (!adhesion) return errorResponse('NOT_FOUND', 'Adhésion mutuelle introuvable', 404)

  if (adhesion.statut !== 'valide') {
    return errorResponse('INELIGIBLE', `Patient inéligible : couverture ${adhesion.statut}`, 422)
  }
  if (adhesion.date_expiration && new Date(adhesion.date_expiration) < new Date()) {
    return errorResponse('INELIGIBLE', 'Couverture expirée', 422)
  }

  // Verify convention praticien-mutuelle
  const { data: conv } = await admin.from('conventions_praticien_mutuelle')
    .select('id, taux_prise_en_charge, statut, date_fin')
    .eq('praticien_id', auth.profileId)
    .eq('mutuelle_id', mutuelle_id)
    .maybeSingle()

  if (!conv || conv.statut !== 'active') {
    return errorResponse('NO_CONVENTION', 'Pas de convention active avec cette mutuelle', 403)
  }
  if (conv.date_fin && new Date(conv.date_fin) < new Date()) {
    return errorResponse('NO_CONVENTION', 'Convention expirée', 403)
  }

  // Verify care relationship
  const { data: rel } = await admin.from('praticien_patients')
    .select('id')
    .eq('praticien_id', auth.profileId)
    .eq('patient_id', patient_id)
    .eq('actif', true)
    .maybeSingle()

  if (!rel) return errorResponse('FORBIDDEN', 'Pas de relation de soin active', 403)

  const numeroTp = generateNumeroTP()

  // Create tiers_payant record
  const { data: tp, error: tpErr } = await admin.from('tiers_payants').insert({
    numero_tp:       numeroTp,
    praticien_id:    auth.profileId,
    patient_id,
    mutuelle_id,
    adhesion_id,
    consultation_id: consultation_id ?? null,
    type_acte,
    montant_total,
    montant_tp,
    montant_patient,
    statut:          'pending',
    created_at:      new Date().toISOString(),
  }).select('id').single()

  if (tpErr || !tp) {
    console.error('tiers_payant insert error:', tpErr)
    return errorResponse('DB_ERROR', 'Erreur création tiers payant', 500)
  }

  // Notify patient
  const { data: praticien } = await admin.from('profiles')
    .select('full_name').eq('id', auth.profileId).single()
  const drNom = praticien?.full_name ? `Dr. ${praticien.full_name}` : 'Votre médecin'

  await admin.from('notifications').insert({
    user_id: patient_id,
    type:    'tiers_payant_soumis',
    titre:   'Prise en charge mutuelle demandée',
    corps:   `Votre mutuelle a reçu une demande de prise en charge de ${drNom}. Réf : ${numeroTp}`,
    data:    { tiers_payant_id: tp.id, numero_tp: numeroTp },
  }).catch(() => {})

  // Broadcast to mutuelle channel (Realtime)
  await admin.channel(`mutuelle-${mutuelle_id}`).send({
    type:    'broadcast',
    event:   'new_tp_request',
    payload: { tiers_payant_id: tp.id, numero_tp: numeroTp, montant_tp, type_acte },
  }).catch(() => {})

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  patient_id,
    action:     'tiers_payant_triggered',
    table_name: 'tiers_payants',
    metadata:   {
      tiers_payant_id: tp.id,
      numero_tp:       numeroTp,
      mutuelle_id,
      montant_total,
      montant_tp,
    },
  }).catch(() => {})

  return successResponse({
    tiers_payant_id: tp.id,
    numero_tp:       numeroTp,
    statut:          'pending',
  })
})
