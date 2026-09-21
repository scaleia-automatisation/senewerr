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
  const {
    planId,
    nom, montant_cotisation,
    plafond_consultation, plafond_pharma, plafond_hospit, plafond_analyses,
    plafond_dentaire, plafond_optique, plafond_annuel,
    taux_consultation, taux_pharma, taux_hospit, taux_analyses,
    delai_carence, max_beneficiaires, actif,
  } = body ?? {}

  // Validation Zod-style serveur
  const errors: string[] = []
  if (!nom || typeof nom !== 'string' || !nom.trim()) errors.push('nom requis')
  if (montant_cotisation == null || Number(montant_cotisation) < 0) errors.push('montant_cotisation ≥ 0')
  const plafonds = [plafond_consultation, plafond_pharma, plafond_hospit, plafond_analyses, plafond_dentaire, plafond_optique, plafond_annuel]
  if (plafonds.some(p => p != null && Number(p) < 0)) errors.push('plafonds doivent être ≥ 0')
  const taux = [taux_consultation, taux_pharma, taux_hospit, taux_analyses]
  if (taux.some(t => t != null && (Number(t) < 0 || Number(t) > 100))) errors.push('taux doivent être entre 0 et 100')
  if (errors.length) return errorResponse('VALIDATION_ERROR', errors.join('; '), 422)

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

  const payload = {
    mutuelle_id: mutuelleId,
    nom: nom.trim(),
    montant_cotisation: Number(montant_cotisation),
    plafond_consultation: plafond_consultation != null ? Number(plafond_consultation) : null,
    plafond_pharma: plafond_pharma != null ? Number(plafond_pharma) : null,
    plafond_hospit: plafond_hospit != null ? Number(plafond_hospit) : null,
    plafond_analyses: plafond_analyses != null ? Number(plafond_analyses) : null,
    plafond_dentaire: plafond_dentaire != null ? Number(plafond_dentaire) : null,
    plafond_optique: plafond_optique != null ? Number(plafond_optique) : null,
    plafond_annuel: plafond_annuel != null ? Number(plafond_annuel) : null,
    taux_consultation: taux_consultation != null ? Number(taux_consultation) : null,
    taux_pharma: taux_pharma != null ? Number(taux_pharma) : null,
    taux_hospit: taux_hospit != null ? Number(taux_hospit) : null,
    taux_analyses: taux_analyses != null ? Number(taux_analyses) : null,
    delai_carence: delai_carence != null ? Number(delai_carence) : 0,
    max_beneficiaires: max_beneficiaires != null ? Number(max_beneficiaires) : null,
    actif: actif !== false,
  }

  if (planId) {
    // Vérifier que ce plan appartient bien à cette mutuelle
    const { data: existing } = await admin.from('plans_mutuelle').select('id').eq('id', planId).eq('mutuelle_id', mutuelleId).single()
    if (!existing) return errorResponse('NOT_FOUND', 'Plan introuvable', 404)
    const { data, error } = await admin.from('plans_mutuelle').update(payload).eq('id', planId).select('id').single()
    if (error) return errorResponse('DB_ERROR', error.message, 500)
    return successResponse({ planId: data?.id, action: 'updated' })
  } else {
    const { data, error } = await admin.from('plans_mutuelle').insert(payload).select('id').single()
    if (error) return errorResponse('DB_ERROR', error.message, 500)
    return successResponse({ planId: data?.id, action: 'created' })
  }
})
