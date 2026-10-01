import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { History, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Historique — Pharmacie Séné Wérr' }

const STATUS_LABELS: Record<string, string> = {
  collected: 'Retirée', refused: 'Refusée', cancelled: 'Annulée', expired: 'Expirée',
}
const STATUS_CLASSES: Record<string, string> = {
  collected: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused:   'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
  expired:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtCFA(n: number) { return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA' }

type Res = {
  id: string
  pickup_code: string | null
  status: string
  total_amount_fcfa: number | null
  created_at: string
  collected_at: string | null
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  pharmacy_reservation_items: Array<{ id: string }>
}

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmacyData } = await supabase.from('pharmacies').select('id, name').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmacyData as unknown as { id: string; name: string } | null
  if (!pharmacy) redirect('/connexion')

  const { data: resData } = await supabase
    .from('reservations_pharmacie')
    .select('id, pickup_code, status, total_amount_fcfa, created_at, collected_at, patients(profiles(first_name, last_name)), pharmacy_reservation_items(id)')
    .eq('pharmacy_id', pharmacy.id)
    .in('status', ['collected', 'refused', 'cancelled', 'expired'])
    .order('created_at', { ascending: false })
    .limit(100)

  const history = (resData ?? []) as unknown as Res[]
  const totalCollected = history.filter(r => r.status === 'collected').reduce((s, r) => s + (r.total_amount_fcfa ?? 0), 0)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <History className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Historique</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Réservations terminées</p>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3">
        <div className="sw-card p-4 space-y-1">
          <p className="text-xs text-[var(--sw-ink-2)]">Total retraits</p>
          <p className="text-2xl font-bold text-[var(--sw-success)]">{history.filter(r => r.status === 'collected').length}</p>
        </div>
        <div className="sw-card p-4 space-y-1">
          <p className="text-xs text-[var(--sw-ink-2)]">Revenus encaissés</p>
          <p className="text-xl font-bold text-[var(--sw-ink)]">{fmtCFA(totalCollected)}</p>
        </div>
      </div>

      {/* Liste */}
      {history.length === 0 ? (
        <div className="sw-card p-8 text-center">
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune réservation terminée pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(r => {
            const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
            const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
            const itemCount = (r.pharmacy_reservation_items as unknown as Array<{ id: string }>).length
            return (
              <Link key={r.id} href={`/pharmacie/reservations/${r.id}`} className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-sm font-bold text-[var(--sw-ink)]">
                      {r.pickup_code ? `MED-${r.pickup_code}` : r.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--sw-ink-2)]">
                    {patName} · {itemCount} médicament{itemCount !== 1 ? 's' : ''}
                    {r.collected_at ? ` · ${fmtDate(r.collected_at)}` : ` · ${fmtDate(r.created_at)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.total_amount_fcfa != null && r.status === 'collected' && (
                    <p className="text-sm font-semibold text-[var(--sw-ink)]">{fmtCFA(r.total_amount_fcfa)}</p>
                  )}
                  <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] ml-auto mt-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
