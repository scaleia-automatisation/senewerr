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
  if (!demandeId || !motif?.trim()) {
    return errorResponse('INVALID_BODY', 'demandeId et motif requis', 400)
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

  const { data: demande } = await admin
    .from('tiers_payant_demandes')
    .select('id, statut, adherent_id, pharmacie_id, praticien_id, type, numero_tp')
    .eq('id', demandeId)
    .eq('mutuelle_id', mutuelleId)
    .single()

  if (!demande) return errorResponse('NOT_FOUND', 'Demande TP introuvable', 404)
  if (!['pending', 'approved'].includes(demande.statut)) {
    return errorResponse('INVALID_STATE', 'Demande non refusable dans cet état', 400)
  }

  await admin.from('tiers_payant_demandes').update({
    statut: 'refused',
    motif_refus: motif.trim(),
    traite_par: auth.profileId,
    traite_at: new Date().toISOString(),
  }).eq('id', demandeId)

  // Notifier l'adhérent
  await admin.from('notifications').insert({
    profile_id: demande.adherent_id,
    type: 'tiers_payant_refuse',
    titre: 'Prise en charge refusée',
    message: `Votre prise en charge directe (réf. ${demande.numero_tp}) a été refusée. Motif : ${motif.trim()}`,
    urgence: 'warning',
    mutuelle_id: mutuelleId,
  })

  // Notifier le prestataire
  const targetId = demande.pharmacie_id ?? demande.praticien_id
  const targetTable = demande.type === 'pharmacie' ? 'pharmacies' : 'praticiens'
  if (targetId) {
    const { data: target } = await admin.from(targetTable).select('profile_id').eq('id', targetId).single()
    if (target?.profile_id) {
      await admin.from('notifications').insert({
        profile_id: target.profile_id,
        type: 'tp_refuse',
        titre: 'Tiers payant refusé',
        message: `Votre demande tiers payant ${demande.numero_tp} a été refusée. Motif : ${motif.trim()}`,
        urgence: 'warning',
        mutuelle_id: mutuelleId,
      })
    }
  }

  return successResponse({ demandeId, statut: 'refused' })
})
