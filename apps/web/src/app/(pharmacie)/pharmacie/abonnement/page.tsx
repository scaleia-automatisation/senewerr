import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, Star, Info } from 'lucide-react'
import {
  PHARMACIE_PLANS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_CLASSES,
  type SubscriptionStatus,
} from '@/lib/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Abonnement — Pharmacie' }

type Subscription = {
  id: string; plan_key: string; status: SubscriptionStatus
  started_at: string; renewal_at: string | null; commission_cap_fcfa: number | null
}

export default async function PharmacieAbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id, name').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string; name: string } | null
  if (!pharmacy) redirect('/connexion')

  type FetchFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown }>
        }
      }
    }
  }
  const { data: subData } = await (supabase.from('abonnements') as unknown as FetchFn)
    .select('id, plan_key, status, started_at, renewal_at, commission_cap_fcfa')
    .eq('actor_type', 'pharmacie')
    .eq('actor_id', pharmacy.id)
    .maybeSingle()

  const sub = subData as unknown as Subscription | null
  const currentPlanKey = sub?.plan_key ?? 'decouverte'
  const currentPlan = PHARMACIE_PLANS.find(p => p.key === currentPlanKey) ?? PHARMACIE_PLANS[0]
  const status: SubscriptionStatus = sub?.status ?? 'actif'

  function fmtCFA(n: number) {
    return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Abonnement</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">{pharmacy.name} — spec 23.2</p>
      </div>

      {/* Abonnement actuel */}
      <div className="sw-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Formule actuelle</p>
            <p className="text-lg font-bold text-[var(--sw-ink)]">{currentPlan.label}</p>
            <p className="text-sm text-[var(--sw-ink-2)]">{currentPlan.price_label}</p>
            {currentPlan.commission_pct !== null && (
              <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
                Commission indicative : <strong>{currentPlan.commission_pct} %</strong>
              </p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${SUBSCRIPTION_STATUS_CLASSES[status]}`}>
            {SUBSCRIPTION_STATUS_LABELS[status]}
          </span>
        </div>
        {sub && (
          <div className="flex items-center gap-4 text-xs text-[var(--sw-ink-3)] border-t border-[var(--sw-line)] pt-3">
            <span>Depuis le {new Date(sub.started_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {sub.renewal_at && (
              <span>· Renouvellement le {new Date(sub.renewal_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long' })}</span>
            )}
            {sub.commission_cap_fcfa && (
              <span>· Plafond : {fmtCFA(sub.commission_cap_fcfa)} / réservation</span>
            )}
          </div>
        )}
        {(status === 'paiement_en_attente' || status === 'suspendu') && (
          <div className="p-3 rounded-xl bg-[var(--sw-warning-bg)] text-xs text-[var(--sw-warning)]">
            Fonctionnalités non essentielles temporairement limitées (spec 23.6). Vos données restent accessibles.
          </div>
        )}
      </div>

      {/* Note commissions spec 23.2 */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <Info className="w-4 h-4 text-[var(--sw-primary)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-primary)]">
          Spec 23.2 — Les commissions sont calculées sur les retraits effectivement confirmés, hors montants reversés à l'organisme de couverture. Un plafond par réservation peut être configuré contractuellement.
        </p>
      </div>

      {/* Catalogue offres */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Toutes les formules</h2>
        <div className="grid gap-3">
          {PHARMACIE_PLANS.map(plan => {
            const isCurrent = plan.key === currentPlanKey
            return (
              <div key={plan.key}
                className={`sw-card overflow-hidden ${plan.highlighted ? 'ring-2 ring-[var(--sw-primary)]' : ''}`}>
                {plan.highlighted && (
                  <div className="px-4 py-1.5 bg-[var(--sw-primary)] flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-white" />
                    <span className="text-xs font-medium text-white">Recommandé</span>
                  </div>
                )}
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-base font-bold text-[var(--sw-ink)]">{plan.label}</p>
                      <p className="text-sm font-semibold text-[var(--sw-primary)]">{plan.price_label}</p>
                      {plan.commission_pct !== null && (
                        <p className="text-xs text-[var(--sw-ink-3)]">
                          Commission indicative : {plan.commission_pct} %
                        </p>
                      )}
                    </div>
                    {isCurrent ? (
                      <span className="text-xs px-2 py-1 rounded-lg bg-[var(--sw-success-bg)] text-[var(--sw-success)] font-medium shrink-0">
                        Actuelle
                      </span>
                    ) : (
                      <button className="text-xs px-3 py-1.5 rounded-xl bg-[var(--sw-primary)] text-white font-medium shrink-0">
                        Choisir
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[var(--sw-ink-2)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
