import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Envoie une demande de résiliation de compte mutuelle à l'admin Sene Werr.
// NE supprime RIEN directement. Crée une alerte admin + notification interne.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { raison } = body ?? {}

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: prof } = await admin.from('profiles').select('mutuelle_id, full_name, email').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: mutuelle } = await admin.from('mutuelles').select('nom').eq('id', mutuelleId).single()

  // Créer une alerte admin
  await admin.from('admin_alerts').insert({
    type: 'mutuelle_deletion_request',
    titre: `Demande résiliation mutuelle : ${mutuelle?.nom ?? mutuelleId}`,
    message: `Le gestionnaire ${prof?.full_name ?? prof?.email ?? auth.profileId} demande la résiliation du compte mutuelle "${mutuelle?.nom ?? mutuelleId}". Raison : ${raison?.trim() ?? 'Non précisée'}`,
    data: {
      mutuelle_id: mutuelleId,
      gestionnaire_id: auth.profileId,
      gestionnaire_nom: prof?.full_name ?? '',
      gestionnaire_email: prof?.email ?? '',
      raison: raison?.trim() ?? '',
    },
    statut: 'ouvert',
  }).select()

  // Notification de confirmation au gestionnaire
  await admin.from('notifications').insert({
    profile_id: auth.profileId,
    type: 'deletion_request_sent',
    titre: 'Demande de résiliation envoyée',
    message: `Votre demande de résiliation du compte mutuelle a été transmise à l'équipe Sene Werr. Vous serez contacté sous 48h.`,
    urgence: 'warning',
    mutuelle_id: mutuelleId,
  })

  return successResponse({ sent: true })
})
