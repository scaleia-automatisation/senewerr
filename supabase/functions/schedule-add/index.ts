import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const DEFAULT_SLOT_DURATION = 30 // minutes
const SLOT_GENERATION_DAYS = 60

/** Parse "HH:MM" into total minutes since midnight */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Format total minutes as "HH:MM" */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0')
  const m = (mins % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/** Build a UTC ISO datetime string from a local date + "HH:MM" time string */
function buildSlotDateTime(date: Date, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(date)
  dt.setUTCHours(h, m, 0, 0)
  return dt.toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — professional or establishment admin
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (!['professional', 'establishment_admin', 'clinic_admin', 'hospital_admin'].includes(auth.role))
    return errorResponse('FORBIDDEN', 'Professional or establishment admin only', 403)

  const body = await req.json().catch(() => null)
  if (!body) return errorResponse('BAD_REQUEST', 'Invalid JSON', 400)

  const {
    professionalId,
    establishmentId,
    dayOfWeek,
    startTime,
    endTime,
    slotDuration,
    breakStart,
    breakEnd,
    validFrom,
    validUntil,
  } = body as {
    professionalId: string
    establishmentId: string
    dayOfWeek: number
    startTime: string
    endTime: string
    slotDuration?: number
    breakStart?: string
    breakEnd?: string
    validFrom: string
    validUntil?: string
  }

  // 2. Validate inputs
  if (!professionalId) return errorResponse('BAD_REQUEST', 'professionalId is required', 400)
  if (!establishmentId) return errorResponse('BAD_REQUEST', 'establishmentId is required', 400)
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
    return errorResponse('BAD_REQUEST', 'dayOfWeek must be an integer 0–6 (0=Sunday)', 400)
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime))
    return errorResponse('BAD_REQUEST', 'startTime must be in HH:MM format', 400)
  if (!endTime || !/^\d{2}:\d{2}$/.test(endTime))
    return errorResponse('BAD_REQUEST', 'endTime must be in HH:MM format', 400)
  if (parseTimeToMinutes(startTime) >= parseTimeToMinutes(endTime))
    return errorResponse('BAD_REQUEST', 'startTime must be before endTime', 400)
  if (!validFrom || isNaN(Date.parse(validFrom)))
    return errorResponse('BAD_REQUEST', 'validFrom must be a valid date string (YYYY-MM-DD)', 400)

  const duration = slotDuration ?? DEFAULT_SLOT_DURATION
  if (!Number.isInteger(duration) || duration < 5 || duration > 480)
    return errorResponse('BAD_REQUEST', 'slotDuration must be an integer between 5 and 480 minutes', 400)

  const breakStartMins = breakStart ? parseTimeToMinutes(breakStart) : null
  const breakEndMins = breakEnd ? parseTimeToMinutes(breakEnd) : null
  if (breakStart && breakEnd && breakStartMins! >= breakEndMins!)
    return errorResponse('BAD_REQUEST', 'breakStart must be before breakEnd', 400)

  const supabase = db()

  // 3. Insert schedule record
  const { data: schedule, error: schedErr } = await supabase
    .from('schedules')
    .insert({
      professional_id: professionalId,
      establishment_id: establishmentId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      slot_duration_minutes: duration,
      break_start: breakStart ?? null,
      break_end: breakEnd ?? null,
      valid_from: validFrom,
      valid_until: validUntil ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (schedErr || !schedule) return errorResponse('DB_ERROR', schedErr?.message ?? 'Could not create schedule', 500)

  // 4. Generate appointment slots for next SLOT_GENERATION_DAYS days starting validFrom
  const startMins = parseTimeToMinutes(startTime)
  const endMins = parseTimeToMinutes(endTime)
  const validFromDate = new Date(validFrom + 'T00:00:00Z')
  const validUntilDate = validUntil ? new Date(validUntil + 'T00:00:00Z') : null

  const slotsToInsert: Array<{
    professional_id: string
    establishment_id: string
    schedule_id: string
    starts_at: string
    ends_at: string
    status: string
  }> = []

  for (let d = 0; d < SLOT_GENERATION_DAYS; d++) {
    const candidateDate = new Date(validFromDate.getTime() + d * 24 * 60 * 60 * 1000)

    // Check validUntil boundary
    if (validUntilDate && candidateDate > validUntilDate) break

    // Only generate slots on the matching day of week
    if (candidateDate.getUTCDay() !== dayOfWeek) continue

    // Generate slot starts from startTime to endTime - slotDuration, stepping by slotDuration
    for (let slotStart = startMins; slotStart + duration <= endMins; slotStart += duration) {
      const slotEnd = slotStart + duration

      // Skip slots that overlap with break time
      if (breakStartMins !== null && breakEndMins !== null) {
        // Slot overlaps break if slot starts before break ends AND slot ends after break starts
        const overlapsBreak = slotStart < breakEndMins && slotEnd > breakStartMins
        if (overlapsBreak) continue
      }

      const slotStartStr = minutesToTime(slotStart)
      const slotEndStr = minutesToTime(slotEnd)

      slotsToInsert.push({
        professional_id: professionalId,
        establishment_id: establishmentId,
        schedule_id: schedule.id,
        starts_at: buildSlotDateTime(candidateDate, slotStartStr),
        ends_at: buildSlotDateTime(candidateDate, slotEndStr),
        status: 'available',
      })
    }
  }

  // Insert slots in batches of 100 to avoid payload limits
  const BATCH_SIZE = 100
  let totalInserted = 0

  for (let i = 0; i < slotsToInsert.length; i += BATCH_SIZE) {
    const batch = slotsToInsert.slice(i, i + BATCH_SIZE)
    const { error: slotErr } = await supabase.from('appointment_slots').insert(batch)
    if (slotErr) {
      // Non-fatal: log and continue (partial generation is acceptable — slots can be regenerated)
      console.error(`Error inserting slot batch starting at ${i}: ${slotErr.message}`)
      break
    }
    totalInserted += batch.length
  }

  return successResponse({
    scheduleId: schedule.id,
    slotsGenerated: totalInserted,
  })
})
