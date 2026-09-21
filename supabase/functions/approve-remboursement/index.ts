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
  // Supporte un tableau (batch) ou un seul item
  const items: Array<{ demandeId: string; montantApprouve: number; commentaire?: string }> =
    Array.isArray(body) ? body : [body]

  if (!items.length || !items[0]?.demandeId) {
    return errorResponse('INVALID_BODY', 'demandeId et montantApprouve requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupérer mutuelle du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const approved: string[] = []
  const errors: string[] = []

  for (const item of items) {
    try {
      const { demandeId, montantApprouve, commentaire } = item
      if (!demandeId || montantApprouve == null) { errors.push(demandeId); continue }

      const { data: demande } = await admin
        .from('remboursement_demandes')
        .select('id, reference, adherent_id, contrat_id, categorie, statut')
        .eq('id', demandeId)
        .eq('mutuelle_id', mutuelleId)
        .single()

      if (!demande || !['en_attente', 'en_instruction'].includes(demande.statut)) {
        errors.push(demandeId); continue
      }

      // Mettre à jour la demande
      await admin.from('remboursement_demandes').update({
        statut: 'approuve',
        montant_approuve: montantApprouve,
        commentaire_gestionnaire: commentaire ?? null,
        traite_par: auth.profileId,
        traite_at: new Date().toISOString(),
      }).eq('id', demandeId)

      // Décrémente plafond utilisé sur le contrat selon catégorie
      if (demande.contrat_id) {
        const colMap: Record<string, string> = {
          consultations: 'plafond_consultation_utilise',
          medicaments: 'plafond_pharma_utilise',
          hospitalisations: 'plafond_hospit_utilise',
          analyses: 'plafond_analyses_utilise',
        }
        const col = colMap[demande.categorie ?? '']
        if (col) {
          const { data: contrat } = await admin.from('contrats').select(col).eq('id', demande.contrat_id).single()
          const actuel = (contrat as any)?.[col] ?? 0
          await admin.from('contrats').update({ [col]: actuel + montantApprouve }).eq('id', demande.contrat_id)
        }
      }

      // Insérer en file de paiements
      await admin.from('paiements_remboursements').insert({
        demande_id: demandeId,
        mutuelle_id: mutuelleId,
        adherent_id: demande.adherent_id,
        montant: montantApprouve,
        statut: 'en_attente_paiement',
      }).then(() => {})

      // Notifier patient
      const msg = `Votre demande ${demande.reference} a été approuvée pour ${new Intl.NumberFormat('fr-SN').format(montantApprouve)} FCFA. Remboursement sous 5 jours ouvrés.`
      await admin.from('notifications').insert({
        profile_id: demande.adherent_id,
        type: 'demande_approuvee',
        titre: 'Demande approuvée',
        message: msg,
        urgence: 'normal',
        mutuelle_id: mutuelleId,
      })

      approved.push(demandeId)
    } catch { errors.push(item.demandeId) }
  }

  return successResponse({ approved, errors, total: items.length })
})
