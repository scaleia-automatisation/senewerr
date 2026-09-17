import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Actual DB schema uses: plan_credits, purchased_credits, plan_credits_total (credit_wallets)
// ai_generations uses: action (not feature), model (not provider_model), input_tokens/output_tokens

export async function chargeCredits(
  db: SupabaseClient,
  profileId: string,
  feature: string,
  cost: number,
  model: string
): Promise<string> {
  const { data: wallet } = await db
    .from('credit_wallets')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  const planBal = wallet?.plan_credits ?? 0
  const purchBal = wallet?.purchased_credits ?? 0
  const total = planBal + purchBal

  if (total < cost) {
    throw {
      code: 'INSUFFICIENT_CREDITS',
      message: `Vous n'avez plus de crédits IA (${total} disponible${total > 1 ? 's' : ''}). Achetez un pack ou passez au plan supérieur.`,
      balance: total,
      required: cost,
    }
  }

  const { data: gen } = await db.from('ai_generations').insert({
    profile_id: profileId,
    action: feature,
    credits_charged: cost,
    status: 'started',
    model,
  }).select('id').single()

  let remaining = cost
  const newPlanBal = Math.max(0, planBal - remaining)
  remaining -= (planBal - newPlanBal)
  const newPurchBal = Math.max(0, purchBal - remaining)
  const newTotal = newPlanBal + newPurchBal

  await db.from('credit_wallets')
    .update({ plan_credits: newPlanBal, purchased_credits: newPurchBal, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId)

  await db.from('credit_transactions').insert({
    wallet_id: wallet?.id,
    type: 'consumption',
    amount: -cost,
    balance_after: newTotal,
    description: `Utilisation IA : ${feature}`,
  })

  return gen?.id ?? ''
}

export async function completeGeneration(
  db: SupabaseClient,
  generationId: string,
  tokensIn: number,
  tokensOut: number,
  providerCostUsd?: number
): Promise<void> {
  await db.from('ai_generations').update({
    status: 'completed',
    input_tokens: tokensIn,
    output_tokens: tokensOut,
    provider_cost_usd: providerCostUsd,
    updated_at: new Date().toISOString(),
  }).eq('id', generationId)
}

export async function refundCredits(
  db: SupabaseClient,
  profileId: string,
  generationId: string,
  cost: number,
  errorCode: string
): Promise<void> {
  const { data: wallet } = await db.from('credit_wallets').select('*').eq('profile_id', profileId).maybeSingle()
  if (!wallet) return

  const planTotal = wallet.plan_credits_total ?? 0
  const planRefund = Math.min(cost, planTotal - wallet.plan_credits)
  const purchRefund = cost - planRefund

  await db.from('credit_wallets').update({
    plan_credits: wallet.plan_credits + planRefund,
    purchased_credits: wallet.purchased_credits + purchRefund,
    updated_at: new Date().toISOString(),
  }).eq('profile_id', profileId)

  await db.from('credit_transactions').insert({
    wallet_id: wallet.id,
    type: 'refund',
    amount: cost,
    balance_after: wallet.plan_credits + planRefund + wallet.purchased_credits + purchRefund,
    description: `Remboursement IA : ${errorCode}`,
  })

  await db.from('ai_generations').update({
    status: 'refunded',
    error_code: errorCode,
    updated_at: new Date().toISOString(),
  }).eq('id', generationId)
}
