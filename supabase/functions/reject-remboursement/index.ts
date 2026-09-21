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
  const { demandeId, motif } = body ?? {}
  if (!demandeId || !motif) return errorResponse('INVALID_BODY', 'demandeId et motif requis', 400)

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

  const { data: demande } = await admin
    .from('remboursement_demandes')
    .select('id, reference, adherent_id, statut')
    .eq('id', demandeId)
    .eq('mutuelle_id', mutuelleId)
    .single()

  if (!demande) return errorResponse('NOT_FOUND', 'Demande introuvable', 404)
  if (!['en_attente', 'en_instruction'].includes(demande.statut)) {
    return errorResponse('INVALID_STATE', 'Demande non traitable dans cet état', 400)
  }

  await admin.from('remboursement_demandes').update({
    statut: 'refuse',
    motif_refus: motif,
    traite_par: auth.profileId,
    traite_at: new Date().toISOString(),
  }).eq('id', demandeId)

  await admin.from('notifications').insert({
    profile_id: demande.adherent_id,
    type: 'demande_refusee',
    titre: 'Demande refusée',
    message: `Votre demande ${demande.reference} a été refusée. Motif : ${motif}`,
    urgence: 'warning',
    mutuelle_id: mutuelleId,
  })

  return successResponse({ demandeId, statut: 'refuse' })
})
