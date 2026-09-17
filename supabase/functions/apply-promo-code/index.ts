import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireAuth(req)
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { code, planCode, kind } = await req.json()
    if (!code || !kind) return errorResponse('INVALID_PARAMS', 'code et kind sont requis')

    // Fetch promo code (citext comparison is case-insensitive on the DB side)
    const { data: promo, error } = await db
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle()

    if (error) throw error
    if (!promo) return errorResponse('PROMO_NOT_FOUND', 'Code promo introuvable', 404)

    // Validate active
    if (!promo.is_active) return errorResponse('PROMO_INACTIVE', "Ce code promo n'est plus actif")

    // Validate dates
    const now = new Date()
    if (promo.valid_from && new Date(promo.valid_from) > now) return errorResponse('PROMO_EXPIRED', 'Ce code promo n\'est pas encore actif')
    if (promo.valid_until && new Date(promo.valid_until) < now) return errorResponse('PROMO_EXPIRED', 'Ce code promo a expiré')

    // Validate usage cap
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return errorResponse('PROMO_EXHAUSTED', 'Ce code promo a atteint son nombre maximum d\'utilisations')
    }

    // Validate target kind
    if (promo.target && promo.target !== kind) {
      return errorResponse('PROMO_WRONG_TARGET', 'Ce code n\'est pas applicable ici')
    }

    // Validate eligible plans
    if (promo.eligible_plan_codes && promo.eligible_plan_codes.length > 0) {
      if (!planCode || !promo.eligible_plan_codes.includes(planCode)) {
        return errorResponse('PROMO_PLAN_INELIGIBLE', 'Ce code n\'est pas applicable à ce plan')
      }
    }

    // Check per-user usage
    const { data: alreadyUsed } = await db
      .from('promo_code_uses')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('subscriber_id', auth.profileId)
      .maybeSingle()

    if (alreadyUsed) return errorResponse('PROMO_ALREADY_USED', 'Vous avez déjà utilisé ce code promo')

    // Fetch plan price for percentage discount calculation
    let planPrice = 0
    if (planCode && promo.discount_type === 'percent') {
      const { data: plan } = await db.from('subscription_plans').select('price_monthly, price_annual').eq('code', planCode).maybeSingle()
      if (plan) planPrice = plan.price_monthly ?? 0
    }

    // Calculate discount amount
    let discountAmount = 0
    let discountLabel = ''
    if (promo.discount_type === 'percent') {
      discountAmount = Math.round(planPrice * promo.value / 100)
      discountLabel = `${promo.value}% de réduction`
      if (promo.duration_months) discountLabel += ` pendant ${promo.duration_months} mois`
    } else if (promo.discount_type === 'fixed') {
      discountAmount = promo.value
      discountLabel = `${(promo.value / 100).toFixed(2)} € de réduction`
    }

    return successResponse({
      valid: true,
      type: promo.discount_type,
      value: promo.value,
      discountAmount,
      discountLabel,
      stripePromoCodeId: promo.stripe_promo_code_id,
      durationMonths: promo.duration_months ?? null,
      promoCodeId: promo.id,
    })
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return errorResponse('UNAUTHORIZED', 'Authentification requise', 401)
    console.error('apply-promo-code error:', err)
    return errorResponse('INTERNAL_ERROR', err.message ?? 'Erreur interne', 500)
  }
})
