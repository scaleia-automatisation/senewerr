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
    contratId,
    mois,           // string 'YYYY-MM' ou array de strings
    montant,
    moyenPaiement,  // 'wave' | 'orange_money' | 'especes' | 'virement' | 'stripe'
    referenceTransaction,
    datePaiement,
  } = body ?? {}

  if (!contratId) return errorResponse('INVALID_BODY', 'contratId requis', 400)
  if (!mois) return errorResponse('INVALID_BODY', 'mois requis', 400)
  if (montant == null || Number(montant) <= 0) return errorResponse('INVALID_BODY', 'montant > 0 requis', 400)
  if (!moyenPaiement) return errorResponse('INVALID_BODY', 'moyenPaiement requis', 400)
  if (['wave', 'orange_money'].includes(moyenPaiement) && !referenceTransaction?.trim()) {
    return errorResponse('INVALID_BODY', 'referenceTransaction obligatoire pour Wave/Orange Money', 400)
  }

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

  // Vérifier ownership du contrat
  const { data: contrat } = await admin
    .from('contrats')
    .select('id, adherent_id, numero_contrat')
    .eq('id', contratId)
    .eq('mutuelle_id', mutuelleId)
    .single()
  if (!contrat) return errorResponse('NOT_FOUND', 'Contrat introuvable', 404)

  const moisList: string[] = Array.isArray(mois) ? mois : [mois]
  const inserted: string[] = []

  for (const m of moisList) {
    // Upsert : une cotisation par contrat par mois
    const { data: existing } = await admin
      .from('cotisations')
      .select('id')
      .eq('contrat_id', contratId)
      .eq('mois', m)
      .single()

    if (existing) {
      await admin.from('cotisations').update({
        montant: Number(montant),
        date_paiement: datePaiement ?? new Date().toISOString().split('T')[0],
        moyen_paiement: moyenPaiement,
        reference_transaction: referenceTransaction ?? null,
        statut: 'paye',
        enregistre_par: auth.profileId,
      }).eq('id', existing.id)
      inserted.push(existing.id)
    } else {
      const { data: newCot } = await admin.from('cotisations').insert({
        contrat_id: contratId,
        mutuelle_id: mutuelleId,
        adherent_id: contrat.adherent_id,
        mois: m,
        montant: Number(montant),
        date_paiement: datePaiement ?? new Date().toISOString().split('T')[0],
        moyen_paiement: moyenPaiement,
        reference_transaction: referenceTransaction ?? null,
        statut: 'paye',
        enregistre_par: auth.profileId,
      }).select('id').single()
      if (newCot?.id) inserted.push(newCot.id)
    }
  }

  // Formater le(s) mois pour la notification
  const moisLabels = moisList.map(m => {
    const [y, mo] = m.split('-')
    const d = new Date(Number(y), Number(mo) - 1, 1)
    return d.toLocaleDateString('fr-SN', { month: 'long', year: 'numeric' })
  }).join(', ')

  await admin.from('notifications').insert({
    profile_id: contrat.adherent_id,
    type: 'cotisation_enregistree',
    titre: 'Cotisation enregistrée',
    message: `Votre cotisation de ${moisLabels} a été enregistrée. Merci !`,
    urgence: 'info',
    mutuelle_id: mutuelleId,
  })

  return successResponse({
    inserted,
    count: inserted.length,
    contratId,
    mois: moisList,
  })
})
