import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, AlertTriangle } from 'lucide-react'
import {
  SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_CLASSES,
  type SubscriptionStatus,
} from '@/lib/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Abonnements — Admin' }

// Spec 23.6 — vue admin des abonnements par acteur
type SubRow = {
  id: string; actor_type: string; actor_id: string; actor_name: string | null
  plan_key: string; status: SubscriptionStatus; renewal_at: string | null
  started_at: string; commission_pct: number | null
}

const ACTOR_LABEL: Record<string, string> = {
  sante: 'Professionnel', pharmacie: 'Pharmacie', etablissement: 'Établissement', couverture: 'Organisme',
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'actif', label: 'Actifs' },
  { key: 'paiement_en_attente', label: 'Paiement en attente' },
  { key: 'suspendu', label: 'Suspendus' },
  { key: 'expire', label: 'Expirés' },
]

export default async function AdminAbonnementsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status: filterStatus, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const PAGE_SIZE = 30

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  type Chain = {
    eq: (c: string, v: string) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }

  let q = (supabase.from('abonnements') as unknown as RawQuery)
    .select('id, actor_type, actor_id, actor_name, plan_key, status, renewal_at, started_at, commission_pct', { count: 'exact' })
    .order('renewal_at', { ascending: true })

  if (filterStatus) q = q.eq('status', filterStatus)

  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const subs = (data ?? []) as unknown as SubRow[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Stats par statut
  type CountQuery = { select: (q: string, opts: { count: string; head: boolean }) => { eq: (c: string, v: string) => Promise<{ count: number | null }> } }
  const statCounts = await Promise.all(
    ['actif', 'paiement_en_attente', 'suspendu', 'expire'].map(async s => {
      const { count: c } = await (supabase.from('abonnements') as unknown as CountQuery)
        .select('id', { count: 'exact', head: true })
        .eq('status', s)
      return [s, c ?? 0] as [string, number]
    })
  )
  const statMap = Object.fromEntries(statCounts)

  function planLabel(key: string) {
    return key.charAt(0).toUpperCase() + key.slice(1)
  }

  const renewingSoon = subs.filter(s => {
    if (!s.renewal_at) return false
    const days = (new Date(s.renewal_at).getTime() - Date.now()) / (1000 * 3600 * 24)
    return days >= 0 && days <= 7
  }).length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Abonnements</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 23.6 — formules, statuts et renouvellements</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-success)]">{statMap['actif'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Actifs</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-warning)]">{statMap['paiement_en_attente'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Paiement en att.</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-orange-600">{statMap['suspendu'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Suspendus</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-primary)]">{renewingSoon}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Renouv. ≤ 7 j</p>
        </div>
      </div>

      {renewingSoon > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)]">
          <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0" />
          <p className="text-xs text-[var(--sw-warning)]">
            {renewingSoon} abonnement{renewingSoon > 1 ? 's' : ''} à renouveler dans les 7 prochains jours.
          </p>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?status=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterStatus ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      {subs.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun abonnement trouvé.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {subs.map(s => {
              const daysToRenewal = s.renewal_at
                ? Math.ceil((new Date(s.renewal_at).getTime() - Date.now()) / (1000 * 3600 * 24))
                : null
              return (
                <div key={s.id} className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-[var(--sw-ink-3)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SUBSCRIPTION_STATUS_CLASSES[s.status]}`}>
                        {SUBSCRIPTION_STATUS_LABELS[s.status]}
                      </span>
                      <span className="text-xs text-[var(--sw-ink-3)]">{ACTOR_LABEL[s.actor_type] ?? s.actor_type}</span>
                      <span className="text-xs font-medium text-[var(--sw-primary)]">{planLabel(s.plan_key)}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--sw-ink)] mt-0.5">{s.actor_name ?? s.actor_id.slice(-8)}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--sw-ink-3)]">
                      {s.renewal_at && (
                        <span className={daysToRenewal !== null && daysToRenewal <= 7 ? 'text-[var(--sw-warning)] font-medium' : ''}>
                          Renouvellement {daysToRenewal !== null && daysToRenewal >= 0
                            ? `dans ${daysToRenewal} j`
                            : `le ${new Date(s.renewal_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}`
                          }
                        </span>
                      )}
                      {s.commission_pct !== null && (
                        <span>Commission : {s.commission_pct} %</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--sw-ink-3)]">Page {page} / {totalPages} · {total} abonnements</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page - 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)]">← Précédent</a>
            )}
            {page < totalPages && (
              <a href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page + 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-primary)] text-white">Suivant →</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
