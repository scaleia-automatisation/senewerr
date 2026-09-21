import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body (deux modes) :
//   Mode A — scan QR : { qr_token: string }
//   Mode B — sélection : { patient_id: string, mutuelle_id?: string }
//
// Retourne :
//   { adhesion_id, patient_nom, numero_contrat, mutuelle_id, mutuelle_nom,
//     plan, plafond_restant, statut: 'valide'|'suspendu'|'expire', raison? }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { qr_token, patient_id, mutuelle_id } = body ?? {}

  if (!qr_token && !patient_id) {
    return errorResponse('INVALID_BODY', 'qr_token ou patient_id requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let adhesion: any = null

  if (qr_token) {
    // Mode A : lookup par QR token hashé
    const { data } = await admin.from('adhesions_mutuelles')
      .select(`
        id, patient_id, numero_contrat, plan, statut, plafond_restant_consultation,
        date_expiration, raison_suspension,
        patient:patient_id ( full_name ),
        mutuelle:mutuelle_id ( id, nom, logo_url )
      `)
      .eq('qr_token', qr_token)
      .maybeSingle()
    adhesion = data
  } else {
    // Mode B : lookup par patient_id (+ mutuelle_id optionnel)
    let q = admin.from('adhesions_mutuelles')
      .select(`
        id, patient_id, numero_contrat, plan, statut, plafond_restant_consultation,
        date_expiration, raison_suspension,
        patient:patient_id ( full_name ),
        mutuelle:mutuelle_id ( id, nom, logo_url )
      `)
      .eq('patient_id', patient_id)

    if (mutuelle_id) q = q.eq('mutuelle_id', mutuelle_id)

    // Prend la plus récente couverture valide en premier
    q = q.order('created_at', { ascending: false }).limit(1)
    const { data } = await q.maybeSingle()
    adhesion = data
  }

  if (!adhesion) {
    return errorResponse('NOT_FOUND', 'Aucune couverture mutuelle trouvée pour ce patient', 404)
  }

  // Recompute effective status (expiration check)
  let effectiveStatut: 'valide' | 'suspendu' | 'expire' = adhesion.statut

  if (effectiveStatut === 'valide' && adhesion.date_expiration) {
    if (new Date(adhesion.date_expiration) < new Date()) {
      effectiveStatut = 'expire'
    }
  }

  // Verify the praticien is conventioned with this mutuelle
  const { data: convention } = await admin.from('conventions_praticien_mutuelle')
    .select('id, taux_prise_en_charge, statut, date_fin')
    .eq('praticien_id', auth.profileId)
    .eq('mutuelle_id', adhesion.mutuelle?.id)
    .maybeSingle()

  // Audit log (read of patient coverage info)
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  adhesion.patient_id,
    action:     'carte_mutuelle_verified',
    table_name: 'adhesions_mutuelles',
    metadata:   { adhesion_id: adhesion.id, statut: effectiveStatut },
  }).catch(() => {})

  return successResponse({
    adhesion_id:       adhesion.id,
    patient_id:        adhesion.patient_id,
    patient_nom:       adhesion.patient?.full_name ?? '—',
    numero_contrat:    adhesion.numero_contrat,
    mutuelle_id:       adhesion.mutuelle?.id ?? null,
    mutuelle_nom:      adhesion.mutuelle?.nom ?? '—',
    mutuelle_logo:     adhesion.mutuelle?.logo_url ?? null,
    plan:              adhesion.plan ?? null,
    plafond_restant:   adhesion.plafond_restant_consultation ?? null,
    date_expiration:   adhesion.date_expiration ?? null,
    statut:            effectiveStatut,
    raison:            effectiveStatut !== 'valide' ? (adhesion.raison_suspension ?? 'Couverture non valide') : null,
    convention_active: convention?.statut === 'active',
    taux_prise_en_charge: convention?.taux_prise_en_charge ?? null,
  })
})
