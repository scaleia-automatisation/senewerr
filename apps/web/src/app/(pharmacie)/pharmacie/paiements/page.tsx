import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CreditCard, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paiements pharmacie' }

// Spec 17.3 : statuts des paiements organisme
const STATUS_LABELS: Record<string, string> = {
  authorized: 'Autorisé', invoiced: 'Facturé', expected: 'En attente', received: 'Reçu',
  rejected: 'Rejeté', reconciled: 'Rapproché',
  // Patient payments
  pending: 'En attente', confirmed: 'Confirmé', failed: 'Échoué',
}
const STATUS_CLASSES: Record<string, string> = {
  authorized: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  invoiced: 'bg-blue-50 text-blue-600',
  expected: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  received: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  rejected: 'bg-red-50 text-[var(--sw-danger)]',
  reconciled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  failed: 'bg-red-50 text-[var(--sw-danger)]',
}

type Payment = {
  id: string; payment_type: string; amount_fcfa: number; status: string; method: string | null
  reference_code: string | null; created_at: string; confirmed_at: string | null
  pharmacy_reservations: { pharmacy_reservation_items: { medication_name: string }[] } | null
  coverage_requests: { id: string } | null
}

const TABS = [
  { key: 'patient', label: 'Patients', types: ['patient_charge'] },
  { key: 'organisme', label: 'Organismes', types: ['organisme_payment'] },
  { key: 'all', label: 'Tous', types: [] },
]

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
}

export default async function PharmaciePaiementsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'all' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string } | null
  if (!pharmacy) redirect('/connexion')

  const activeTab = TABS.find(t => t.key === tab) ?? TABS[2]
  let query = supabase
    .from('payments')
    .select('id, payment_type, amount_fcfa, status, method, reference_code, created_at, confirmed_at, pharmacy_reservations(pharmacy_reservation_items(medication_name)), coverage_requests(id)')
    .eq('pharmacy_id', pharmacy.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (activeTab.types.length > 0) {
    query = query.in('payment_type', activeTab.types)
  }

  const { data } = await query
  const payments = (data ?? []) as unknown as Payment[]

  const totalReceived = payments.filter(p => ['received', 'confirmed'].includes(p.status)).reduce((s, p) => s + p.amount_fcfa, 0)
  const totalPending = payments.filter(p => ['pending', 'expected', 'authorized', 'invoiced'].includes(p.status)).reduce((s, p) => s + p.amount_fcfa, 0)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paiements</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Règlements patients et organismes (spec 17.3)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="sw-card p-4 text-center">
          <p className="text-xs text-[var(--sw-ink-3)]">Reçus</p>
          <p className="text-lg font-bold text-[var(--sw-success)]">{fmtCFA(totalReceived)}</p>
        </div>
        <div className="sw-card p-4 text-center">
          <p className="text-xs text-[var(--sw-ink-3)]">En attente</p>
          <p className="text-lg font-bold text-[var(--sw-warning)]">{fmtCFA(totalPending)}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-[var(--sw-surface-2)] rounded-xl p-1">
        {TABS.map(t => (
          <Link key={t.key} href={`?tab=${t.key}`}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors ${t.key === tab ? 'bg-[var(--sw-surface)] text-[var(--sw-ink)] shadow-sm' : 'text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)]'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun paiement.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const medName = (p.pharmacy_reservations as unknown as { pharmacy_reservation_items: { medication_name: string }[] } | null)?.pharmacy_reservation_items?.[0]?.medication_name ?? null
            return (
              <div key={p.id} className="sw-card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  {['received', 'confirmed'].includes(p.status)
                    ? <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
                    : <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
                  }
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[p.status] ?? ''}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-sm font-bold text-[var(--sw-ink)] shrink-0">{fmtCFA(p.amount_fcfa)}</span>
                  </div>
                  {medName && <p className="text-xs text-[var(--sw-ink-2)]">{medName}</p>}
                  <div className="flex items-center gap-2 text-xs text-[var(--sw-ink-3)]">
                    <span>{fmtDate(p.created_at)}</span>
                    {p.reference_code && <span className="font-mono">{p.reference_code}</span>}
                    {p.coverage_requests && <span className="text-blue-600">Organisme</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
