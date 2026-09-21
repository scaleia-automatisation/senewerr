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

  const now = new Date()
  const currentMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Nombre d'adhérents actifs et montants attendus
  const { data: contratsActifs } = await admin
    .from('contrats')
    .select('id, adherent_id, plans_mutuelle!contrats_plan_id_fkey(montant_cotisation)')
    .eq('mutuelle_id', mutuelleId)
    .eq('statut', 'ACTIF')

  const nbAdherents = contratsActifs?.length ?? 0
  const attenduMois = (contratsActifs ?? []).reduce(
    (acc: number, c: any) => acc + (c.plans_mutuelle?.montant_cotisation ?? 0),
    0
  )

  // Cotisations encaissées ce mois
  const { data: cotisationsMois } = await admin
    .from('cotisations')
    .select('montant, statut, date_paiement, mois, contrat_id, moyen_paiement')
    .eq('mutuelle_id', mutuelleId)
    .eq('mois', currentMois)

  const encaisseMois = (cotisationsMois ?? [])
    .filter((c: any) => c.statut === 'paye')
    .reduce((acc: number, c: any) => acc + (c.montant ?? 0), 0)

  const tauxRecouvrement = attenduMois > 0 ? Math.round((encaisseMois / attenduMois) * 100) : 0

  // Retards (cotisations des mois passés non payées)
  const { data: retards } = await admin
    .from('cotisations')
    .select('montant, mois, contrat_id')
    .eq('mutuelle_id', mutuelleId)
    .lt('mois', currentMois)
    .neq('statut', 'paye')

  const montantEnRetard = (retards ?? []).reduce((acc: number, c: any) => acc + (c.montant ?? 0), 0)

  // Données mensuelles sur 12 mois pour le graphique
  const monthlyData: { mois: string; attendu: number; encaisse: number; retards: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const moisStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const { data: cotsMois } = await admin
      .from('cotisations')
      .select('montant, statut')
      .eq('mutuelle_id', mutuelleId)
      .eq('mois', moisStr)

    const enc = (cotsMois ?? []).filter((c: any) => c.statut === 'paye').reduce((a: number, c: any) => a + (c.montant ?? 0), 0)
    const ret = (cotsMois ?? []).filter((c: any) => c.statut !== 'paye').reduce((a: number, c: any) => a + (c.montant ?? 0), 0)

    monthlyData.push({ mois: moisStr, attendu: attenduMois, encaisse: enc, retards: ret })
  }

  // Top 10 adhérents avec le plus de retards (nb de mois non payés)
  const retardCounts: Record<string, { contratId: string; nb: number }> = {}
  for (const c of (retards ?? [])) {
    const k = c.contrat_id
    retardCounts[k] = { contratId: k, nb: (retardCounts[k]?.nb ?? 0) + 1 }
  }
  const top10 = Object.values(retardCounts)
    .sort((a, b) => b.nb - a.nb)
    .slice(0, 10)

  // Enrichir top10 avec noms adhérents
  const top10Enrichi = await Promise.all(
    top10.map(async (item) => {
      const { data: contrat } = await admin
        .from('contrats')
        .select('numero_contrat, profiles!contrats_adherent_id_fkey(full_name)')
        .eq('id', item.contratId)
        .single()
      return {
        contratId: item.contratId,
        nbRetards: item.nb,
        adherentNom: (contrat as any)?.profiles?.full_name ?? '—',
        numeroContrat: (contrat as any)?.numero_contrat ?? '—',
      }
    })
  )

  return successResponse({
    kpis: {
      attenduMois,
      encaisseMois,
      tauxRecouvrement,
      montantEnRetard,
      nbAdherents,
      nbEnRetard: Object.keys(retardCounts).length,
    },
    monthlyData,
    top10Retards: top10Enrichi,
    currentMois,
  })
})
