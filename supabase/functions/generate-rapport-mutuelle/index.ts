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
  const { periode } = body ?? {} // 'YYYY-MM'
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return errorResponse('INVALID_BODY', "periode requis, format YYYY-MM", 400)
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

  const { data: mutuelle } = await admin.from('mutuelles')
    .select('nom, telephone, adresse, logo_url').eq('id', mutuelleId).single()

  const [y, m] = periode.split('-').map(Number)
  const debut = `${periode}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const fin = `${periode}-${String(lastDay).padStart(2, '0')}`

  // ── Contrats actifs ────────────────────────────────────────────────────────
  const { data: contratsActifs } = await admin.from('contrats')
    .select('id, cotisation_mensuelle').eq('mutuelle_id', mutuelleId).eq('statut', 'ACTIF')
  const nbAdherents = contratsActifs?.length ?? 0
  const cotisationAttendue = (contratsActifs ?? []).reduce((s: number, c: any) => s + (c.cotisation_mensuelle ?? 0), 0)

  // ── Cotisations du mois ────────────────────────────────────────────────────
  const { data: cotsData } = await admin.from('cotisations')
    .select('montant, statut').eq('mutuelle_id', mutuelleId).eq('mois', periode)
  const cotisationsPayees = (cotsData ?? []).filter((c: any) => c.statut === 'paye')
    .reduce((s: number, c: any) => s + (c.montant ?? 0), 0)
  const cotisationsEnRetard = (cotsData ?? []).filter((c: any) => ['en_retard', 'impaye'].includes(c.statut)).length
  const tauxRecouvrement = cotisationAttendue > 0 ? Math.round((cotisationsPayees / cotisationAttendue) * 100) : 0

  // ── Remboursements du mois ─────────────────────────────────────────────────
  const { data: rembsData } = await admin.from('remboursement_demandes')
    .select('id, numero_demande, montant_approuve, statut, date_remboursement, profiles!remboursement_demandes_adherent_id_fkey(full_name)')
    .eq('mutuelle_id', mutuelleId)
    .gte('created_at', debut)
    .lte('created_at', fin + 'T23:59:59')

  const rembsTotal = rembsData?.length ?? 0
  const rembsApprouves = (rembsData ?? []).filter((r: any) => ['approuve', 'rembourse'].includes(r.statut))
  const montantApprouve = rembsApprouves.reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)
  const rembsEffectues = (rembsData ?? []).filter((r: any) => r.statut === 'rembourse')
  const montantRembourse = rembsEffectues.reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)

  // ── Tiers payant du mois ───────────────────────────────────────────────────
  const { data: tpData } = await admin.from('tiers_payant_demandes')
    .select('statut, montant_mutuelle').eq('mutuelle_id', mutuelleId)
    .gte('created_at', debut).lte('created_at', fin + 'T23:59:59')
  const tpTotal = tpData?.length ?? 0
  const tpValides = (tpData ?? []).filter((t: any) => ['approved', 'regle'].includes(t.statut))
  const montantTP = tpValides.reduce((s: number, t: any) => s + (t.montant_mutuelle ?? 0), 0)

  // ── Liste remboursements effectués ─────────────────────────────────────────
  const listeRemboursements = rembsEffectues.slice(0, 20).map((r: any) => ({
    numero: r.numero_demande ?? '—',
    adherent: (r.profiles as any)?.full_name ?? '—',
    montant: r.montant_approuve ?? 0,
    date: r.date_remboursement ?? '',
  }))

  return successResponse({
    mutuelle: {
      nom: mutuelle?.nom ?? '',
      telephone: mutuelle?.telephone ?? '',
      adresse: mutuelle?.adresse ?? '',
      logo: mutuelle?.logo_url ?? null,
    },
    periode,
    genereLe: new Date().toISOString(),
    kpis: {
      nbAdherents,
      cotisationAttendue,
      cotisationsPayees,
      cotisationsEnRetard,
      tauxRecouvrement,
      rembsTotal,
      rembsApprouves: rembsApprouves.length,
      montantApprouve,
      montantRembourse,
      tpTotal,
      tpValides: tpValides.length,
      montantTP,
    },
    listeRemboursements,
  })
})
