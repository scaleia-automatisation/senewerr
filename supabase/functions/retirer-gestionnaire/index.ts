import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Retire l'accès d'un gestionnaire à cette mutuelle.
// Règle de sécurité : impossible si c'est le DERNIER gestionnaire actif.
// Règle de sécurité : impossible de se retirer soi-même (évite blocage).
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { gestionnaireId } = body ?? {}
  if (!gestionnaireId) return errorResponse('INVALID_BODY', 'gestionnaireId requis', 400)

  // Anti auto-retrait
  if (gestionnaireId === auth.profileId) {
    return errorResponse('SELF_REMOVAL', 'Vous ne pouvez pas vous retirer vous-même — demandez à un autre gestionnaire', 400)
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

  // Compter les gestionnaires actifs AVANT suppression
  const { count } = await admin.from('mutuelles_gestionnaires')
    .select('*', { count: 'exact', head: true })
    .eq('mutuelle_id', mutuelleId)
    .eq('actif', true)

  if ((count ?? 0) <= 1) {
    return errorResponse('LAST_GESTIONNAIRE', 'Impossible de retirer le dernier gestionnaire actif', 400)
  }

  // Vérifier que la cible appartient bien à cette mutuelle
  const { data: cible } = await admin.from('mutuelles_gestionnaires')
    .select('id').eq('gestionnaire_id', gestionnaireId).eq('mutuelle_id', mutuelleId).eq('actif', true).maybeSingle()

  if (!cible) return errorResponse('NOT_FOUND', 'Ce gestionnaire n\'est pas actif sur cette mutuelle', 404)

  await admin.from('mutuelles_gestionnaires')
    .update({ actif: false, updated_at: new Date().toISOString() })
    .eq('gestionnaire_id', gestionnaireId)
    .eq('mutuelle_id', mutuelleId)

  // Notifier la cible
  await admin.from('notifications').insert({
    profile_id: gestionnaireId,
    type: 'acces_retire',
    titre: 'Accès retiré',
    message: 'Votre accès gestionnaire à cette mutuelle a été retiré.',
    urgence: 'warning',
    mutuelle_id: mutuelleId,
  })

  return successResponse({ removed: true })
})
