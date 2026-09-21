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

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { date_debut, date_fin, motif, type = 'conge' } = body ?? {}
  if (!date_debut || !date_fin) {
    return errorResponse('INVALID_BODY', 'date_debut et date_fin requis (YYYY-MM-DD)', 400)
  }

  if (new Date(date_debut) > new Date(date_fin)) {
    return errorResponse('INVALID_RANGE', 'date_debut doit être avant date_fin', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await admin
    .from('schedule_exceptions')
    .insert({
      profile_id:  auth.profileId,
      date_debut,
      date_fin,
      motif:       motif ?? null,
      type,
      is_available: false,
    })
    .select('id')
    .single()

  if (error) return errorResponse('DB_ERROR', error.message, 500)

  return successResponse({ ok: true, exception_id: data?.id })
})
