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
  const { contratIds, niveau } = body ?? {}
  // niveau: 'doux' (J+5) | 'ferme' (J+15) | 'urgent' (J+30) | 'suspension' (J+60)

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
  const mutuelleNom = mutuelle?.nom ?? 'votre mutuelle'

  const now = new Date()
  const currentMois = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Récupérer les contrats avec retards
  let contratsQuery = admin
    .from('cotisations')
    .select('contrat_id, mois, montant, adherent_id')
    .eq('mutuelle_id', mutuelleId)
    .lt('mois', currentMois)
    .neq('statut', 'paye')

  if (contratIds?.length) {
    contratsQuery = contratsQuery.in('contrat_id', contratIds)
  }

  const { data: retards } = await contratsQuery.limit(200)

  // Grouper par adhérent
  const byAdherent: Record<string, { adherentId: string; mois: string[]; total: number }> = {}
  for (const r of (retards ?? [])) {
    if (!byAdherent[r.adherent_id]) {
      byAdherent[r.adherent_id] = { adherentId: r.adherent_id, mois: [], total: 0 }
    }
    byAdherent[r.adherent_id].mois.push(r.mois)
    byAdherent[r.adherent_id].total += r.montant ?? 0
  }

  const niveauConfig: Record<string, { titre: string; message: (moisList: string[], total: number) => string; urgence: string }> = {
    doux: {
      titre: 'Rappel cotisation',
      message: (moisList, total) =>
        `Rappel : votre cotisation ${moisList.join(', ')} auprès de ${mutuelleNom} (${new Intl.NumberFormat('fr-SN').format(total)} FCFA) est due. Réglez-la depuis votre espace.`,
      urgence: 'info',
    },
    ferme: {
      titre: 'Cotisation impayée',
      message: (moisList, total) =>
        `Votre cotisation ${moisList.join(', ')} (${new Intl.NumberFormat('fr-SN').format(total)} FCFA) est toujours impayée. Merci de régulariser votre situation sous 15 jours.`,
      urgence: 'warning',
    },
    urgent: {
      titre: 'Couverture menacée',
      message: (moisList, total) =>
        `URGENT : ${moisList.length} cotisation(s) impayée(s) — ${new Intl.NumberFormat('fr-SN').format(total)} FCFA. Sans régularisation, votre couverture mutuelle sera suspendue.`,
      urgence: 'critical',
    },
    suspension: {
      titre: 'Suspension de couverture',
      message: (moisList, total) =>
        `Votre couverture mutuelle a été suspendue en raison de ${moisList.length} cotisation(s) impayée(s) (${new Intl.NumberFormat('fr-SN').format(total)} FCFA). Contactez votre mutuelle pour rétablissement.`,
      urgence: 'critical',
    },
  }

  const cfg = niveauConfig[niveau ?? 'doux'] ?? niveauConfig.doux
  const sent: string[] = []
  const suspendus: string[] = []

  // Traiter par batch de 20 pour éviter timeout
  const entries = Object.values(byAdherent)
  for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20)
    const notifications = batch.map(e => ({
      profile_id: e.adherentId,
      type: `relance_cotisation_${niveau ?? 'doux'}`,
      titre: cfg.titre,
      message: cfg.message(e.mois, e.total),
      urgence: cfg.urgence,
      mutuelle_id: mutuelleId,
    }))
    await admin.from('notifications').insert(notifications)
    sent.push(...batch.map(e => e.adherentId))

    // Si niveau suspension : suspendre les contrats
    if (niveau === 'suspension') {
      for (const e of batch) {
        await admin.from('contrats')
          .update({ statut: 'SUSPENDU' })
          .eq('adherent_id', e.adherentId)
          .eq('mutuelle_id', mutuelleId)
          .eq('statut', 'ACTIF')
        suspendus.push(e.adherentId)
      }
    }
  }

  return successResponse({
    sent: sent.length,
    niveau: niveau ?? 'doux',
    suspendus: suspendus.length,
  })
})
