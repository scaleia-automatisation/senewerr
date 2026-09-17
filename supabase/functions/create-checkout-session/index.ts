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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { kind, planCode, packCode, billingInterval = 'monthly', promoCode, successUrl, cancelUrl } = await req.json()

    if (!kind || !successUrl || !cancelUrl) return errorResponse('INVALID_PARAMS', 'kind, successUrl et cancelUrl sont requis')

    let stripePriceId: string
    let subscriberId: string
    let sessionMode: 'subscription' | 'payment'

    // Fetch profile with email
    const { data: profile } = await db.from('profiles').select('id, email, professional_profile_id').eq('id', auth.profileId).single()
    if (!profile) return errorResponse('PROFILE_NOT_FOUND', 'Profil introuvable', 404)

    if (kind === 'subscription') {
      if (!planCode) return errorResponse('INVALID_PARAMS', 'planCode requis pour une souscription')
      const { data: plan } = await db.from('subscription_plans').select('*').eq('code', planCode).eq('is_active', true).single()
      if (!plan) return errorResponse('PLAN_NOT_FOUND', 'Plan introuvable', 404)

      stripePriceId = billingInterval === 'annual' ? plan.stripe_price_annual_id : plan.stripe_price_monthly_id
      if (!stripePriceId) return errorResponse('PRICE_NOT_CONFIGURED', 'Prix Stripe non configuré pour ce plan/intervalle')

      // Determine subscriberId (org or professional)
      if (plan.target === 'organization') {
        const orgId = auth.orgIds[0]
        if (!orgId) return errorResponse('NO_ORG', 'Aucune organisation trouvée pour ce compte')
        // Verify caller is owner or admin
        const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', orgId).eq('profile_id', auth.profileId).eq('status', 'active').single()
        if (!membership || !['owner', 'admin'].includes(membership.role)) return errorResponse('FORBIDDEN', 'Seul un propriétaire ou admin peut souscrire', 403)
        subscriberId = orgId
      } else {
        if (!profile.professional_profile_id) return errorResponse('NO_PROFESSIONAL_PROFILE', 'Profil professionnel requis')
        subscriberId = profile.professional_profile_id
      }
      sessionMode = 'subscription'
    } else if (kind === 'credit_pack') {
      if (!packCode) return errorResponse('INVALID_PARAMS', 'packCode requis pour un achat de crédits')
      const { data: pack } = await db.from('credit_packs').select('*').eq('code', packCode).eq('is_active', true).single()
      if (!pack) return errorResponse('PACK_NOT_FOUND', 'Pack de crédits introuvable', 404)
      stripePriceId = pack.stripe_price_id
      if (!stripePriceId) return errorResponse('PRICE_NOT_CONFIGURED', 'Prix Stripe non configuré pour ce pack')
      subscriberId = profile.professional_profile_id ?? auth.profileId
      sessionMode = 'payment'
    } else {
      return errorResponse('INVALID_KIND', 'kind doit être "subscription" ou "credit_pack"')
    }

    // Get or create Stripe customer
    const { data: existingSub } = await db.from('subscriptions').select('stripe_customer_id').eq('subscriber_id', subscriberId).maybeSingle()
    let stripeCustomerId: string = existingSub?.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe('POST', '/customers', {
        email: profile.email,
        metadata: { medikool_subscriber_id: subscriberId },
      })
      stripeCustomerId = customer.id
    }

    // Resolve promo code if provided
    let stripeDiscounts: unknown[] | undefined
    if (promoCode) {
      const promoRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/apply-promo-code`, {
        method: 'POST',
        headers: { 'Authorization': req.headers.get('Authorization')!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, planCode, kind }),
      })
      const promoData = await promoRes.json()
      if (!promoRes.ok || !promoData.data?.valid) return errorResponse('PROMO_INVALID', promoData.error?.message ?? 'Code promo invalide')
      const stripePromoId: string = promoData.data.stripePromoCodeId
      if (stripePromoId) stripeDiscounts = [{ promotion_code: stripePromoId }]
    }

    // Build Checkout session params
    const sessionParams: Record<string, unknown> = {
      mode: sessionMode,
      customer: stripeCustomerId,
      client_reference_id: subscriberId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price]': stripePriceId,
      'line_items[0][quantity]': 1,
    }

    if (stripeDiscounts && stripeDiscounts.length > 0) {
      sessionParams['discounts[0][promotion_code]'] = (stripeDiscounts[0] as any).promotion_code
    }

    const session = await stripe('POST', '/checkout/sessions', sessionParams)

    return successResponse({ url: session.url, sessionId: session.id })
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentification requise', 401)
    console.error('create-checkout-session error:', err)
    return errorResponse('INTERNAL_ERROR', err.message ?? 'Erreur interne', 500)
  }
})
