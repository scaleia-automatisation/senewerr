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
  const { conventionId, type, motif } = body ?? {}

  if (!conventionId || !type || !['praticien', 'pharmacie'].includes(type)) {
    return errorResponse('INVALID_BODY', 'conventionId et type requis', 400)
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

  const { data: mutuelle } = await admin.from('mutuelles').select('nom').eq('id', mutuelleId).single()

  const table = type === 'praticien' ? 'conventions_praticiens' : 'conventions_pharmacies'
  const idField = type === 'praticien' ? 'praticien_id' : 'pharmacie_id'

  const { data: convention } = await admin
    .from(table)
    .select(`id, ${idField}`)
    .eq('id', conventionId)
    .eq('mutuelle_id', mutuelleId)
    .single()

  if (!convention) return errorResponse('NOT_FOUND', 'Convention introuvable', 404)

  await admin.from(table).update({
    statut: 'resiliee',
    date_fin: new Date().toISOString().split('T')[0],
    motif_resiliation: motif ?? null,
    resilie_par: auth.profileId,
    resilie_at: new Date().toISOString(),
  }).eq('id', conventionId)

  const targetId = convention[idField]

  // Pour les pharmacies : retirer le flag tiers_payant si plus aucune convention active avec cette mutuelle
  if (type === 'pharmacie' && targetId) {
    const { count } = await admin.from('conventions_pharmacies')
      .select('id', { count: 'exact', head: true })
      .eq('pharmacie_id', targetId)
      .eq('mutuelle_id', mutuelleId)
      .eq('statut', 'active')
    if ((count ?? 0) === 0) {
      await admin.from('pharmacies').update({ tiers_payant_actif: false }).eq('id', targetId)
    }
  }

  // Notifier le praticien/pharmacien
  const targetTable = type === 'praticien' ? 'praticiens' : 'pharmacies'
  const { data: target } = await admin.from(targetTable).select('profile_id').eq('id', targetId).single()

  if (target?.profile_id) {
    const mutuelleNom = mutuelle?.nom ?? 'la mutuelle'
    await admin.from('notifications').insert({
      profile_id: target.profile_id,
      type: 'convention_resiliee',
      titre: 'Convention résiliée',
      message: `Votre convention avec ${mutuelleNom} a été résiliée à compter d'aujourd'hui. Le tiers payant direct n'est plus disponible pour cette mutuelle.`,
      urgence: 'warning',
      mutuelle_id: mutuelleId,
    })
  }

  return successResponse({ conventionId, statut: 'resiliee' })
})
