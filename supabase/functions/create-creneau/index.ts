import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body: { date: 'YYYY-MM-DD', heure_debut: 'HH:MM', heure_fin: 'HH:MM',
//         etablissement_id: string, disponible_en_ligne?: boolean }
// Retourne: { slot_id }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }
  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { date, heure_debut, heure_fin, etablissement_id, disponible_en_ligne } = body ?? {}

  if (!date || !heure_debut || !heure_fin || !etablissement_id)
    return errorResponse('INVALID_BODY', 'Champs obligatoires manquants', 400)

  const starts_at = `${date}T${heure_debut}:00`
  const ends_at   = `${date}T${heure_fin}:00`

  if (new Date(starts_at) >= new Date(ends_at))
    return errorResponse('INVALID_TIME', 'Heure de fin doit être après heure de début', 400)
  if (new Date(starts_at) < new Date())
    return errorResponse('INVALID_TIME', 'Créneau dans le passé', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify praticien belongs to établissement
  const { data: rel } = await admin
    .from('praticien_etablissements')
    .select('id')
    .eq('praticien_id', auth.profileId)
    .eq('etablissement_id', etablissement_id)
    .maybeSingle()
  if (!rel) return errorResponse('FORBIDDEN', "Établissement non lié à votre compte", 403)

  const { data: slot, error } = await admin
    .from('appointment_slots')
    .insert({
      professional_id:     auth.profileId,
      establishment_id:    etablissement_id,
      starts_at,
      ends_at,
      status:              'available',
      disponible_en_ligne: disponible_en_ligne ?? false,
    })
    .select('id')
    .single()

  if (error || !slot) return errorResponse('DB_ERROR', 'Erreur création créneau', 500)

  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    action:     'creneau_created',
    table_name: 'appointment_slots',
    metadata:   { slot_id: slot.id, starts_at, ends_at, etablissement_id },
  }).catch(() => {})

  return successResponse({ slot_id: slot.id })
})
