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

  // 2. Fetch reservation — verify pharmacy ownership and preparation_status
  const { data: reservation, error: fetchErr } = await supabase
    .from('pharmacy_reservations')
    .select('id, pharmacy_id, preparation_status, patient_id, reservation_number, reservation_code')
    .eq('id', reservationId)
    .single()

  if (fetchErr || !reservation) return errorResponse('NOT_FOUND', 'Réservation introuvable', 404)
  if (!auth.orgIds.includes(reservation.pharmacy_id))
    return errorResponse('FORBIDDEN', 'Cette réservation n\'appartient pas à votre pharmacie', 403)
  if (reservation.preparation_status !== 'preparing')
    return errorResponse(
      'INVALID_STATUS',
      `Statut actuel: ${reservation.preparation_status} (attendu: preparing)`,
      422,
    )

  // 3. Update preparation_status to 'ready'
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('pharmacy_reservations')
    .update({ preparation_status: 'ready', ready_at: now })
    .eq('id', reservationId)
  if (updateErr) return errorResponse('DB_ERROR', updateErr.message, 500)

  // 4. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'RESERVATION_READY_FOR_WITHDRAWAL',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
  })

  // 5. Notify patient with reservation code
  await supabase.from('notifications').insert({
    recipient_id: reservation.patient_id,
    type: 'RESERVATION_READY',
    title: 'Votre réservation est prête',
    body: `Votre réservation ${reservation.reservation_number} est prête — code : ${reservation.reservation_code}`,
    reference_id: reservationId,
  })

  return successResponse({ reservationCode: reservation.reservation_code })
})
