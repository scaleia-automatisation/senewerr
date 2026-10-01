import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrendingUp, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  SANTE_PLANS, PHARMACIE_PLANS, ETABLISSEMENT_PLANS, COUVERTURE_PLANS,
  SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_CLASSES, ADDONS,
  type SubscriptionStatus,
} from '@/lib/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Abonnements & revenus — Super Admin' }

// Spec 23 — supervision globale du modèle économique
type SubAggregate = { plan_key: string; actor_type: string; status: string; _count: number }

export default async function SuperAdminAbonnementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  type Chain = {
    eq: (c: string, v: string) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }
  type CountQuery = { select: (q: string, opts: { count: string; head: boolean }) => { eq: (c: string, v: string) => Promise<{ count: number | null }> } }

  // Comptages par statut
  const [actifRes, attRes, suspRes, resilRes] = await Promise.allSettled([
    (supabase.from('abonnements') as unknown as CountQuery).select('id', { count: 'exact', head: true }).eq('status', 'actif'),
    (supabase.from('abonnements') as unknown as CountQuery).select('id', { count: 'exact', head: true }).eq('status', 'paiement_en_attente'),
    (supabase.from('abonnements') as unknown as CountQuery).select('id', { count: 'exact', head: true }).eq('status', 'suspendu'),
    (supabase.from('abonnements') as unknown as CountQuery).select('id', { count: 'exact', head: true }).eq('status', 'resilie'),
  ])
  function cnt(r: PromiseSettledResult<{ count: number | null }>): number {
    return r.status === 'fulfilled' ? (r.value.count ?? 0) : 0
  }
  const activeCount = cnt(actifRes)
  const pendingCount = cnt(attRes)
  const suspendedCount = cnt(suspRes)
  const cancelledCount = cnt(resilRes)

  // Revenus MRR estimés — toutes les souscriptions actives
  const { data: activeSubs } = await (supabase.from('abonnements') as unknown as RawQuery)
    .select('plan_key, actor_type, status')
    .eq('status', 'actif')
    .range(0, 999)

  const allPlans = [...SANTE_PLANS, ...PHARMACIE_PLANS, ...ETABLISSEMENT_PLANS, ...COUVERTURE_PLANS]
  const priceMap: Record<string, number> = Object.fromEntries(
    allPlans.filter(p => p.price_fcfa !== null).map(p => [`${p.key}`, p.price_fcfa!])
  )

  type ActiveSub = { plan_key: string; actor_type: string; status: string }
  const mrrEstimate = ((activeSubs ?? []) as unknown as ActiveSub[])
    .reduce((sum, s) => sum + (priceMap[s.plan_key] ?? 0), 0)

  function fmtCFA(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M F CFA`
    if (n >= 1000) return `${Math.round(n / 1000)} k F CFA`
    return `${n} F CFA`
  }

  // Répartition par plan
  const planCounts: Record<string, number> = {}
  for (const s of ((activeSubs ?? []) as unknown as ActiveSub[])) {
    planCounts[s.plan_key] = (planCounts[s.plan_key] ?? 0) + 1
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Abonnements & revenus</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 23 — supervision du modèle économique SaaS</p>
      </div>

      {/* KPIs revenus */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="sw-card p-4 col-span-2 sm:col-span-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-success-bg)] flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[var(--sw-success)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">MRR estimé</p>
            <p className="text-lg font-bold text-[var(--sw-ink)]">{fmtCFA(mrrEstimate)}</p>
          </div>
        </div>
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Actifs</p>
            <p className="text-xl font-bold text-[var(--sw-ink)]">{activeCount}</p>
          </div>
        </div>
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-warning-bg)] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[var(--sw-warning)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Paiement att.</p>
            <p className="text-xl font-bold text-[var(--sw-ink)]">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Statuts */}
      <div className="sw-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--sw-line)]">
          <p className="text-sm font-semibold text-[var(--sw-ink)]">Répartition par statut</p>
        </div>
        <div className="divide-y divide-[var(--sw-line)]">
          {(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map(s => {
            const counts: Record<string, number> = {
              actif: activeCount, paiement_en_attente: pendingCount,
              suspendu: suspendedCount, resilie: cancelledCount, essai: 0, expire: 0,
            }
            return (
              <div key={s} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SUBSCRIPTION_STATUS_CLASSES[s]}`}>
                  {SUBSCRIPTION_STATUS_LABELS[s]}
                </span>
                <span className="flex-1 text-sm text-[var(--sw-ink-3)]"></span>
                <span className="text-sm font-bold text-[var(--sw-ink)]">{counts[s] ?? 0}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Plans actifs */}
      {Object.keys(planCounts).length > 0 && (
        <div className="sw-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--sw-line)]">
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Répartition par formule (abonnements actifs)</p>
          </div>
          <div className="divide-y divide-[var(--sw-line)]">
            {Object.entries(planCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([key, count]) => (
                <div key={key} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="text-sm text-[var(--sw-ink)] flex-1 font-medium capitalize">{key}</span>
                  <span className="text-sm font-bold text-[var(--sw-ink)]">{count}</span>
                  <span className="text-xs text-[var(--sw-ink-3)]">{fmtCFA((priceMap[key] ?? 0) * count)} / mois</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Spec 23.5 — revenus complémentaires */}
      <div className="sw-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--sw-line)]">
          <p className="text-sm font-semibold text-[var(--sw-ink)]">Services complémentaires (spec 23.5)</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Add-ons facturés à l'usage ou par abonnement séparé</p>
        </div>
        <div className="divide-y divide-[var(--sw-line)]">
          {ADDONS.map(a => (
            <div key={a.key} className="px-4 py-2.5 flex items-center gap-3">
              <CreditCard className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--sw-ink)]">{a.label}</p>
                <p className="text-xs text-[var(--sw-ink-3)]">{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--sw-ink-3)]">
        MRR calculé sur les abonnements actifs uniquement. Les frais prestataires de paiement sont distincts des revenus Séné Wérr (spec 23.5).
      </p>
    </div>
  )
}
