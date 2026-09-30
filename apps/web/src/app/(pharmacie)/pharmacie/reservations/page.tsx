import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, Package, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Réservations médicaments' }

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'À vérifier', awaiting_coverage: 'En attente couverture',
  awaiting_payment: 'En attente paiement', funded: 'Financée', to_prepare: 'À préparer',
  preparing: 'En préparation', ready: 'Prête', collected: 'Retirée',
  refused: 'Refusée', cancelled: 'Annulée', expired: 'Expirée',
}
const STATUS_CLASSES: Record<string, string> = {
  new: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  awaiting_coverage: 'bg-blue-50 text-blue-600',
  awaiting_payment: 'bg-orange-50 text-orange-600',
  funded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  to_prepare: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  preparing: 'bg-blue-50 text-blue-600',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  expired: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

const TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'active', label: 'Actives', statuses: ['new', 'verifying', 'awaiting_coverage', 'awaiting_payment', 'funded', 'to_prepare', 'preparing'] },
  { key: 'ready', label: 'Prêtes', statuses: ['ready'] },
  { key: 'done', label: 'Terminées', statuses: ['collected', 'refused', 'cancelled', 'expired'] },
]

type Reservation = {
  id: string; status: string; created_at: string; expires_at: string | null; quantity: number | null
  patients: { profiles: { full_name: string | null } | null } | null
  pharmacy_reservation_items: { medication_name: string; pharmacy_products: { dosage: string | null } | null }[]
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function PharmacieReservationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabKey = 'active' } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('id, actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { id: string; actor_type: string } | null
  if (!profile || profile.actor_type !== 'pharmacie') redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string } | null
  if (!pharmacy) redirect('/connexion')

  const activeTab = TABS.find(t => t.key === tabKey) ?? TABS[0]

  const { data } = await supabase
    .from('pharmacy_reservations')
    .select('id, status, created_at, expires_at, quantity, patients(profiles(full_name)), pharmacy_reservation_items(medication_name, pharmacy_products(dosage))')
    .eq('pharmacy_id', pharmacy.id)
    .in('status', activeTab.statuses)
    .order('created_at', { ascending: false })

  const reservations = (data ?? []) as unknown as Reservation[]
  const counts: Record<string, number> = {}
  for (const t of TABS) counts[t.key] = 0
  const { data: allStatuses } = await supabase.from('pharmacy_reservations').select('status').eq('pharmacy_id', pharmacy.id)
  for (const row of (allStatuses ?? []) as unknown as { status: string }[]) {
    for (const t of TABS) { if (t.statuses.includes(row.status)) counts[t.key]++ }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Réservations</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Médicaments réservés par les patients</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--sw-surface-2)] rounded-xl p-1">
        {TABS.map(t => (
          <Link key={t.key} href={`?tab=${t.key}`}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors ${t.key === tabKey ? 'bg-[var(--sw-surface)] text-[var(--sw-ink)] shadow-sm' : 'text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]'}`}>
            {t.label}
            {counts[t.key] > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--sw-primary)] text-white text-xs">{counts[t.key]}</span>}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {reservations.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Package className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune réservation {activeTab.label.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map(r => {
            const pat = (r.patients as unknown as { profiles: { full_name: string | null } | null } | null)
            const _item = r.pharmacy_reservation_items?.[0]; const med = _item ? { name: _item.medication_name, dosage: _item.pharmacy_products?.dosage ?? null } : null
            const isExpiringSoon = r.expires_at && (new Date(r.expires_at).getTime() - Date.now()) < 24 * 3600 * 1000 * 2
            return (
              <Link key={r.id} href={`/pharmacie/reservations/${r.id}`}
                className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-[var(--sw-primary)]" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {isExpiringSoon && (
                      <span className="flex items-center gap-1 text-xs text-[var(--sw-warning)]">
                        <Clock className="w-3 h-3" /> Expire bientôt
                      </span>
                    )}
                  </div>
                  {med?.name && <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{med.name}{med.dosage ? ` ${med.dosage}` : ''}{r.quantity ? ` × ${r.quantity}` : ''}</p>}
                  {pat?.profiles?.full_name && <p className="text-xs text-[var(--sw-ink-2)]">{pat.profiles.full_name}</p>}
                  <p className="text-xs text-[var(--sw-ink-3)]">{fmtDate(r.created_at)}</p>
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
