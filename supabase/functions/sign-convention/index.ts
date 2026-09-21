import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// type: 'praticien' | 'pharmacie'
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const {
    conventionId,  // si update
    type,          // 'praticien' | 'pharmacie'
    targetId,      // praticien_id ou pharmacie_id
    dateDebut, dateFin,
    // praticien-specific
    tauxOverride, tarifConventionne,
    // pharmacie-specific
    tauxMedicaments, plafondMensuelPharma, medicamentsPrisEnCharge,
  } = body ?? {}

  if (!type || !['praticien', 'pharmacie'].includes(type)) {
    return errorResponse('INVALID_BODY', 'type doit être praticien ou pharmacie', 400)
  }
  if (!targetId && !conventionId) return errorResponse('INVALID_BODY', 'targetId requis', 400)
  if (!dateDebut) return errorResponse('INVALID_BODY', 'dateDebut requis', 400)

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

  let payload: Record<string, any> = {
    mutuelle_id: mutuelleId,
    [idField]: targetId,
    date_debut: dateDebut,
    date_fin: dateFin ?? null,
    statut: 'active',
    signe_par: auth.profileId,
    signe_at: new Date().toISOString(),
  }

  if (type === 'praticien') {
    Object.assign(payload, {
      taux_override: tauxOverride != null ? Number(tauxOverride) : null,
      tarif_conventionne: tarifConventionne != null ? Number(tarifConventionne) : null,
    })
  } else {
    Object.assign(payload, {
      taux_medicaments: tauxMedicaments != null ? Number(tauxMedicaments) : null,
      plafond_mensuel: plafondMensuelPharma != null ? Number(plafondMensuelPharma) : null,
      medicaments_pris_en_charge: medicamentsPrisEnCharge ?? null,
    })
  }

  let conventionResultId: string

  if (conventionId) {
    // Vérifier propriété
    const { data: existing } = await admin.from(table).select('id').eq('id', conventionId).eq('mutuelle_id', mutuelleId).single()
    if (!existing) return errorResponse('NOT_FOUND', 'Convention introuvable', 404)
    const { error } = await admin.from(table).update(payload).eq('id', conventionId)
    if (error) return errorResponse('DB_ERROR', error.message, 500)
    conventionResultId = conventionId
  } else {
    const { data, error } = await admin.from(table).insert(payload).select('id').single()
    if (error) return errorResponse('DB_ERROR', error.message, 500)
    conventionResultId = data?.id
  }

  // Si pharmacie, activer tiers_payant
  if (type === 'pharmacie' && targetId) {
    await admin.from('pharmacies').update({ tiers_payant_actif: true }).eq('id', targetId)
  }

  // Notification in-app au praticien/pharmacien (en cherchant le profile_id lié)
  const targetTable = type === 'praticien' ? 'praticiens' : 'pharmacies'
  const { data: target } = await admin.from(targetTable).select('profile_id, nom').eq('id', targetId).single()

  if (target?.profile_id) {
    const mutuelleNom = mutuelle?.nom ?? 'la mutuelle'
    const targetNom = target.nom ?? 'Praticien'
    await admin.from('notifications').insert({
      profile_id: target.profile_id,
      type: 'convention_signee',
      titre: 'Convention signée',
      message: `Vous êtes désormais conventionné avec ${mutuelleNom}. La convention est effective à partir du ${new Date(dateDebut).toLocaleDateString('fr-SN')}.`,
      urgence: 'info',
      mutuelle_id: mutuelleId,
    })
  }

  return successResponse({ conventionId: conventionResultId, type, statut: 'active' })
})
