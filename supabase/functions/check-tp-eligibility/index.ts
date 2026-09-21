import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Appelée par le pharmacien/praticien pour vérifier éligibilité avant de créer un TP
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  const body = await req.json().catch(() => null)
  const { contratId, montant } = body ?? {}
  if (!contratId) return errorResponse('INVALID_BODY', 'contratId requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: contrat } = await admin
    .from('contrats')
    .select('id, adherent_id, statut, mutuelle_id, plans_mutuelle!contrats_plan_id_fkey(nom)')
    .eq('id', contratId)
    .single()

  if (!contrat) return errorResponse('NOT_FOUND', 'Contrat introuvable', 404)

  // Règle 1 : adhérent SUSPENDU → TP impossible
  if (contrat.statut === 'SUSPENDU') {
    return successResponse({
      eligible: false,
      raison: 'SUSPENDU',
      message: 'La couverture de cet adhérent est suspendue. Tiers payant impossible.',
    })
  }

  // Récupérer les règles TP de la mutuelle
  const { data: mutuelle } = await admin
    .from('mutuelles')
    .select('nom, tp_rules')
    .eq('id', contrat.mutuelle_id)
    .single()

  const tpRules = (mutuelle as any)?.tp_rules ?? {}

  // Règle 2 : cotisation en retard > 30j si la règle est activée
  let joursRetardCotisation = 0
  if (tpRules.bloquer_si_retard !== false) {
    const now = new Date()
    const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const { data: cot } = await admin
      .from('cotisations')
      .select('statut, mois')
      .eq('contrat_id', contratId)
      .lt('mois', moisCourant)
      .neq('statut', 'paye')
      .order('mois', { ascending: true })
      .limit(1)
      .single()

    if (cot) {
      const [y, m] = cot.mois.split('-').map(Number)
      const echeance = new Date(y, m - 1, 5)
      joursRetardCotisation = Math.max(0, Math.floor((now.getTime() - echeance.getTime()) / 86400000))

      const seuilJours = tpRules.seuil_retard_jours ?? 30
      if (joursRetardCotisation > seuilJours) {
        return successResponse({
          eligible: false,
          raison: 'COTISATION_RETARD',
          message: `Cotisation en retard de ${joursRetardCotisation} jours. Tiers payant bloqué selon les règles de ${mutuelle?.nom ?? 'la mutuelle'}.`,
          joursRetard: joursRetardCotisation,
        })
      }
    }
  }

  // Règle 3 : montant > seuil → confirmation manuelle requise
  const seuilMontant = tpRules.seuil_confirmation_montant ?? 50000
  const confirmationRequise = tpRules.confirmation_gros_montant !== false
    && montant != null && Number(montant) > seuilMontant

  return successResponse({
    eligible: true,
    confirmationRequise,
    seuilMontant: confirmationRequise ? seuilMontant : null,
    joursRetardCotisation,
    mutuelleNom: mutuelle?.nom ?? '—',
    planNom: (contrat as any).plans_mutuelle?.nom ?? '—',
    contratStatut: contrat.statut,
  })
})
