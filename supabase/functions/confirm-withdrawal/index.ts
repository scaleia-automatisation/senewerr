import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  const pa = a.padEnd(64, '\0')
  const pb = b.padEnd(64, '\0')
  let diff = 0
  for (let i = 0; i < 64; i++) diff |= pa.charCodeAt(i) ^ pb.charCodeAt(i)
  return diff === 0 && a.length === b.length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — pharmacy staff
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (!['pharmacy_admin', 'pharmacy_staff'].includes(auth.role))
    return errorResponse('FORBIDDEN', 'Pharmacy staff only', 403)

  const body = await req.json().catch(() => null)
  if (!body?.reservationId || !body?.code)
    return errorResponse('BAD_REQUEST', 'reservationId and code are required', 400)

  const { reservationId, code } = body as { reservationId: string; code: string }
  const supabase = db()

  // 2. Fetch reservation — verify pharmacy ownership
  const { data: reservation, error: fetchErr } = await supabase
    .from('pharmacy_reservations')
    .select(`
      id, pharmacy_id, preparation_status, withdrawal_status, reservation_code,
      reservation_number, patient_id,
      withdrawal_failed_attempts, withdrawal_locked_until,
      reservation_items(id, product_id, quantity)
    `)
    .eq('id', reservationId)
    .single()

  if (fetchErr || !reservation) return errorResponse('NOT_FOUND', 'Réservation introuvable', 404)
  if (!auth.orgIds.includes(reservation.pharmacy_id))
    return errorResponse('FORBIDDEN', 'Cette réservation n\'appartient pas à votre pharmacie', 403)

  // 3. Check statuses
  if (reservation.preparation_status !== 'ready')
    return errorResponse('INVALID_STATUS', 'La réservation n\'est pas encore prête', 422)
  if (reservation.withdrawal_status !== 'pending')
    return errorResponse('INVALID_STATUS', `Retrait déjà: ${reservation.withdrawal_status}`, 422)

  // 4. Check lock
  if (reservation.withdrawal_locked_until) {
    const lockedUntil = new Date(reservation.withdrawal_locked_until)
    if (lockedUntil > new Date()) {
      const diffMin = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      return new Response(
        JSON.stringify({ error: { code: 'WITHDRAWAL_LOCKED', message: `Trop de tentatives, réessayez dans ${diffMin} minute(s)` } }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  const submittedCode = String(code).trim()
  const storedCode = String(reservation.reservation_code).trim()

  // 5. Compare code (timing-safe)
  if (!timingSafeEqual(submittedCode, storedCode)) {
    // 6. Wrong code handling
    const currentAttempts = reservation.withdrawal_failed_attempts ?? 0
    const newAttempts = currentAttempts + 1

    const updatePayload: Record<string, unknown> = {}

    if (newAttempts >= MAX_ATTEMPTS) {
      // 6b. Lock for 15 minutes and reset counter
      updatePayload.withdrawal_locked_until = new Date(Date.now() + LOCK_DURATION_MS).toISOString()
      updatePayload.withdrawal_failed_attempts = 0
    } else {
      // 6c. Increment counter
      updatePayload.withdrawal_failed_attempts = newAttempts
    }

    await supabase
      .from('pharmacy_reservations')
      .update(updatePayload)
      .eq('id', reservationId)

    // 6d. Security event
    await supabase.from('security_events').insert({
      type: 'withdrawal_code_failure',
      entity_id: reservationId,
      actor_id: auth.profileId,
      metadata: {
        attempt: newAttempts,
        locked: newAttempts >= MAX_ATTEMPTS,
      },
    })

    // 6e. Return error
    const displayAttempt = Math.min(newAttempts, MAX_ATTEMPTS)
    const suffix = newAttempts >= MAX_ATTEMPTS ? ' — compte bloqué 15 min' : ''
    return errorResponse(
      'WITHDRAWAL_CODE_INVALID',
      `Code incorrect (${displayAttempt}/${MAX_ATTEMPTS})${suffix}`,
      400,
    )
  }

  // 7. Code correct
  const now = new Date().toISOString()

  // 7a. Update withdrawal status
  const { error: updateErr } = await supabase
    .from('pharmacy_reservations')
    .update({
      withdrawal_status: 'withdrawn',
      withdrawn_at: now,
      withdrawal_failed_attempts: 0,
      withdrawal_locked_until: null,
    })
    .eq('id', reservationId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // 7b. Deduct from stock definitively for each item
  for (const item of (reservation.reservation_items as any[]) ?? []) {
    const { data: product } = await supabase
      .from('pharmacy_products')
      .select('stock_quantity, reserved_quantity')
      .eq('id', item.product_id)
      .single()

    if (product) {
      await supabase
        .from('pharmacy_products')
        .update({
          stock_quantity: Math.max(0, product.stock_quantity - item.quantity),
          reserved_quantity: Math.max(0, product.reserved_quantity - item.quantity),
        })
        .eq('id', item.product_id)
    }

    await supabase.from('pharmacy_stock_movements').insert({
      product_id: item.product_id,
      delta: -item.quantity,
      movement_type: 'withdraw',
      reservation_id: reservationId,
    })
  }

  // 7c. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'ORDER_WITHDRAWN',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
    patient_id: reservation.patient_id,
  })

  // 7d. Notify patient
  await supabase.from('notifications').insert({
    recipient_id: reservation.patient_id,
    type: 'ORDER_WITHDRAWN',
    title: 'Retrait confirmé ✅',
    body: `Votre commande ${reservation.reservation_number} a été retirée avec succès`,
    reference_id: reservationId,
  })

  // 7e. Return
  return successResponse({ message: 'Retrait confirmé — commande terminée' })
})
