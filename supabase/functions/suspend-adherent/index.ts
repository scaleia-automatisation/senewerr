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
  const { contratId, action, raison } = body ?? {} // action: 'suspendre' | 'reactivate'
  if (!contratId || !action) return errorResponse('INVALID_BODY', 'contratId et action requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier que le contrat appartient à la mutuelle du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: contrat } = await admin.from('contrats')
    .select('id, adherent_id, numero_contrat, statut')
    .eq('id', contratId).eq('mutuelle_id', mutuelleId).single()
  if (!contrat) return errorResponse('NOT_FOUND', 'Contrat introuvable', 404)

  const newStatut = action === 'suspendre' ? 'SUSPENDU' : 'ACTIF'
  const { error: updateErr } = await admin.from('contrats')
    .update({ statut: newStatut, updated_at: new Date().toISOString() })
    .eq('id', contratId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // Notifier l'adhérent
  const message = action === 'suspendre'
    ? `Votre couverture mutuelle (${contrat.numero_contrat}) a été suspendue${raison ? ` : ${raison}` : ''}. Contactez votre mutuelle pour plus d'informations.`
    : `Votre couverture mutuelle (${contrat.numero_contrat}) a été réactivée. Vous bénéficiez à nouveau de tous vos avantages.`

  await admin.from('notifications').insert({
    profile_id: contrat.adherent_id,
    type: action === 'suspendre' ? 'contrat_suspendu' : 'contrat_reactivi',
    titre: action === 'suspendre' ? 'Couverture suspendue' : 'Couverture réactivée',
    message,
    urgence: action === 'suspendre' ? 'critical' : 'normal',
    mutuelle_id: mutuelleId,
  })

  // Log audit
  await admin.from('audit_logs').insert({
    actor_id: auth.profileId,
    action: action === 'suspendre' ? 'SUSPEND_ADHERENT' : 'REACTIVATE_ADHERENT',
    target_type: 'contrat',
    target_id: contratId,
    metadata: { raison: raison ?? null, numero_contrat: contrat.numero_contrat },
  }).then(() => {})

  return successResponse({ newStatut, contratId })
})
