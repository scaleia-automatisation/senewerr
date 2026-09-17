import { useState, useEffect } from 'react'
import { CreditCard, Zap, Users, Building2, TrendingUp, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Banner } from '@/components/ui/Banner'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface Subscription {
  id: string
  status: string
  billing_interval: 'monthly' | 'annual'
  current_period_start: string
  current_period_end: string
  trial_ends_at?: string
  cancel_at_period_end: boolean
  plan: {
    code: string
    name: string
    price_monthly_xof: number
    price_annual_xof: number
    ai_credits_monthly: number
    plan_features: { feature_key: string; value: string }[]
  }
}

interface Wallet {
  plan_credits: number
  plan_credits_total: number
  purchased_credits: number
  plan_credits_reset_at: string
}

interface CreditPack {
  id: string
  code: string
  name: string
  credits: number
  price_xof: number
}

interface Payment {
  id: string
  amount_xof: number
  status: string
  paid_at: string
  provider_invoice_id: string
}

export default function SubscriptionPage() {
  const { profile } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState<{ valid: boolean; message: string; discount?: string } | null>(null)
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [buyingPack, setBuyingPack] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [profile?.id])

  async function fetchData() {
    if (!profile?.id) return
    const [subRes, walletRes, packsRes, paymentsRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans(*, plan_features(*))')
        .eq('subscriber_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('credit_wallets').select('*').eq('subscriber_id', profile.id).maybeSingle(),
      supabase.from('credit_packs').select('*').eq('is_active', true).order('credits'),
      supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .limit(10),
    ])
    setSubscription(subRes.data as Subscription | null)
    setWallet(walletRes.data)
    setPacks(packsRes.data ?? [])
    setPayments(paymentsRes.data ?? [])
    setLoading(false)
  }

  async function checkPromoCode() {
    if (!promoCode.trim() || !subscription) return
    setCheckingPromo(true)
    setPromoResult(null)
    const { data, error } = await supabase.functions.invoke('apply-promo-code', {
      body: { code: promoCode.trim(), planCode: subscription.plan.code, kind: 'subscription' },
    })
    setCheckingPromo(false)
    if (error || !data?.valid) {
      setPromoResult({ valid: false, message: data?.message ?? 'Code invalide' })
    } else {
      setPromoResult({
        valid: true,
        message: `Code valide ! Réduction de ${data.discountLabel}`,
        discount: data.discountLabel,
      })
    }
  }

  async function buyPack(pack: CreditPack) {
    setBuyingPack(pack.id)
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        kind: 'credit_pack',
        packCode: pack.code,
        promoCode: promoCode && promoResult?.valid ? promoCode : undefined,
        successUrl: `${window.location.origin}/abonnement?pack_success=1`,
        cancelUrl: window.location.href,
      },
    })
    setBuyingPack(null)
    if (data?.url) window.location.href = data.url
  }

  async function openStripePortal() {
    const { data } = await supabase.functions.invoke('create-stripe-portal', {
      body: { returnUrl: window.location.href },
    })
    if (data?.url) window.open(data.url, '_blank')
  }

  function usagePercent(used: number, total: number): number {
    if (total === 0) return 0
    return Math.min(100, Math.round((used / total) * 100))
  }

  function UsageBar({
    label,
    used,
    total,
    icon,
  }: {
    label: string
    used: number
    total: number
    icon: React.ReactNode
  }) {
    const pct = usagePercent(used, total)
    const color =
      pct >= 90 ? 'bg-status-danger' : pct >= 70 ? 'bg-status-warning' : 'bg-primary'
    return (
      <div className="flex flex-col gap-s-1">
        <div className="flex items-center justify-between text-small">
          <span className="flex items-center gap-s-1 text-ink-2">
            {icon}
            {label}
          </span>
          <span className="font-medium text-ink">
            {used}/{total === 999999 ? '∞' : total}
          </span>
        </div>
        <div className="h-2 rounded-pill bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-pill ${color} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 90 && (
          <p className="text-small text-status-danger">Quota presque atteint</p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4 p-s-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-md" />
        ))}
      </div>
    )
  }

  const planCreditsUsed =
    (wallet?.plan_credits_total ?? 0) - (wallet?.plan_credits ?? 0)
  const totalCredits =
    (wallet?.plan_credits ?? 0) + (wallet?.purchased_credits ?? 0)

  return (
    <div className="flex flex-col gap-s-5 p-s-4 max-w-2xl mx-auto">
      <h1 className="text-h2 font-display text-ink">Mon abonnement</h1>

      {/* Past due warning */}
      {subscription?.status === 'past_due' && (
        <Banner kind="warning">
          Votre paiement a échoué. Mettez à jour votre moyen de paiement pour éviter la
          restriction de votre compte.
        </Banner>
      )}

      {/* Current plan */}
      <Card className="p-s-4">
        <div className="flex items-start justify-between gap-s-3">
          <div>
            <p className="text-small text-ink-3">Plan actuel</p>
            <p className="text-h3 font-display font-semibold text-ink">
              {subscription?.plan?.name ?? 'Gratuit'}
            </p>
            <p className="text-small text-ink-2 mt-s-1">
              {subscription?.billing_interval === 'annual'
                ? 'Facturation annuelle'
                : 'Facturation mensuelle'}
            </p>
            {subscription?.current_period_end && (
              <p className="text-small text-ink-3 mt-s-1">
                Renouvellement :{' '}
                {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
              </p>
            )}
            {subscription?.trial_ends_at &&
              new Date(subscription.trial_ends_at) > new Date() && (
                <p className="text-small text-accent mt-s-1">
                  Essai jusqu'au{' '}
                  {new Date(subscription.trial_ends_at).toLocaleDateString('fr-FR')}
                </p>
              )}
          </div>
          <Badge
            variant={
              subscription?.status === 'active'
                ? 'success'
                : subscription?.status === 'trialing'
                ? 'info'
                : 'warning'
            }
          >
            {subscription?.status === 'active'
              ? 'Actif'
              : subscription?.status === 'trialing'
              ? 'Essai'
              : (subscription?.status ?? 'Gratuit')}
          </Badge>
        </div>

        <div className="mt-s-4 flex flex-wrap gap-s-2">
          <Button variant="secondary" onClick={openStripePortal}>
            <CreditCard className="w-4 h-4 mr-s-1" />
            Gérer le moyen de paiement
          </Button>
          <Button variant="ghost" asChild>
            <a href="/tarifs">Changer de plan</a>
          </Button>
        </div>
      </Card>

      {/* Usage gauges */}
      <Card className="p-s-4">
        <p className="font-medium text-ink mb-s-4">Utilisation</p>
        <div className="flex flex-col gap-s-4">
          {wallet && (
            <UsageBar
              label="Crédits IA"
              used={planCreditsUsed}
              total={wallet.plan_credits_total}
              icon={<Zap className="w-3 h-3" />}
            />
          )}
        </div>
        {totalCredits < 5 && wallet && (
          <Banner kind="info" className="mt-s-3">
            Plus que {totalCredits} crédit(s) IA disponible(s). Achetez un pack ci-dessous.
          </Banner>
        )}
      </Card>

      {/* Credit packs */}
      <div>
        <p className="font-medium text-ink mb-s-3">Acheter des crédits IA</p>
        <div className="grid grid-cols-2 gap-s-3">
          {packs.map((pack) => (
            <Card key={pack.id} className="p-s-3 flex flex-col gap-s-2">
              <div>
                <p className="font-semibold text-ink">{pack.name}</p>
                <p className="text-small text-accent">{pack.credits} crédits</p>
              </div>
              <p className="text-body font-bold text-ink">
                {pack.price_xof.toLocaleString('fr-FR')} FCFA
              </p>
              <p className="text-small text-ink-3">
                {Math.round(pack.price_xof / pack.credits)} FCFA/crédit
              </p>
              <Button
                variant="secondary"
                loading={buyingPack === pack.id}
                onClick={() => buyPack(pack)}
                className="text-small"
              >
                Acheter
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Promo code */}
      <Card className="p-s-4" id="credits">
        <p className="font-medium text-ink mb-s-3">Code promo</p>
        <div className="flex gap-s-2">
          <Input
            label=""
            placeholder="ex: solo50"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value)
              setPromoResult(null)
            }}
          />
          <Button
            variant="secondary"
            loading={checkingPromo}
            onClick={checkPromoCode}
            className="shrink-0"
          >
            Appliquer
          </Button>
        </div>
        {promoResult && (
          <p
            className={`mt-s-2 text-small ${
              promoResult.valid ? 'text-status-success' : 'text-status-danger'
            }`}
          >
            {promoResult.message}
          </p>
        )}
      </Card>

      {/* Invoice list */}
      {payments.length > 0 && (
        <div>
          <p className="font-medium text-ink mb-s-3">Factures</p>
          <div className="flex flex-col gap-s-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-line p-s-3 text-small"
              >
                <div>
                  <p className="font-medium text-ink">
                    {p.amount_xof.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-ink-3">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—'}
                  </p>
                </div>
                <Badge variant={p.status === 'paid' ? 'success' : 'warning'}>
                  {p.status === 'paid' ? 'Payée' : p.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
