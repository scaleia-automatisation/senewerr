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
  const { demandeId } = body ?? {}
  if (!demandeId) return errorResponse('INVALID_BODY', 'demandeId requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier mutuelle du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: demande } = await admin
    .from('remboursement_demandes')
    .select(`
      id, montant_demande, categorie, adherent_id, mutuelle_id,
      contrats!remboursement_demandes_contrat_id_fkey(
        id, plan_id, plafond_consultation_utilise, plafond_pharma_utilise,
        plafond_hospit_utilise, plafond_analyses_utilise,
        plans_mutuelle!contrats_plan_id_fkey(
          taux_consultation, taux_pharma, taux_hospit, taux_analyses,
          plafond_consultation, plafond_pharma, plafond_hospit, plafond_analyses, plafond_annuel
        )
      )
    `)
    .eq('id', demandeId)
    .eq('mutuelle_id', mutuelleId)
    .single()

  if (!demande) return errorResponse('NOT_FOUND', 'Demande introuvable', 404)

  const contrat = (demande as any).contrats
  const plan = contrat?.plans_mutuelle
  if (!plan) return errorResponse('NOT_FOUND', 'Plan introuvable', 404)

  const montant = demande.montant_demande ?? 0
  const categorie = demande.categorie ?? 'autres'

  // Taux selon catégorie
  const tauxMap: Record<string, number> = {
    consultations: plan.taux_consultation ?? 0,
    medicaments: plan.taux_pharma ?? 0,
    hospitalisations: plan.taux_hospit ?? 0,
    analyses: plan.taux_analyses ?? 0,
  }
  const taux = (tauxMap[categorie] ?? 70) / 100
  const montantCalcule = Math.round(montant * taux)

  // Plafonds par catégorie
  const plafondMap: Record<string, number> = {
    consultations: plan.plafond_consultation ?? 0,
    medicaments: plan.plafond_pharma ?? 0,
    hospitalisations: plan.plafond_hospit ?? 0,
    analyses: plan.plafond_analyses ?? 0,
  }
  const utiliseMap: Record<string, number> = {
    consultations: contrat?.plafond_consultation_utilise ?? 0,
    medicaments: contrat?.plafond_pharma_utilise ?? 0,
    hospitalisations: contrat?.plafond_hospit_utilise ?? 0,
    analyses: contrat?.plafond_analyses_utilise ?? 0,
  }
  const plafondCat = plafondMap[categorie] ?? (plan.plafond_annuel ?? 0)
  const utilise = utiliseMap[categorie] ?? 0
  const restant = Math.max(0, plafondCat - utilise)

  const montantSuggere = Math.min(montantCalcule, restant)

  return successResponse({
    montantDemande: montant,
    categorie,
    taux: Math.round(taux * 100),
    montantCalcule,
    plafondCategorie: plafondCat,
    plafondUtilise: utilise,
    plafondRestant: restant,
    montantSuggere,
  })
})
