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
  const { contratId, nouvelleDateFin, nouveauMontantCotisation } = body ?? {}
  if (!contratId || !nouvelleDateFin) {
    return errorResponse('INVALID_BODY', 'contratId et nouvelleDateFin requis', 400)
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

  const { data: contrat } = await admin
    .from('contrats')
    .select('id, adherent_id, numero_contrat, statut')
    .eq('id', contratId)
    .eq('mutuelle_id', mutuelleId)
    .single()

  if (!contrat) return errorResponse('NOT_FOUND', 'Contrat introuvable', 404)

  const updatePayload: Record<string, any> = {
    date_fin: nouvelleDateFin,
    statut: 'ACTIF',
    // Réinitialiser les plafonds utilisés pour le nouveau cycle
    plafond_consultation_utilise: 0,
    plafond_pharma_utilise: 0,
    plafond_hospit_utilise: 0,
    plafond_analyses_utilise: 0,
  }
  if (nouveauMontantCotisation != null) {
    updatePayload.montant_cotisation = Number(nouveauMontantCotisation)
  }

  const { error } = await admin.from('contrats').update(updatePayload).eq('id', contratId)
  if (error) return errorResponse('DB_ERROR', error.message, 500)

  // Notifier l'adhérent
  const dateFormatee = new Date(nouvelleDateFin).toLocaleDateString('fr-SN')
  await admin.from('notifications').insert({
    profile_id: contrat.adherent_id,
    type: 'contrat_renouvele',
    titre: 'Contrat renouvelé',
    message: `Votre contrat ${contrat.numero_contrat} a été renouvelé jusqu'au ${dateFormatee}. Vos plafonds ont été réinitialisés.`,
    urgence: 'info',
    mutuelle_id: mutuelleId,
  })

  return successResponse({ contratId, nouvelleDateFin, statut: 'ACTIF' })
})
