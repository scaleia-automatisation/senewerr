import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try {
    auth = await requireAuth(req)
  } catch {
    return errorResponse('UNAUTHORIZED', 'Non autorisé', 401)
  }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { type, contratIds, demandeIds } = body ?? {}

  if (!type || (!contratIds?.length && !demandeIds?.length)) {
    return errorResponse('INVALID_BODY', 'type et ids requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier appartenance à la mutuelle du gestionnaire
  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const sent: string[] = []

  if (type === 'cotisation_rappel' && contratIds?.length) {
    const { data: contrats } = await admin
      .from('contrats')
      .select('id, adherent_id, montant_cotisation, profiles!contrats_adherent_id_fkey(full_name, telephone, email)')
      .eq('mutuelle_id', mutuelleId)
      .in('id', contratIds)

    for (const c of contrats ?? []) {
      const profile = (c as any).profiles
      await admin.from('notifications').insert({
        profile_id: c.adherent_id,
        type: 'cotisation_rappel',
        titre: 'Rappel de cotisation',
        message: `Votre cotisation de ${c.montant_cotisation} FCFA est en retard. Merci de régulariser votre situation.`,
        urgence: 'warning',
        mutuelle_id: mutuelleId,
      })
      sent.push(c.id)
    }
  }

  if (type === 'renouvellement' && contratIds?.length) {
    const { data: contrats } = await admin
      .from('contrats')
      .select('id, adherent_id, date_fin, numero_contrat')
      .eq('mutuelle_id', mutuelleId)
      .in('id', contratIds)

    for (const c of contrats ?? []) {
      await admin.from('notifications').insert({
        profile_id: c.adherent_id,
        type: 'contrat_expiration',
        titre: 'Renouvellement de contrat',
        message: `Votre contrat ${c.numero_contrat} expire le ${new Date(c.date_fin).toLocaleDateString('fr-FR')}. Contactez votre mutuelle pour le renouveler.`,
        urgence: 'warning',
        mutuelle_id: mutuelleId,
      })
      sent.push(c.id)
    }
  }

  return successResponse({ sent, count: sent.length })
})
