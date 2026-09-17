import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function verifyStripeSignature(payload: string, sigHeader: string): Promise<boolean> {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const parts = sigHeader.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const signature = parts.find(p => p.startsWith('v1='))?.slice(3)
  if (!timestamp || !signature) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const toSign = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign))
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

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
    headers: { 'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body ? new URLSearchParams(toStripeParams(body)).toString() : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path}: ${data.error?.message}`)
  return data
}

serve(async (req) => {
  const payload = await req.text()
  const sigHeader = req.headers.get('stripe-signature') ?? ''
  const valid = await verifyStripeSignature(payload, sigHeader)
  if (!valid) return new Response('Invalid signature', { status: 400 })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const event = JSON.parse(payload)

  // Idempotency check
  const { data: existing } = await db.from('payment_events').select('id').eq('provider_event_id', event.id).maybeSingle()
  if (existing) return new Response('OK', { status: 200 })

  try {
    const obj = event.data.object

    if (event.type === 'checkout.session.completed') {
      const session = obj
      const subscriberId = session.client_reference_id
      const customerId = session.customer

      if (session.mode === 'subscription') {
        const stripeSubId = session.subscription
        const sub = await stripe('GET', `/subscriptions/${stripeSubId}`)
        const priceId = sub.items?.data?.[0]?.price?.id
        const { data: plan } = await db.from('subscription_plans').select('id').or(`stripe_price_monthly_id.eq.${priceId},stripe_price_annual_id.eq.${priceId}`).maybeSingle()

        await db.from('subscriptions').upsert({
          subscriber_id: subscriberId,
          stripe_customer_id: customerId,
          stripe_subscription_id: stripeSubId,
          plan_id: plan?.id,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: 'subscriber_id' })

        // Ensure credit wallet exists
        await db.from('credit_wallets').upsert({ subscriber_id: subscriberId, balance: 0 }, { onConflict: 'subscriber_id', ignoreDuplicates: true })
        // Reset plan credits
        await db.rpc('reset_plan_credits', { p_subscriber_id: subscriberId })

        await db.from('domain_events').insert({ event_type: 'SUBSCRIPTION_ACTIVATED', payload: { subscriberId, stripeSubId } })
      } else if (session.mode === 'payment') {
        const { data: purchase } = await db.from('credit_pack_purchases').select('*, credit_packs(*)').eq('stripe_checkout_session_id', session.id).maybeSingle()
        if (purchase) {
          await db.from('credit_pack_purchases').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', purchase.id)
          const credits = purchase.credit_packs?.credits ?? 0
          await db.from('credit_transactions').insert({ subscriber_id: subscriberId, type: 'pack_purchase', amount: credits, reference_id: purchase.id })
          await db.rpc('increment_wallet_balance', { p_subscriber_id: subscriberId, p_amount: credits })
          await db.from('payments').insert({ subscriber_id: subscriberId, status: 'paid', paid_at: new Date().toISOString(), provider_payment_id: session.payment_intent, amount: session.amount_total, currency: session.currency })
          await db.from('domain_events').insert({ event_type: 'CREDIT_PACK_PURCHASED', payload: { subscriberId, purchaseId: purchase.id, credits } })
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = obj
      const priceId = sub.items?.data?.[0]?.price?.id
      const { data: plan } = await db.from('subscription_plans').select('id').or(`stripe_price_monthly_id.eq.${priceId},stripe_price_annual_id.eq.${priceId}`).maybeSingle()

      const { data: existing_sub } = await db.from('subscriptions').select('status, current_period_end').eq('stripe_subscription_id', sub.id).maybeSingle()
      const newPeriodEnd = new Date(sub.current_period_end * 1000).toISOString()
      const isNewPeriod = existing_sub?.current_period_end !== newPeriodEnd

      await db.from('subscriptions').update({
        status: sub.status,
        plan_id: plan?.id,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: newPeriodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id)

      if (sub.status === 'active' && isNewPeriod) {
        const { data: updated_sub } = await db.from('subscriptions').select('subscriber_id').eq('stripe_subscription_id', sub.id).maybeSingle()
        if (updated_sub) await db.rpc('reset_plan_credits', { p_subscriber_id: updated_sub.subscriber_id })
      }

      await db.from('domain_events').insert({ event_type: 'SUBSCRIPTION_UPDATED', payload: { stripeSubId: sub.id, status: sub.status } })
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = obj
      const { data: canceled_sub } = await db.from('subscriptions').select('subscriber_id').eq('stripe_subscription_id', sub.id).maybeSingle()
      await db.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('stripe_subscription_id', sub.id)
      if (canceled_sub) {
        await db.from('notifications').insert({ recipient_id: canceled_sub.subscriber_id, type: 'SUBSCRIPTION_CANCELED', title: 'Abonnement résilié', body: 'Votre abonnement MEDIKOOL a été résilié.' })
      }
      await db.from('domain_events').insert({ event_type: 'SUBSCRIPTION_CANCELED', payload: { stripeSubId: sub.id } })
    } else if (event.type === 'invoice.paid') {
      const invoice = obj
      const { data: sub } = await db.from('subscriptions').select('subscriber_id').eq('stripe_subscription_id', invoice.subscription).maybeSingle()
      await db.from('payments').insert({
        subscriber_id: sub?.subscriber_id,
        status: 'paid',
        paid_at: new Date(invoice.status_transitions?.paid_at * 1000).toISOString(),
        provider_payment_id: invoice.charge,
        provider_invoice_id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      })
      await db.from('domain_events').insert({ event_type: 'PAYMENT_RECEIVED', payload: { invoiceId: invoice.id, amount: invoice.amount_paid } })
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = obj
      const nextAttempt = invoice.next_payment_attempt
      const daysPastDue = nextAttempt ? Math.round((nextAttempt - Date.now() / 1000) / 86400) : 0
      await db.from('subscriptions').update({ status: 'past_due', days_past_due: Math.max(0, daysPastDue) }).eq('stripe_subscription_id', invoice.subscription)
      const { data: sub } = await db.from('subscriptions').select('subscriber_id').eq('stripe_subscription_id', invoice.subscription).maybeSingle()
      if (sub) {
        await db.from('notifications').insert({ recipient_id: sub.subscriber_id, type: 'PAYMENT_FAILED', title: 'Échec du paiement', body: 'Votre paiement a échoué — mettez à jour votre moyen de paiement' })
      }
      await db.from('domain_events').insert({ event_type: 'PAYMENT_FAILED', payload: { invoiceId: invoice.id } })
    } else if (event.type === 'charge.refunded') {
      const charge = obj
      const isPartial = charge.amount_refunded < charge.amount
      await db.from('payments').update({ status: isPartial ? 'partially_refunded' : 'refunded' }).eq('provider_payment_id', charge.id)
      await db.from('domain_events').insert({ event_type: 'CHARGE_REFUNDED', payload: { chargeId: charge.id, amountRefunded: charge.amount_refunded } })
    }
    // Unrecognized events: fall through to record + return 200

    await db.from('payment_events').insert({ provider_event_id: event.id, event_type: event.type, payload: event })
    return new Response('OK', { status: 200 })
  } catch (err: any) {
    console.error('stripe-webhook error:', err)
    // Still record the event to avoid retries, but log the error
    await db.from('payment_events').insert({ provider_event_id: event.id, event_type: event.type, payload: event, processing_error: err.message }).catch(() => {})
    return new Response('OK', { status: 200 })
  }
})
