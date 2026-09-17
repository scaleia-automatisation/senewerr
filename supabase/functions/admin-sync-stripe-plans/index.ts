import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// ---------------------------------------------------------------------------
// Stripe helper (mirrors create-checkout-session)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const profile = await requireAuth(req)

    // Only super_admin or platform_admin allowed
    if (!['super_admin', 'platform_admin'].includes(profile.role)) {
      return errorResponse('FORBIDDEN', 'Accès réservé aux administrateurs de la plateforme', 403)
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json().catch(() => ({}))
    const { planCode } = body as { planCode?: string }

    let syncedCount = 0

    // -----------------------------------------------------------------------
    // 1. Sync subscription_plans
    // -----------------------------------------------------------------------
    let plansQuery = db
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)

    if (planCode) {
      plansQuery = plansQuery.eq('code', planCode)
    }

    const { data: plans, error: plansErr } = await plansQuery
    if (plansErr) throw plansErr

    for (const plan of plans ?? []) {
      if ((plan.price_monthly_xof ?? 0) <= 0) continue

      const updates: Record<string, string> = {}

      // a. Ensure Stripe Product exists
      let stripeProductId: string = plan.stripe_product_id
      if (!stripeProductId) {
        const product = await stripe('POST', '/products', {
          name: plan.name,
          metadata: { medikool_plan_code: plan.code },
        })
        stripeProductId = product.id
        updates.stripe_product_id = stripeProductId
      }

      // b. Ensure monthly Price exists
      if (!plan.stripe_price_monthly_id) {
        const price = await stripe('POST', '/prices', {
          product: stripeProductId,
          unit_amount: plan.price_monthly_xof,
          currency: 'xof',
          recurring: { interval: 'month' },
          metadata: { medikool_plan_code: plan.code, interval: 'monthly' },
        })
        updates.stripe_price_monthly_id = price.id
      }

      // c. Ensure annual Price exists (only if price_annual_xof is set)
      if (!plan.stripe_price_annual_id && (plan.price_annual_xof ?? 0) > 0) {
        const price = await stripe('POST', '/prices', {
          product: stripeProductId,
          unit_amount: plan.price_annual_xof,
          currency: 'xof',
          recurring: { interval: 'year' },
          metadata: { medikool_plan_code: plan.code, interval: 'annual' },
        })
        updates.stripe_price_annual_id = price.id
      }

      // d. Persist any new Stripe IDs back to the database
      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await db
          .from('subscription_plans')
          .update(updates)
          .eq('id', plan.id)
        if (updateErr) throw updateErr
        syncedCount++
      }
    }

    // -----------------------------------------------------------------------
    // 2. Sync credit_packs
    // -----------------------------------------------------------------------
    const { data: packs, error: packsErr } = await db
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .is('stripe_price_id', null)

    if (packsErr) throw packsErr

    for (const pack of packs ?? []) {
      if ((pack.price_xof ?? 0) <= 0) continue

      const packUpdates: Record<string, string> = {}

      // Create one-time Stripe Product
      let packProductId: string = pack.stripe_product_id
      if (!packProductId) {
        const product = await stripe('POST', '/products', {
          name: pack.name,
          metadata: { medikool_pack_code: pack.code },
        })
        packProductId = product.id
        packUpdates.stripe_product_id = packProductId
      }

      // Create one-time Price
      const price = await stripe('POST', '/prices', {
        product: packProductId,
        unit_amount: pack.price_xof,
        currency: 'xof',
        metadata: { medikool_pack_code: pack.code },
      })
      packUpdates.stripe_price_id = price.id

      const { error: packUpdateErr } = await db
        .from('credit_packs')
        .update(packUpdates)
        .eq('id', pack.id)
      if (packUpdateErr) throw packUpdateErr

      syncedCount++
    }

    return successResponse({ synced: syncedCount })
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentification requise', 401)
    if (err?.message === 'PROFILE_NOT_FOUND') return errorResponse('PROFILE_NOT_FOUND', 'Profil introuvable', 404)
    console.error('admin-sync-stripe-plans error:', err)
    return errorResponse('INTERNAL_ERROR', err?.message ?? 'Erreur interne', 500)
  }
})
