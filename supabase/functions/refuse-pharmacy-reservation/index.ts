import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type RefusalReason = 'insufficient_stock' | 'prescription_issue' | 'product_unavailable' | 'price' | 'other'

const VALID_REASONS: RefusalReason[] = [
  'insufficient_stock',
  'prescription_issue',
  'product_unavailable',
  'price',
  'other',
]

const REASON_LABELS: Record<RefusalReason, string> = {
  insufficient_stock: 'Stock insuffisant',
  prescription_issue: 'Problème d\'ordonnance',
  product_unavailable: 'Produit non disponible',
  price: 'Problème de tarif',
  other: 'Autre raison',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — pharmacy staff
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (!['pharmacy_admin', 'pharmacy_staff'].includes(auth.role))
    return errorResponse('FORBIDDEN', 'Pharmacy staff only', 403)

  const body = await req.json().catch(() => null)
  if (!body?.reservationId || !body?.reason)
    return errorResponse('BAD_REQUEST', 'reservationId and reason are required', 400)

  const { reservationId, reason, comment } = body as {
    reservationId: string
    reason: string
    comment?: string
  }

  // 3. Validate reason
  if (!VALID_REASONS.includes(reason as RefusalReason))
    return errorResponse('INVALID_REASON', `reason must be one of: ${VALID_REASONS.join(', ')}`, 400)

  const supabase = db()

  // 2. Fetch reservation — verify pharmacy ownership
  const { data: reservation, error: fetchErr } = await supabase
    .from('pharmacy_reservations')
    .select(`
      id, pharmacy_id, pharmacy_status, reservation_number, patient_id,
      reservation_items(id, product_id, quantity)
    `)
    .eq('id', reservationId)
    .single()

  if (fetchErr || !reservation) return errorResponse('NOT_FOUND', 'Réservation introuvable', 404)
  if (!auth.orgIds.includes(reservation.pharmacy_id))
    return errorResponse('FORBIDDEN', 'Cette réservation n\'appartient pas à votre pharmacie', 403)

  // Guard: can only refuse non-terminal reservations
  const terminalStatuses = ['refused', 'cancelled', 'expired', 'withdrawn']
  if (terminalStatuses.includes(reservation.pharmacy_status))
    return errorResponse('INVALID_STATUS', `Impossible de refuser une réservation en statut: ${reservation.pharmacy_status}`, 422)

  // 4. Update pharmacy_reservations
  const refusalNote = comment?.trim() ? `${reason}:${comment.trim()}` : reason
  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from('pharmacy_reservations')
    .update({
      pharmacy_status: 'refused',
      pharmacy_refusal_reason: refusalNote,
      cancelled_at: now,
    })
    .eq('id', reservationId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // 5. Release stock for each item
  for (const item of (reservation.reservation_items as any[]) ?? []) {
    const { data: product } = await supabase
      .from('pharmacy_products')
      .select('reserved_quantity')
      .eq('id', item.product_id)
      .single()

    if (product) {
      await supabase
        .from('pharmacy_products')
        .update({ reserved_quantity: Math.max(0, product.reserved_quantity - item.quantity) })
        .eq('id', item.product_id)
    }

    await supabase.from('pharmacy_stock_movements').insert({
      product_id: item.product_id,
      delta: item.quantity,
      movement_type: 'release',
      reservation_id: reservationId,
      reason: `Réservation refusée: ${reason}`,
    })
  }

  // 6. Expire prescription share if exists
  await supabase
    .from('prescription_shares')
    .update({ status: 'expired' })
    .eq('reservation_id', reservationId)
    .eq('status', 'active')

  // 7. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'PHARMACY_REFUSED',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
    patient_id: reservation.patient_id,
  })

  // 8. Notify patient with refusal reason
  const humanReason = REASON_LABELS[reason as RefusalReason]
  const refusalDetail = reason === 'other' && comment ? comment : humanReason

  await supabase.from('notifications').insert({
    recipient_id: reservation.patient_id,
    type: 'RESERVATION_REFUSED',
    title: 'Réservation refusée',
    body: `Votre réservation ${reservation.reservation_number} a été refusée : ${refusalDetail}`,
    reference_id: reservationId,
  })

  return successResponse({ message: 'Réservation refusée et stock libéré' })
})
