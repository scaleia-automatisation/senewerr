import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Retourne tous les agrégats analytiques d'une période.
// Aucun nom ou identifiant personnel dans les sections anonymisées.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { debut, fin } = body ?? {}
  if (!debut || !fin) return errorResponse('INVALID_BODY', 'debut et fin (YYYY-MM-DD) requis', 400)

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

  // ── Générer liste des mois dans la période ─────────────────────────────────
  const moisList: string[] = []
  const [dy, dm] = debut.split('-').map(Number)
  const [fy, fm] = fin.split('-').map(Number)
  let cy = dy, cm = dm
  while (cy < fy || (cy === fy && cm <= fm)) {
    moisList.push(`${cy}-${String(cm).padStart(2, '0')}`)
    cm++; if (cm > 12) { cm = 1; cy++ }
    if (moisList.length > 24) break // safety cap
  }

  // ── Lancer toutes les requêtes en parallèle ────────────────────────────────
  const [
    contratsActifsRes,
    contratsAllRes,
    cotisationsRes,
    rembsRes,
    tpRes,
    tpReglRes,
    plansRes,
  ] = await Promise.all([
    // Contrats actifs actuellement
    admin.from('contrats').select('id, cotisation_mensuelle, plan_id, statut, created_at, date_fin').eq('mutuelle_id', mutuelleId).eq('statut', 'ACTIF'),
    // Tous contrats créés dans la période (pour adhésions)
    admin.from('contrats').select('id, statut, created_at, date_fin, plan_id, cotisation_mensuelle').eq('mutuelle_id', mutuelleId),
    // Cotisations payées dans la période
    admin.from('cotisations').select('montant, mois, statut, contrat_id').eq('mutuelle_id', mutuelleId).gte('mois', debut.slice(0, 7)).lte('mois', fin.slice(0, 7)),
    // Remboursements dans la période
    admin.from('remboursement_demandes').select('id, montant_approuve, montant_demande, statut, type_soin, motif_refus, created_at, date_remboursement, adherent_id, traite_at').eq('mutuelle_id', mutuelleId).gte('created_at', debut).lte('created_at', fin + 'T23:59:59'),
    // TP dans la période
    admin.from('tiers_payant_demandes').select('statut, montant_mutuelle, type, created_at').eq('mutuelle_id', mutuelleId).gte('created_at', debut).lte('created_at', fin + 'T23:59:59'),
    // Règlements TP dans la période
    admin.from('tp_reglements').select('montant, date_reglement').eq('mutuelle_id', mutuelleId).gte('date_reglement', debut.slice(0, 7)).lte('date_reglement', fin.slice(0, 7)),
    // Plans
    admin.from('plans_mutuelle').select('id, nom').eq('mutuelle_id', mutuelleId),
  ])

  const contratsActifs = contratsActifsRes.data ?? []
  const contratsAll = contratsAllRes.data ?? []
  const cotisations = cotisationsRes.data ?? []
  const rembs = rembsRes.data ?? []
  const tpAll = tpRes.data ?? []
  const tpRegls = tpReglRes.data ?? []
  const plans = plansRes.data ?? []

  // ── 1. Santé financière par mois ──────────────────────────────────────────

  const santeParMois = moisList.map(mois => {
    const moisContrats = contratsAll.filter((c: any) => c.statut === 'ACTIF' || c.created_at?.slice(0, 7) <= mois)
    const attendu = contratsAll
      .filter((c: any) => c.statut === 'ACTIF' || (c.created_at?.slice(0, 7) <= mois && (c.date_fin ?? '9999') >= mois))
      .reduce((s: number, c: any) => s + (c.cotisation_mensuelle ?? 0), 0)
    const encaisse = cotisations.filter((c: any) => c.mois === mois && c.statut === 'paye').reduce((s: number, c: any) => s + (c.montant ?? 0), 0)
    const rembMois = rembs.filter((r: any) => r.date_remboursement?.slice(0, 7) === mois && r.statut === 'rembourse').reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)
    const tpMois = tpRegls.filter((t: any) => t.date_reglement?.slice(0, 7) === mois).reduce((s: number, t: any) => s + (t.montant ?? 0), 0)
    return { mois, attendu, encaisse, rembourse: rembMois + tpMois }
  })

  // Solde cumulé
  let solde = 0
  const soldeCumul = santeParMois.map(m => {
    solde += m.encaisse - m.rembourse
    return { mois: m.mois, solde }
  })

  const totalEncaisse = santeParMois.reduce((s, m) => s + m.encaisse, 0)
  const totalRembourse = santeParMois.reduce((s, m) => s + m.rembourse, 0)
  const totalAttendu = santeParMois.reduce((s, m) => s + m.attendu, 0)
  const ratioSinistralite = totalEncaisse > 0 ? Math.round((totalRembourse / totalEncaisse) * 100) : 0
  const tauxRecouvrementMoyen = totalAttendu > 0 ? Math.round((totalEncaisse / totalAttendu) * 100) : 0
  const cotMoyMois = santeParMois.length > 0 ? totalEncaisse / santeParMois.length : 0
  const reserveMois = cotMoyMois > 0 ? Math.round((soldeCumul[soldeCumul.length - 1]?.solde ?? 0) / cotMoyMois * 10) / 10 : 0

  // ── 2. Adhérents ──────────────────────────────────────────────────────────

  const evolutionAdherents = moisList.map(mois => ({
    mois,
    actifs: contratsAll.filter((c: any) =>
      c.statut === 'ACTIF' || (c.created_at?.slice(0, 7) <= mois && (c.date_fin ?? '9999-12') >= mois)
    ).length,
  }))

  const adhesionsResiliations = moisList.map(mois => ({
    mois,
    adhesions: contratsAll.filter((c: any) => c.created_at?.slice(0, 7) === mois).length,
    resiliations: contratsAll.filter((c: any) =>
      c.statut === 'RESILIE' && (c.date_fin ?? '')?.slice(0, 7) === mois
    ).length,
  }))

  // Répartition par plan
  const planMap: Record<string, { nom: string; nb: number }> = {}
  for (const c of contratsActifs) {
    const pid = (c as any).plan_id
    if (!planMap[pid]) {
      const plan = plans.find((p: any) => p.id === pid)
      planMap[pid] = { nom: plan?.nom ?? 'Inconnu', nb: 0 }
    }
    planMap[pid].nb++
  }
  const parPlan = Object.values(planMap).sort((a, b) => b.nb - a.nb)

  // Top 20 adhérents par montant remboursé (anonymisé)
  const montantParAdherent: Record<string, number> = {}
  for (const r of rembs) {
    if (!['approuve', 'rembourse'].includes((r as any).statut)) continue
    const id = (r as any).adherent_id
    montantParAdherent[id] = (montantParAdherent[id] ?? 0) + ((r as any).montant_approuve ?? 0)
  }
  const top20 = Object.entries(montantParAdherent)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([, montant], i) => ({ rang: i + 1, montant })) // nom supprimé intentionnellement

  // Heatmap adhérents avec demande
  const adherentsAvecDemande = moisList.map(mois => {
    const avecDemande = new Set(rembs.filter((r: any) => r.created_at?.slice(0, 7) === mois).map((r: any) => r.adherent_id)).size
    const totalActifs = evolutionAdherents.find(e => e.mois === mois)?.actifs ?? 0
    return { mois, avecDemande, sansDemande: Math.max(0, totalActifs - avecDemande) }
  })

  // ── 3. Demandes de remboursement ──────────────────────────────────────────

  const typeSoinMap: Record<string, { nb: number; montant: number }> = {}
  for (const r of rembs) {
    const type = (r as any).type_soin ?? 'autre'
    if (!typeSoinMap[type]) typeSoinMap[type] = { nb: 0, montant: 0 }
    typeSoinMap[type].nb++
    typeSoinMap[type].montant += (r as any).montant_approuve ?? (r as any).montant_demande ?? 0
  }
  const parTypeSoin = Object.entries(typeSoinMap)
    .map(([type, v]) => ({ type, nb: v.nb, montant: v.montant }))
    .sort((a, b) => b.nb - a.nb)

  // Délai moyen de traitement par mois (en heures)
  const delaiParMois = moisList.map(mois => {
    const rembsMois = rembs.filter((r: any) =>
      r.created_at?.slice(0, 7) === mois && r.traite_at && ['approuve', 'refuse'].includes(r.statut)
    )
    if (rembsMois.length === 0) return { mois, heures: null }
    const total = rembsMois.reduce((s: number, r: any) => {
      const debut = new Date(r.created_at).getTime()
      const fin = new Date(r.traite_at!).getTime()
      return s + (fin - debut) / 3600000
    }, 0)
    return { mois, heures: Math.round(total / rembsMois.length) }
  })

  // Répartition statuts
  const statutMap: Record<string, number> = {}
  for (const r of rembs) {
    const s = (r as any).statut
    statutMap[s] = (statutMap[s] ?? 0) + 1
  }
  const repartitionStatut = Object.entries(statutMap).map(([statut, nb]) => ({ statut, nb }))

  // Motifs de refus les plus fréquents
  const motifsMap: Record<string, number> = {}
  for (const r of rembs) {
    if ((r as any).statut !== 'refuse') continue
    const motif = (r as any).motif_refus?.slice(0, 60) ?? 'Non précisé'
    motifsMap[motif] = (motifsMap[motif] ?? 0) + 1
  }
  const motifsRefus = Object.entries(motifsMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([motif, nb]) => ({ motif, nb }))

  // ── 4. Performance prestataires (aggrégat TP) ─────────────────────────────

  const prestMap: Record<string, { type: string; nb: number; montant: number }> = {}
  for (const t of tpAll) {
    const id = (t as any).pharmacie_id ?? (t as any).praticien_id ?? 'inconnu'
    if (!prestMap[id]) prestMap[id] = { type: (t as any).type ?? '?', nb: 0, montant: 0 }
    prestMap[id].nb++
    if (['approved', 'regle'].includes((t as any).statut)) {
      prestMap[id].montant += (t as any).montant_mutuelle ?? 0
    }
  }

  // Enrichir avec noms (requête séparée - ids uniques)
  const prestIds = Object.keys(prestMap).slice(0, 20)
  const pharmIds = prestIds.filter(id => prestMap[id].type === 'pharmacie')
  const pratIds = prestIds.filter(id => prestMap[id].type === 'praticien')

  const [pharmRes, pratRes] = await Promise.all([
    pharmIds.length > 0 ? admin.from('pharmacies').select('id, nom').in('id', pharmIds) : { data: [] },
    pratIds.length > 0 ? admin.from('praticiens').select('id, nom').in('id', pratIds) : { data: [] },
  ])

  const nomMap: Record<string, string> = {}
  for (const p of (pharmRes.data ?? [])) nomMap[p.id] = p.nom
  for (const p of (pratRes.data ?? [])) nomMap[p.id] = p.nom

  const top10Prestataires = Object.entries(prestMap)
    .sort(([, a], [, b]) => b.montant - a.montant)
    .slice(0, 10)
    .map(([id, v]) => ({ nom: nomMap[id] ?? 'Prestataire', type: v.type, nb_demandes: v.nb, montant: v.montant }))

  // Conventionné vs non-conventionné (basé sur existence de convention active)
  const tpConventionne = tpAll.filter((t: any) => ['approved', 'regle'].includes(t.statut)).length
  const rembClassique = rembs.filter((r: any) => ['approuve', 'rembourse'].includes(r.statut)).length
  const comparaisonMode = { tp: tpConventionne, classique: rembClassique }

  // ── 5. Profil de risque ───────────────────────────────────────────────────

  const tranches = [
    { label: '0 – 10 000', min: 0, max: 10000, nb: 0 },
    { label: '10 001 – 50 000', min: 10001, max: 50000, nb: 0 },
    { label: '50 001 – 100 000', min: 50001, max: 100000, nb: 0 },
    { label: '> 100 000', min: 100001, max: Infinity, nb: 0 },
  ]
  for (const [, montant] of Object.entries(montantParAdherent)) {
    const t = tranches.find(t => montant >= t.min && montant <= t.max)
    if (t) t.nb++
  }
  const distribution = tranches.map(t => ({ label: t.label, nb: t.nb }))

  // Top consommateurs anonymisés (top 5%)
  const sorted = Object.entries(montantParAdherent).sort(([, a], [, b]) => b - a)
  const top5pct = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.05)))
  const topConsommateurs = top5pct.map(([, montant], i) => ({ rang: i + 1, montant }))

  // Saisonnalité (nb demandes par mois sur toute la plage)
  const saisonnalite = moisList.map(mois => ({
    mois,
    nb_demandes: rembs.filter((r: any) => r.created_at?.slice(0, 7) === mois).length,
  }))

  return successResponse({
    periode: { debut, fin },
    sante_financiere: {
      parMois: santeParMois,
      soldeCumul,
      ratioSinistralite,
      tauxRecouvrementMoyen,
      reserveMois,
      totalEncaisse,
      totalRembourse,
    },
    adherents: {
      evolution: evolutionAdherents,
      adhesionsResiliations,
      parPlan,
      top20,
      adherentsAvecDemande,
    },
    demandes: {
      parTypeSoin,
      delaiParMois,
      repartitionStatut,
      motifsRefus,
      total: rembs.length,
      totalApprouves: rembs.filter((r: any) => ['approuve', 'rembourse'].includes(r.statut)).length,
      montantTotal: rembs.reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0),
    },
    prestataires: {
      top10: top10Prestataires,
      comparaisonMode,
    },
    profil_risque: {
      distribution,
      topConsommateurs,
      saisonnalite,
    },
  })
})
