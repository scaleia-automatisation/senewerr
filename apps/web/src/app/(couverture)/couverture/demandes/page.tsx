import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, Shield, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Demandes de prise en charge' }

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', reviewing: 'En cours', info_required: 'Infos requises',
  approved: 'Validée', partial: 'Partielle', refused: 'Refusée',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  reviewing: 'bg-blue-50 text-blue-600',
  info_required: 'bg-orange-50 text-orange-600',
  approved: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  partial: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
}

const TABS = [
  { key: 'active', label: 'À traiter', statuses: ['pending', 'reviewing', 'info_required'] },
  { key: 'done', label: 'Traitées', statuses: ['approved', 'partial', 'refused'] },
]

type CoverageRequest = {
  id: string; status: string; created_at: string; amount_total: number | null; amount_covered: number | null; amount_patient: number | null
  pharmacy_reservations: { id: string; pharmacy_reservation_items: { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[]; pharmacies: { name: string } | null } | null
  patients: { profiles: { full_name: string | null } | null } | null
}

function fmtCFA(n: number | null) {
  if (!n) return null
  return new Intl.NumberFormat('fr-SN').format(n) + ' F'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
}

export default async function DemandesCouverturePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabKey = 'active' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('id, actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { id: string; actor_type: string } | null
  if (!profile || profile.actor_type !== 'couverture') redirect('/connexion')

  const { data: orgData } = await supabase.from('organismes_couverture').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const activeTab = TABS.find(t => t.key === tabKey) ?? TABS[0]

  const { data } = await supabase
    .from('demandes_couverture')
    .select('id, status, created_at, amount_total, amount_covered, amount_patient, pharmacy_reservations(id, pharmacy_reservation_items(medication_name, pharmacy_products(dosage)), pharmacies(name)), patients(profiles(full_name))')
    .eq('coverage_org_id', org.id)
    .in('status', activeTab.statuses)
    .order('created_at', { ascending: false })

  const requests = (data ?? []) as unknown as CoverageRequest[]

  const { data: counts } = await supabase.from('demandes_couverture').select('status').eq('coverage_org_id', org.id)
  const tabCounts: Record<string, number> = { active: 0, done: 0 }
  for (const r of (counts ?? []) as unknown as { status: string }[]) {
    if (TABS[0].statuses.includes(r.status)) tabCounts.active++
    if (TABS[1].statuses.includes(r.status)) tabCounts.done++
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Prises en charge</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Demandes de remboursement à traiter</p>
      </div>

      <div className="flex gap-1 bg-[var(--sw-surface-2)] rounded-xl p-1">
        {TABS.map(t => (
          <Link key={t.key} href={`?tab=${t.key}`}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors ${t.key === tabKey ? 'bg-[var(--sw-surface)] text-[var(--sw-ink)] shadow-sm' : 'text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]'}`}>
            {t.label}
            {tabCounts[t.key] > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--sw-primary)] text-white text-xs">{tabCounts[t.key]}</span>}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Shield className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune demande {tabKey === 'active' ? 'à traiter' : 'traitée'}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => {
            const resa = (r.pharmacy_reservations as unknown as { id: string; pharmacy_reservation_items: { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[]; pharmacies: { name: string } | null } | null)
            const pat = (r.patients as unknown as { profiles: { full_name: string | null } | null } | null)
            const firstItem = (resa?.pharmacy_reservation_items as { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[] | undefined)?.[0]
            return (
              <Link key={r.id} href={`/couverture/demandes/${r.id}`}
                className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-[var(--sw-primary)]" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  {firstItem?.medication_name && <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{firstItem.medication_name}{firstItem.pharmacy_products?.dosage ? ` ${firstItem.pharmacy_products.dosage}` : ''}</p>}
                  {pat?.profiles?.full_name && <p className="text-xs text-[var(--sw-ink-2)]">{pat.profiles.full_name}</p>}
                  <div className="flex items-center gap-3 text-xs text-[var(--sw-ink-3)]">
                    <Clock className="w-3 h-3" />
                    <span>{fmtDate(r.created_at)}</span>
                    {r.amount_total && <span>{fmtCFA(r.amount_total)} total</span>}
                    {r.amount_covered && <span className="text-[var(--sw-success)]">{fmtCFA(r.amount_covered)} pris en charge</span>}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-1" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
