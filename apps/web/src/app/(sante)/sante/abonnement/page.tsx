import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, Star } from 'lucide-react'
import {
  SANTE_PLANS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_CLASSES,
  type SubscriptionStatus,
} from '@/lib/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon abonnement — Professionnel' }

type Subscription = {
  id: string; plan_key: string; status: SubscriptionStatus
  started_at: string; renewal_at: string | null; trial_ends_at: string | null
}

export default async function SanteAbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profData } = await supabase
    .from('professionals')
    .select('id, profiles(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle()
  const prof = profData as unknown as { id: string; profiles: { full_name: string | null } | null } | null
  if (!prof) redirect('/connexion')

  type FetchFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown }>
        }
      }
    }
  }
  const { data: subData } = await (supabase.from('subscriptions') as unknown as FetchFn)
    .select('id, plan_key, status, started_at, renewal_at, trial_ends_at')
    .eq('actor_type', 'sante')
    .eq('actor_id', prof.id)
    .maybeSingle()

  const sub = subData as unknown as Subscription | null
  const currentPlanKey = sub?.plan_key ?? 'essentiel'
  const currentPlan = SANTE_PLANS.find(p => p.key === currentPlanKey) ?? SANTE_PLANS[0]
  const status: SubscriptionStatus = sub?.status ?? 'actif'

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon abonnement</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 23.1 — offres professionnels de santé</p>
      </div>

      {/* Abonnement actuel */}
      {sub && (
        <div className="sw-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--sw-ink-3)]">Formule actuelle</p>
              <p className="text-lg font-bold text-[var(--sw-ink)]">{currentPlan.label}</p>
              <p className="text-sm text-[var(--sw-ink-2)]">{currentPlan.price_label}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg font-medium ${SUBSCRIPTION_STATUS_CLASSES[status]}`}>
              {SUBSCRIPTION_STATUS_LABELS[status]}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--sw-ink-3)] border-t border-[var(--sw-line)] pt-3">
            <span>Depuis le {new Date(sub.started_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {sub.renewal_at && (
              <span>· Renouvellement le {new Date(sub.renewal_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long' })}</span>
            )}
          </div>
          {/* Spec 23.6 — en cas de défaut, données restent accessibles */}
          {(status === 'paiement_en_attente' || status === 'suspendu') && (
            <div className="p-3 rounded-xl bg-[var(--sw-warning-bg)] text-xs text-[var(--sw-warning)]">
              Fonctionnalités non essentielles temporairement limitées. Vos données restent accessibles conformément aux conditions contractuelles.
            </div>
          )}
        </div>
      )}

      {/* Catalogue des offres (spec 23.1) */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Toutes les formules</h2>
        <div className="grid gap-3">
          {SANTE_PLANS.map(plan => {
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
                    </div>
                    {isCurrent ? (
                      <span className="text-xs px-2 py-1 rounded-lg bg-[var(--sw-success-bg)] text-[var(--sw-success)] font-medium shrink-0">
                        Formule actuelle
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

      <p className="text-xs text-[var(--sw-ink-3)]">
        Les fonctionnalités payantes sont clairement indiquées avant la souscription (spec 23.1).
        Pour un devis ou un accompagnement, contacter le support.
      </p>
    </div>
  )
}
