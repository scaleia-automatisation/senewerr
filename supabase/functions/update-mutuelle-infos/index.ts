import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Met à jour les informations publiques d'une mutuelle (infos générales, config).
// NE modifie PAS les données sensibles (clés API, statut) via ce point.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) return errorResponse('INVALID_BODY', 'Corps JSON requis', 400)

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

  // Champs autorisés — jamais de statut, plan, clés API, etc.
  const allowed = ['nom', 'description', 'adresse', 'telephone', 'email_contact', 'numero_agrement', 'logo_url', 'paiement_config', 'tp_rules', 'regles_metier']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse('INVALID_BODY', 'Aucun champ valide fourni', 400)
  }

  const { data: updated, error } = await admin
    .from('mutuelles')
    .update(updates)
    .eq('id', mutuelleId)
    .select()
    .single()

  if (error) return errorResponse('DB_ERROR', error.message, 500)

  return successResponse(updated)
})
