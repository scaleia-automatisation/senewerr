import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try {
    auth = await requireAuth(req)
  } catch {
    return errorResponse('UNAUTHORIZED', 'Non autorisé', 401)
  }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Récupérer la mutuelle_id du gestionnaire
  const { data: prof } = await admin
    .from('profiles')
    .select('mutuelle_id')
    .eq('id', auth.profileId)
    .single()

  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin
      .from('mutuelles_gestionnaires')
      .select('mutuelle_id')
      .eq('gestionnaire_id', auth.profileId)
      .eq('actif', true)
      .limit(1)
      .single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Total adhérents actifs
  const { count: adherentsActifs } = await admin
    .from('contrats')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'ACTIF')

  // 2. Cotisations encaissées ce mois
  const { data: cotisationsMois } = await admin
    .from('cotisations')
    .select('montant')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfMonth)
    .eq('statut', 'paye')

  const cotisationsTotal = (cotisationsMois ?? []).reduce((s: number, c: any) => s + (c.montant ?? 0), 0)

  // Cotisations mois précédent (tendance)
  const { data: cotisationsPrevMois } = await admin
    .from('cotisations')
    .select('montant')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfPrevMonth)
    .lte('created_at', endOfPrevMonth)
    .eq('statut', 'paye')

  const cotisationsPrevTotal = (cotisationsPrevMois ?? []).reduce((s: number, c: any) => s + (c.montant ?? 0), 0)

  // 3. Adhérents avec cotisation en retard > 30 jours
  const { count: cotisationsRetard } = await admin
    .from('contrats')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'ACTIF')
    .lt('derniere_cotisation_at', thirtyDaysAgo)

  // 4. Demandes en attente
  const { count: demandesEnAttente } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'en_attente')

  // Demandes en attente mois précédent
  const { count: demandesPrevMois } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'en_attente')
    .gte('created_at', startOfPrevMonth)
    .lte('created_at', endOfPrevMonth)

  // 5. Montant remboursé ce mois
  const { data: remboursementsMois } = await admin
    .from('remboursements')
    .select('montant_approuve')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfMonth)

  const montantRembourse = (remboursementsMois ?? []).reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)

  const { data: remboursementsPrevMois } = await admin
    .from('remboursements')
    .select('montant_approuve')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfPrevMonth)
    .lte('created_at', endOfPrevMonth)

  const montantRemboursePrev = (remboursementsPrevMois ?? []).reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)

  // 6. Taux de remboursement (30 derniers jours)
  const { count: totalDemandes30j } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', thirtyDaysAgo)

  const { count: demandesApprouvees30j } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', thirtyDaysAgo)
    .eq('statut', 'approuve')

  const tauxRemboursement = totalDemandes30j ? Math.round(((demandesApprouvees30j ?? 0) / totalDemandes30j) * 100) : 0

  // Taux mois précédent
  const { count: totalDemandesPrev30j } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfPrevMonth)
    .lte('created_at', endOfPrevMonth)

  const { count: demandesApproveesPrev30j } = await admin
    .from('remboursement_demandes')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', startOfPrevMonth)
    .lte('created_at', endOfPrevMonth)
    .eq('statut', 'approuve')

  const tauxRemboursementPrev = totalDemandesPrev30j
    ? Math.round(((demandesApproveesPrev30j ?? 0) / totalDemandesPrev30j) * 100)
    : 0

  // Alertes — cotisations impayées > 60 jours
  const { data: impayesRaw } = await admin
    .from('contrats')
    .select('id, numero_contrat, adherent_id, profiles!contrats_adherent_id_fkey(full_name), montant_cotisation, derniere_cotisation_at')
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'ACTIF')
    .lt('derniere_cotisation_at', sixtyDaysAgo)
    .limit(10)

  const impayes = (impayesRaw ?? []).map((c: any) => ({
    contratId: c.id,
    adherentId: c.adherent_id,
    adherentNom: c.profiles?.full_name ?? 'Adhérent inconnu',
    montantDu: c.montant_cotisation ?? 0,
    derniereDate: c.derniere_cotisation_at,
  }))

  // Alertes — demandes > 72h non traitées
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  const { data: demandesUrgentesRaw } = await admin
    .from('remboursement_demandes')
    .select('id, reference, montant_demande, created_at, adherent_id, profiles!remboursement_demandes_adherent_id_fkey(full_name)')
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'en_attente')
    .lt('created_at', seventyTwoHoursAgo)
    .limit(10)

  const demandesUrgentes = (demandesUrgentesRaw ?? []).map((d: any) => ({
    id: d.id,
    reference: d.reference,
    adherentNom: d.profiles?.full_name ?? 'Adhérent',
    montant: d.montant_demande ?? 0,
    createdAt: d.created_at,
  }))

  // Alertes — contrats expirant dans 30 jours
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: contratsExpirantRaw } = await admin
    .from('contrats')
    .select('id, numero_contrat, adherent_id, date_fin, profiles!contrats_adherent_id_fkey(full_name)')
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'ACTIF')
    .lte('date_fin', in30Days)
    .gte('date_fin', now.toISOString())
    .limit(10)

  const contratsExpirant = (contratsExpirantRaw ?? []).map((c: any) => ({
    contratId: c.id,
    adherentId: c.adherent_id,
    adherentNom: c.profiles?.full_name ?? 'Adhérent',
    numeroContrat: c.numero_contrat,
    dateFin: c.date_fin,
  }))

  // Répartition des dépenses (30 derniers jours par défaut)
  const { data: depensesRaw } = await admin
    .from('remboursements')
    .select('categorie, montant_approuve')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', thirtyDaysAgo)

  const depensesMap: Record<string, number> = {}
  for (const d of depensesRaw ?? []) {
    const cat = d.categorie ?? 'autres'
    depensesMap[cat] = (depensesMap[cat] ?? 0) + (d.montant_approuve ?? 0)
  }
  const depenses = Object.entries(depensesMap).map(([name, value]) => ({ name, value }))

  // Top 5 praticiens
  const { data: topPraticiens } = await admin
    .rpc('get_top_praticiens_mutuelle', { p_mutuelle_id: mutuelleId, p_limit: 5 })
    .then((res: any) => res)

  // Helpers tendance %
  const trend = (current: number, prev: number) => {
    if (!prev) return null
    return Math.round(((current - prev) / prev) * 100)
  }

  return successResponse({
    kpis: {
      adherentsActifs: adherentsActifs ?? 0,
      cotisationsTotal,
      cotisationsTrend: trend(cotisationsTotal, cotisationsPrevTotal),
      cotisationsRetard: cotisationsRetard ?? 0,
      demandesEnAttente: demandesEnAttente ?? 0,
      demandesEnAttenteTrend: trend(demandesEnAttente ?? 0, demandesPrevMois ?? 0),
      montantRembourse,
      montantRembourseTrend: trend(montantRembourse, montantRemboursePrev),
      tauxRemboursement,
      tauxRemboursementTrend: trend(tauxRemboursement, tauxRemboursementPrev),
    },
    alertes: { impayes, demandesUrgentes, contratsExpirant },
    depenses,
    topPraticiens: topPraticiens ?? [],
  })
})
