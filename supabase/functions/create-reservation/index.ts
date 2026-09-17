import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/** Generate a 5-char uppercase alphanumeric suffix */
function randomAlphaNum(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  const buf = new Uint8Array(len * 2)
  crypto.getRandomValues(buf)
  for (let i = 0; i < buf.length && out.length < len; i++) {
    const idx = buf[i] % chars.length
    out += chars[idx]
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Auth — patient only
  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) } catch { return errorResponse('UNAUTHORIZED', 'Auth required', 401) }
  if (auth.role !== 'patient') return errorResponse('FORBIDDEN', 'Patients only', 403)

  // Parse body
  const body = await req.json().catch(() => null)
  if (!body) return errorResponse('BAD_REQUEST', 'Invalid JSON', 400)

  const { pharmacyId, items, prescriptionId, insuranceMemberId, consentText } = body as {
    pharmacyId: string
    items: Array<{ productId: string; quantity: number }>
    prescriptionId?: string
    insuranceMemberId?: string
    consentText: string
  }

  // 2. Validate
  if (!consentText?.trim()) return errorResponse('CONSENT_REQUIRED', 'consentText is required', 400)
  if (!pharmacyId) return errorResponse('BAD_REQUEST', 'pharmacyId is required', 400)
  if (!Array.isArray(items) || items.length === 0) return errorResponse('BAD_REQUEST', 'items array is required and must not be empty', 400)
  for (const item of items) {
    if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1)
      return errorResponse('BAD_REQUEST', `Invalid item: ${JSON.stringify(item)}`, 400)
  }

  const supabase = db()

  // 3. Get patient_id
  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', auth.profileId)
    .single()
  if (patientErr || !patient) return errorResponse('PATIENT_NOT_FOUND', 'Patient profile not found', 404)

  // 4. Verify pharmacy — establishments → organizations join
  const { data: establishment, error: estErr } = await supabase
    .from('establishments')
    .select(`
      id, open_for_reservations,
      organizations!inner(id, status, verification_status)
    `)
    .eq('id', pharmacyId)
    .single()

  if (estErr || !establishment) return errorResponse('PHARMACY_NOT_FOUND', 'Pharmacy not found', 404)
  const org = (establishment as any).organizations
  if (org.status !== 'active' || org.verification_status !== 'verified')
    return errorResponse('PHARMACY_NOT_FOUND', 'Pharmacy is inactive or not verified', 404)
  if (!establishment.open_for_reservations)
    return errorResponse('PHARMACY_CLOSED_FOR_RESERVATIONS', 'Cette pharmacie n\'accepte pas les réservations', 409)

  // 6. Validate prescription if provided
  if (prescriptionId) {
    const { data: rx, error: rxErr } = await supabase
      .from('prescriptions')
      .select('id, status, valid_until')
      .eq('id', prescriptionId)
      .eq('patient_id', patient.id)
      .single()
    if (rxErr || !rx) return errorResponse('PRESCRIPTION_NOT_FOUND', 'Ordonnance introuvable', 404)
    const validStatuses = ['available_patient', 'shared_pharmacy', 'validated_pharmacy']
    if (!validStatuses.includes(rx.status))
      return errorResponse('PRESCRIPTION_INVALID', 'Statut d\'ordonnance invalide', 422)
    if (rx.valid_until && new Date(rx.valid_until) < new Date())
      return errorResponse('PRESCRIPTION_EXPIRED', 'Ordonnance expirée', 422)
  }

  // 5. Check stock for each item
  const productRows: Array<{
    id: string
    product_name: string
    available_quantity: number
    reserved_quantity: number
    price: number
    prescription_required: boolean
    requestedQty: number
  }> = []

  for (const item of items) {
    const { data: product, error: prodErr } = await supabase
      .from('pharmacy_products')
      .select('id, product_name, available_quantity, reserved_quantity, price, prescription_required, is_active')
      .eq('id', item.productId)
      .eq('pharmacy_id', pharmacyId)
      .single()

    if (prodErr || !product) return errorResponse('PRODUCT_NOT_FOUND', `Produit ${item.productId} introuvable`, 404)
    if (!product.is_active) return errorResponse('PRODUCT_UNAVAILABLE', `${product.product_name} n'est plus disponible`, 422)

    const available = product.available_quantity - product.reserved_quantity
    if (available < item.quantity)
      return errorResponse('STOCK_INSUFFICIENT', `${product.product_name}: seulement ${available} disponible(s)`, 422)

    if (product.prescription_required && !prescriptionId)
      return errorResponse('PRESCRIPTION_REQUIRED', `${product.product_name} nécessite une ordonnance`, 422)

    productRows.push({ ...product, requestedQty: item.quantity })
  }

  // 7. Calculate amounts server-side
  const subtotal = productRows.reduce((s, p) => s + p.price * p.requestedQty, 0)
  const totalAmount = subtotal // no tax

  // 8. Generate reservation number
  const reservationNumber = 'MED-' + randomAlphaNum(5)

  // 9. Generate reservation code via DB function
  const { data: codeData } = await supabase.rpc('generate_reservation_code')
  const reservationCode: string = codeData ?? randomAlphaNum(8)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // 10. Insert pharmacy_reservation
  const { data: reservation, error: resErr } = await supabase
    .from('pharmacy_reservations')
    .insert({
      patient_id: patient.id,
      pharmacy_id: pharmacyId,
      prescription_id: prescriptionId ?? null,
      insurance_member_id: insuranceMemberId ?? null,
      reservation_number: reservationNumber,
      reservation_code: reservationCode,
      subtotal,
      total_amount: totalAmount,
      patient_amount: totalAmount,
      insurance_amount: 0,
      insurance_status: insuranceMemberId ? 'pending' : 'none',
      patient_payment_status: 'pending',
      prescription_check_status: prescriptionId ? 'pending' : 'not_required',
      pharmacy_status: 'pending',
      expires_at: expiresAt,
      consent_text: consentText,
      consent_given_at: now.toISOString(),
    })
    .select('id')
    .single()

  if (resErr || !reservation) return errorResponse('DB_ERROR', resErr?.message ?? 'Could not create reservation', 500)

  const reservationId = reservation.id
  const processedItems: string[] = [] // product ids already updated (for rollback)

  // 11. Insert items + update stock + insert stock movements
  for (const p of productRows) {
    const itemSubtotal = p.price * p.requestedQty

    const { error: itemErr } = await supabase.from('reservation_items').insert({
      reservation_id: reservationId,
      product_id: p.id,
      product_name: p.product_name,
      quantity: p.requestedQty,
      unit_price: p.price,
      subtotal: itemSubtotal,
    })
    if (itemErr) {
      // Rollback: release stock for already-processed items
      for (const pid of processedItems) {
        const proc = productRows.find((x) => x.id === pid)!
        await supabase.from('pharmacy_products')
          .update({ reserved_quantity: supabase.rpc('increment', { x: -proc.requestedQty }) as any })
          .eq('id', pid)
      }
      return errorResponse('DB_ERROR', `Erreur insertion article: ${itemErr.message}`, 500)
    }

    const { data: current } = await supabase
      .from('pharmacy_products')
      .select('reserved_quantity')
      .eq('id', p.id)
      .single()

    const { error: stockErr } = await supabase
      .from('pharmacy_products')
      .update({ reserved_quantity: (current?.reserved_quantity ?? 0) + p.requestedQty })
      .eq('id', p.id)

    if (stockErr) {
      // Rollback already updated products
      for (const pid of processedItems) {
        const proc = productRows.find((x) => x.id === pid)!
        const { data: cur2 } = await supabase.from('pharmacy_products').select('reserved_quantity').eq('id', pid).single()
        if (cur2) await supabase.from('pharmacy_products').update({ reserved_quantity: Math.max(0, cur2.reserved_quantity - proc.requestedQty) }).eq('id', pid)
      }
      return errorResponse('DB_ERROR', `Erreur mise à jour stock: ${stockErr.message}`, 500)
    }

    processedItems.push(p.id)

    await supabase.from('pharmacy_stock_movements').insert({
      product_id: p.id,
      delta: -p.requestedQty,
      movement_type: 'reserve',
      reservation_id: reservationId,
    })
  }

  // 12. Prescription share + consent
  let prescriptionShareId: string | null = null
  if (prescriptionId) {
    const { data: share, error: shareErr } = await supabase
      .from('prescription_shares')
      .insert({
        prescription_id: prescriptionId,
        patient_id: patient.id,
        pharmacy_id: pharmacyId,
        shared_by: auth.profileId,
        status: 'active',
        valid_until: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        reservation_id: reservationId,
        purpose: 'reservation',
      })
      .select('id')
      .single()

    if (!shareErr && share) {
      prescriptionShareId = share.id
      await supabase.from('consents').insert({
        type: 'prescription_share',
        patient_id: patient.id,
        reference_id: share.id,
        reference_type: 'prescription_share',
      })
    }
  }

  // 13. Coverage request
  if (insuranceMemberId) {
    await supabase.from('coverage_requests').insert({
      reservation_id: reservationId,
      insurance_member_id: insuranceMemberId,
      requested_amount: totalAmount,
      status: 'pending',
      sla_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // 14. Domain event
  await supabase.from('domain_events').insert({
    event_type: 'PHARMACY_RESERVATION_CREATED',
    entity_type: 'pharmacy_reservation',
    entity_id: reservationId,
    actor_id: auth.profileId,
    patient_id: patient.id,
  })

  // 15. Notify pharmacy staff
  await supabase.from('notifications').insert({
    recipient_role: 'pharmacy_staff',
    organization_id: pharmacyId,
    type: 'NEW_RESERVATION',
    title: 'Nouvelle réservation',
    body: `Réservation ${reservationNumber} reçue — ${productRows.length} article(s)`,
    reference_id: reservationId,
  })

  // 16. Return
  return successResponse({ reservationId, reservationNumber, reservationCode, status: 'pending' }, 201)
})
