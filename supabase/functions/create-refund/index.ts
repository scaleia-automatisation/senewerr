import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

function toStripeParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === null || v === undefined) continue
    if (typeof v === 'object' && !Array.isArray(v)) Object.assign(out, toStripeParams(v as Record<string, unknown>, key))
    else if (Array.isArray(v)) v.forEach((item, i) => { out[`${key}[${i}]`] = String(item) })
    else out[key] = String(v)
  }
  return out
}

async function stripe(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(toStripeParams(body)).toString() : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path}: ${data.error?.message}`)
  return data
}

const ADMIN_ROLES = ['platform_admin', 'super_admin']
const SELF_SERVICE_WINDOW_HOURS = 48

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { paymentId, amount, reason } = await req.json()
    if (!paymentId) return errorResponse('INVALID_PARAMS', 'paymentId est requis')

    // Fetch payment
    const { data: payment, error: payErr } = await db
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle()

    if (payErr) throw payErr
    if (!payment) return errorResponse('PAYMENT_NOT_FOUND', 'Paiement introuvable', 404)

    // Check payment is paid
    if (payment.status !== 'paid') {
      return errorResponse('PAYMENT_NOT_REFUNDABLE', `Ce paiement ne peut pas être remboursé (statut: ${payment.status})`)
    }

    const isAdmin = ADMIN_ROLES.includes(auth.role)
    const isSelf = payment.subscriber_id === auth.profileId

    if (!isAdmin && !isSelf) {
      return errorResponse('FORBIDDEN', 'Accès non autorisé à ce paiement', 403)
    }

    // Self-service: check 48h window
    if (!isAdmin && isSelf) {
      const paidAt = payment.paid_at ? new Date(payment.paid_at) : null
      if (!paidAt) return errorResponse('REFUND_WINDOW_EXPIRED', 'La fenêtre de remboursement a expiré')
      const hoursSincePaid = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60)
      if (hoursSincePaid > SELF_SERVICE_WINDOW_HOURS) {
        return errorResponse('REFUND_WINDOW_EXPIRED', `Les remboursements en libre-service sont disponibles dans les ${SELF_SERVICE_WINDOW_HOURS}h suivant le paiement`)
      }
    }

    if (!payment.provider_payment_id) {
      return errorResponse('NO_PROVIDER_PAYMENT', 'Identifiant de paiement Stripe manquant')
    }

    // Generate idempotency key
    const idempotencyKey = `refund_${paymentId}_${amount ?? 'full'}`

    // Build Stripe refund params
    const refundParams: Record<string, unknown> = {
      payment_intent: payment.provider_payment_id,
      reason: 'requested_by_customer',
      metadata: { medikool_payment_id: paymentId, idempotency_key: idempotencyKey },
    }
    if (amount !== undefined && amount !== null) {
      refundParams.amount = amount
    }

    const stripeRefund = await stripe('POST', '/refunds', refundParams)

    // Insert refund record
    const { data: refundRecord, error: refundErr } = await db
      .from('refunds')
      .insert({
        payment_id: paymentId,
        subscriber_id: payment.subscriber_id,
        status: 'pending',
        amount: stripeRefund.amount,
        currency: stripeRefund.currency,
        reason: reason ?? 'requested_by_customer',
        provider_refund_id: stripeRefund.id,
        requested_by: auth.profileId,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()

    if (refundErr) {
      console.error('Failed to insert refund record:', refundErr)
      // Refund was created on Stripe — log but don't fail the response
    }

    await db.from('domain_events').insert({
      event_type: 'REFUND_REQUESTED',
      payload: { paymentId, refundId: refundRecord?.id, amount: stripeRefund.amount, requestedBy: auth.profileId },
    })

    return successResponse({
      refundId: refundRecord?.id ?? null,
      stripeRefundId: stripeRefund.id,
      status: 'pending',
      amount: stripeRefund.amount,
      currency: stripeRefund.currency,
    })
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentification requise', 401)
    console.error('create-refund error:', err)
    return errorResponse('INTERNAL_ERROR', err.message ?? 'Erreur interne', 500)
  }
})
