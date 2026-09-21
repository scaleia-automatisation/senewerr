import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Marque une ou plusieurs demandes de remboursement comme effectivement versées.
// Supporte un seul item OU un tableau (batch).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return errorResponse('INVALID_BODY', 'Corps JSON requis', 400)

  // Support single item OR array
  const items: Array<{
    demandeId: string
    modePaiement: string
    reference?: string
    dateEffective?: string
    note?: string
  }> = Array.isArray(body) ? body : [body]

  if (items.length === 0) return errorResponse('INVALID_BODY', 'Aucun item fourni', 400)
  if (items.length > 50) return errorResponse('INVALID_BODY', 'Maximum 50 items par batch', 400)

  for (const item of items) {
    if (!item.demandeId || !item.modePaiement) {
      return errorResponse('INVALID_BODY', 'demandeId et modePaiement requis pour chaque item', 400)
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupérer mutuelle_id du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: mutuelle } = await admin.from('mutuelles').select('nom, paiement_config').eq('id', mutuelleId).single()

  const results: Array<{ demandeId: string; success: boolean; error?: string }> = []

  for (const item of items) {
    try {
      // Vérifier que la demande appartient à cette mutuelle et est en état approuvé
      const { data: demande } = await admin
        .from('remboursement_demandes')
        .select('id, statut, adherent_id, montant_approuve, montant_demande, numero_demande')
        .eq('id', item.demandeId)
        .eq('mutuelle_id', mutuelleId)
        .single()

      if (!demande) { results.push({ demandeId: item.demandeId, success: false, error: 'Demande introuvable' }); continue }
      if (demande.statut !== 'approuve') { results.push({ demandeId: item.demandeId, success: false, error: 'Demande non approuvée' }); continue }

      const montant = demande.montant_approuve ?? demande.montant_demande ?? 0
      const dateEffective = item.dateEffective ?? new Date().toISOString().split('T')[0]

      // Mettre à jour la demande
      await admin.from('remboursement_demandes').update({
        statut: 'rembourse',
        date_remboursement: dateEffective,
        mode_remboursement: item.modePaiement,
        reference_remboursement: item.reference?.trim() ?? null,
        traite_par: auth.profileId,
      }).eq('id', item.demandeId)

      // Enregistrer dans paiements_remboursements si la colonne date_remboursement n'existe pas
      await admin.from('paiements_remboursements').update({
        statut_paiement: 'effectue',
        date_paiement_effectif: dateEffective,
        mode_paiement_effectif: item.modePaiement,
        reference_paiement: item.reference?.trim() ?? null,
        note: item.note?.trim() ?? null,
      }).eq('demande_id', item.demandeId)

      // Notifier l'adhérent (in-app + push via deliveries)
      const montantStr = new Intl.NumberFormat('fr-SN').format(montant)
      const ref = item.reference?.trim() ?? demande.numero_demande ?? item.demandeId.slice(0, 8)

      await admin.from('notifications').insert({
        profile_id: demande.adherent_id,
        type: 'remboursement_effectue',
        titre: 'Remboursement effectué',
        message: `Votre remboursement de ${montantStr} FCFA a été effectué. Référence : ${ref}.`,
        urgence: 'info',
        mutuelle_id: mutuelleId,
        data: {
          montant,
          mode: item.modePaiement,
          reference: ref,
          mutuelleNom: mutuelle?.nom ?? '',
        },
      })

      results.push({ demandeId: item.demandeId, success: true })
    } catch (e: any) {
      results.push({ demandeId: item.demandeId, success: false, error: e?.message ?? 'Erreur inconnue' })
    }
  }

  const nbSuccess = results.filter(r => r.success).length
  const nbError = results.filter(r => !r.success).length

  return successResponse({ results, nbSuccess, nbError })
})
