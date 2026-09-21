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

  if (auth.role !== 'professional') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { appointment_id, duration_minutes } = body ?? {}
  if (!appointment_id) return errorResponse('INVALID_BODY', 'appointment_id requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier ownership
  const { data: appt } = await admin
    .from('appointments')
    .select('id, professional_id, status, started_at')
    .eq('id', appointment_id)
    .single()

  if (!appt) return errorResponse('NOT_FOUND', 'Rendez-vous introuvable', 404)
  if (appt.professional_id !== auth.profileId) return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  if (appt.status !== 'in_consultation') {
    return errorResponse('INVALID_STATUS', 'La consultation n\'est pas en cours', 409)
  }

  const endedAt = new Date().toISOString()

  // Calculer la durée si non fournie
  let duration = duration_minutes
  if (!duration && appt.started_at) {
    const startMs = new Date(appt.started_at).getTime()
    duration = Math.round((Date.now() - startMs) / 60000)
  }

  const { error } = await admin
    .from('appointments')
    .update({
      status: 'completed',
      ended_at: endedAt,
      duration_minutes: duration ?? null,
    })
    .eq('id', appointment_id)

  if (error) return errorResponse('DB_ERROR', 'Erreur mise à jour', 500)

  return successResponse({ ok: true, ended_at: endedAt, duration_minutes: duration })
})
