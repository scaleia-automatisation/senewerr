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

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const {
    prestataire_type, // 'pharmacie' | 'praticien'
    prestataire_id,
    montant,
    moyen_paiement,   // 'wave' | 'virement' | 'especes'
    reference,
    date_reglement,
    note,
  } = body ?? {}

  if (!prestataire_type || !prestataire_id || montant == null || !moyen_paiement) {
    return errorResponse('INVALID_BODY', 'prestataire_type, prestataire_id, montant, moyen_paiement requis', 400)
  }
  if (Number(montant) <= 0) return errorResponse('INVALID_BODY', 'montant doit être > 0', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: mutuelle } = await admin.from('mutuelles').select('nom').eq('id', mutuelleId).single()

  // Enregistrer le règlement
  const { data: reglement, error } = await admin.from('tp_reglements').insert({
    mutuelle_id: mutuelleId,
    prestataire_type,
    prestataire_id,
    montant: Number(montant),
    moyen_paiement,
    reference: reference?.trim() ?? null,
    date_reglement: date_reglement ?? new Date().toISOString().split('T')[0],
    note: note?.trim() ?? null,
    enregistre_par: auth.profileId,
  }).select('id').single()

  if (error) return errorResponse('DB_ERROR', error.message, 500)

  // Marquer les demandes TP approuvées de ce prestataire comme "réglées"
  await admin.from('tiers_payant_demandes').update({ statut: 'regle' })
    .eq('mutuelle_id', mutuelleId)
    .eq(`${prestataire_type}_id`, prestataire_id)
    .eq('statut', 'approved')

  // Notifier le prestataire
  const targetTable = prestataire_type === 'pharmacie' ? 'pharmacies' : 'praticiens'
  const { data: target } = await admin.from(targetTable).select('profile_id, nom').eq('id', prestataire_id).single()
  if (target?.profile_id) {
    const montantStr = new Intl.NumberFormat('fr-SN').format(Number(montant))
    await admin.from('notifications').insert({
      profile_id: target.profile_id,
      type: 'reglement_recu',
      titre: 'Règlement reçu',
      message: `Virement de ${montantStr} FCFA reçu de ${mutuelle?.nom ?? 'votre mutuelle'}. Référence : ${reference ?? reglement?.id}.`,
      urgence: 'info',
      mutuelle_id: mutuelleId,
    })
  }

  return successResponse({ reglementId: reglement?.id, montant: Number(montant), prestataire_id })
})
