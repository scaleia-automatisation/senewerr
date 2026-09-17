import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — pharmacy staff
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (!['pharmacy_admin', 'pharmacy_staff'].includes(auth.role))
    return errorResponse('FORBIDDEN', 'Pharmacy staff only', 403)

  const body = await req.json().catch(() => null)
  if (!body?.reservationId) return errorResponse('BAD_REQUEST', 'reservationId is required', 400)

  const { reservationId } = body as { reservationId: string }
  const supabase = db()

  // 2. Fetch reservation — verify pharmacy ownership
  const { data: reservation, error: fetchErr } = await supabase
    .from('pharmacy_reservations')
    .select('id, pharmacy_id, pharmacy_status, expires_at, reservation_number, patient_id')
    .eq('id', reservationId)
    .single()

  if (fetchErr || !reservation) return errorResponse('NOT_FOUND', 'Réservation introuvable', 404)

  // 2b. Verify caller's org includes the pharmacy
  if (!auth.orgIds.includes(reservation.pharmacy_id))
    return errorResponse('FORBIDDEN', 'Cette réservation n\'appartient pas à votre pharmacie', 403)

  // 3. Check status and expiry
  if (reservation.pharmacy_status !== 'pending')
    return errorResponse('INVALID_STATUS', `Statut actuel: ${reservation.pharmacy_status} (attendu: pending)`, 422)
  if (new Date(reservation.expires_at) <= new Date())
    return errorResponse('RESERVATION_EXPIRED', 'Réservation expirée', 422)

  // 4. Update pharmacy_status to confirmed
  const { error: updateErr } = await supabase
    .from('pharmacy_reservations')
    .update({ pharmacy_status: 'confirmed' })
    .eq('id', reservationId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // 5. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'PHARMACY_CONFIRMED',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
  })

  // 6. Notify patient
  const { data: pharmacyOrg } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', reservation.pharmacy_id)
    .single()

  const pharmacyName = (pharmacyOrg as any)?.name ?? 'La pharmacie'

  await supabase.from('notifications').insert({
    recipient_id: reservation.patient_id,
    type: 'RESERVATION_CONFIRMED',
    title: 'Réservation acceptée',
    body: `${pharmacyName} a accepté votre réservation ${reservation.reservation_number}`,
    reference_id: reservationId,
  })

  // 7. Return success
  return successResponse({ message: 'Réservation confirmée avec succès' })
})
