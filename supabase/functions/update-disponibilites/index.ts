import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Jours: { day_of_week: 1-7 (1=Lun), active: bool, start: "HH:MM", end: "HH:MM",
//          break_start?: "HH:MM", break_end?: "HH:MM", slot_duration: 15|20|30|45|60, max_per_day?: number }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { jours } = body ?? {}
  if (!Array.isArray(jours)) return errorResponse('INVALID_BODY', 'jours[] requis', 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Upsert des horaires par jour
  const rows = jours.map((j: any) => ({
    profile_id: auth.profileId,
    day_of_week:    j.day_of_week,
    is_active:      j.active ?? true,
    start_time:     j.start,
    end_time:       j.end,
    break_start:    j.break_start ?? null,
    break_end:      j.break_end   ?? null,
    slot_duration:  j.slot_duration ?? 30,
    max_per_day:    j.max_per_day  ?? null,
  }))

  const { error } = await admin
    .from('professional_schedules')
    .upsert(rows, { onConflict: 'profile_id,day_of_week' })

  if (error) return errorResponse('DB_ERROR', error.message, 500)

  return successResponse({ ok: true, updated: rows.length })
})
