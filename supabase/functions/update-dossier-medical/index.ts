import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body: { patient_id, allergies?, pathologies_chroniques?, antecedents_medicaux?,
//         antecedents_chirurgicaux?, antecedents_familiaux?, vaccinations?,
//         traitements_chroniques?, groupe_sanguin? }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { patient_id, ...fields } = body ?? {}
  if (!patient_id) return errorResponse('INVALID_BODY', 'patient_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify active care relationship (RLS enforcement at EF level)
  const { data: rel } = await admin
    .from('praticien_patients')
    .select('id')
    .eq('praticien_id', auth.profileId)
    .eq('patient_id', patient_id)
    .eq('actif', true)
    .maybeSingle()

  if (!rel) {
    return errorResponse('FORBIDDEN', 'Pas de relation de soin active avec ce patient', 403)
  }

  // Allowed fields only — never trust client to set arbitrary columns
  const allowed = [
    'allergies', 'pathologies_chroniques', 'antecedents_medicaux',
    'antecedents_chirurgicaux', 'antecedents_familiaux', 'vaccinations',
    'traitements_chroniques', 'groupe_sanguin',
  ]
  const patch: Record<string, unknown> = { patient_id }
  for (const key of allowed) {
    if (key in fields) patch[key] = fields[key]
  }
  patch.updated_at = new Date().toISOString()

  const { error } = await admin
    .from('dossiers_medicaux')
    .upsert(patch, { onConflict: 'patient_id' })

  if (error) return errorResponse('DB_ERROR', error.message, 500)

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  patient_id,
    action:     'dossier_updated',
    table_name: 'dossiers_medicaux',
    metadata:   { fields_updated: Object.keys(patch).filter(k => k !== 'patient_id' && k !== 'updated_at') },
  }).catch(() => {})

  return successResponse({ ok: true })
})
