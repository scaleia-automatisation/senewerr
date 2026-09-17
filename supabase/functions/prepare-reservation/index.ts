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
    .select('id, pharmacy_id, pharmacy_status, preparation_status, patient_id, reservation_number')
    .eq('id', reservationId)
    .single()

  if (fetchErr || !reservation) return errorResponse('NOT_FOUND', 'Réservation introuvable', 404)
  if (!auth.orgIds.includes(reservation.pharmacy_id))
    return errorResponse('FORBIDDEN', 'Cette réservation n\'appartient pas à votre pharmacie', 403)

  // 3. Call can_prepare DB function: SELECT can_prepare(r.*) FROM pharmacy_reservations r WHERE r.id = $reservationId
  const { data: canPrepareResult, error: rpcErr } = await supabase
    .from('pharmacy_reservations')
    .select('id')
    .eq('id', reservationId)
    .single()
    .then(async () => {
      return await supabase.rpc('can_prepare', { p_reservation_id: reservationId })
    })

  const canPrepare = !rpcErr && canPrepareResult === true

  // 4. If false: return PREPARATION_BLOCKED 409
  if (!canPrepare) {
    return errorResponse(
      'PREPARATION_BLOCKED',
      'Les conditions de préparation ne sont pas remplies (vérifier paiement, mutuelle, ordonnance)',
      409,
    )
  }

  // 5. Update preparation_status to 'preparing'
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('pharmacy_reservations')
    .update({ preparation_status: 'preparing', preparation_started_at: now })
    .eq('id', reservationId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // 6. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'RESERVATION_PREPARATION_STARTED',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
  })

  // 6b. Notify patient
  await supabase.from('notifications').insert({
    recipient_id: reservation.patient_id,
    type: 'RESERVATION_PREPARING',
    title: 'En cours de préparation',
    body: `Votre réservation ${reservation.reservation_number} est en cours de préparation`,
    reference_id: reservationId,
  })

  return successResponse({ message: 'Préparation démarrée', preparationStartedAt: now })
})
