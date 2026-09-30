import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, TrendingUp, Clock, XCircle, CheckCircle2, Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paiements — Admin' }

const PAY_TYPE_LABELS: Record<string, string> = {
  patient_charge: 'Reste à charge', refund: 'Remboursement',
  organisme_payment: 'Paiement organisme', advance: 'Avance',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', pending_at_counter: 'En attente (espèces)',
  confirmed: 'Confirmé', failed: 'Échoué', refunded: 'Remboursé',
  authorized: 'Autorisé', invoiced: 'Facturé', expected: 'En attente',
  received: 'Reçu', rejected: 'Rejeté', reconciled: 'Rapproché',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  pending_at_counter: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  failed: 'bg-red-50 text-[var(--sw-danger)]',
  refunded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  authorized: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  invoiced: 'bg-blue-50 text-blue-600',
  expected: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  received: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  rejected: 'bg-red-50 text-[var(--sw-danger)]',
  reconciled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Payment = {
  id: string; payment_type: string; amount_fcfa: number; status: string; method: string | null
  reference_code: string | null; created_at: string
  patients: { profiles: { full_name: string | null } | null } | null
  pharmacies: { name: string } | null
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; color: string
}) {
  return (
    <div className="sw-card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--sw-ink-3)]">{label}</p>
        <p className="text-base font-bold text-[var(--sw-ink)]">{value}</p>
        {sub && <p className="text-xs text-[var(--sw-ink-3)]">{sub}</p>}
      </div>
    </div>
  )
}

export default async function AdminPaiementsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: filterStatus } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('id, actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { id: string; actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  // Fetch all payments for consolidated view (spec 17.5)
  let query = supabase
    .from('payments')
    .select('id, payment_type, amount_fcfa, status, method, reference_code, created_at, patients(profiles(full_name)), pharmacies(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filterStatus) query = query.eq('status', filterStatus)

  const { data } = await query
  const payments = (data ?? []) as unknown as Payment[]

  // Computed stats
  const confirmedPatient = payments.filter(p => p.status === 'confirmed' && p.payment_type === 'patient_charge').reduce((s, p) => s + p.amount_fcfa, 0)
  const confirmedOrganisme = payments.filter(p => ['received', 'reconciled'].includes(p.status) && p.payment_type === 'organisme_payment').reduce((s, p) => s + p.amount_fcfa, 0)
  const pendingCount = payments.filter(p => ['pending', 'pending_at_counter', 'expected'].includes(p.status)).length
  const rejectedCount = payments.filter(p => ['failed', 'rejected'].includes(p.status)).length

  const STATUS_FILTERS = [
    { key: '', label: 'Tous' },
    { key: 'pending', label: 'En attente' },
    { key: 'confirmed', label: 'Confirmés' },
    { key: 'failed', label: 'Échoués' },
    { key: 'rejected', label: 'Rejetés' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paiements — Vue consolidée</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 17.5 — tous les acteurs</p>
      </div>

      {/* Stats (spec 17.5) */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Reçus patients" value={fmtCFA(confirmedPatient)}
          icon={<CreditCard className="w-5 h-5 text-[var(--sw-success)]" />}
          color="bg-[var(--sw-success-bg)]"
        />
        <StatCard
          label="Reçus organismes" value={fmtCFA(confirmedOrganisme)}
          icon={<Shield className="w-5 h-5 text-[var(--sw-primary)]" />}
          color="bg-[var(--sw-primary-subtle)]"
        />
        <StatCard
          label="En attente" value={`${pendingCount} paiement${pendingCount > 1 ? 's' : ''}`}
          icon={<Clock className="w-5 h-5 text-[var(--sw-warning)]" />}
          color="bg-[var(--sw-warning-bg)]"
          sub="Confirmation prestataire requise"
        />
        <StatCard
          label="Rejetés" value={`${rejectedCount}`}
          icon={<XCircle className="w-5 h-5 text-[var(--sw-danger)]" />}
          color="bg-red-50"
          sub={rejectedCount > 0 ? 'À investiguer' : 'Aucun'}
        />
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {STATUS_FILTERS.map(f => (
          <a key={f.key} href={f.key ? `?status=${f.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(f.key === filterStatus || (!filterStatus && !f.key)) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {f.label}
          </a>
        ))}
      </div>

      {/* Table (spec 17.5 : patient/pharmacie/organisme) */}
      {payments.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <TrendingUp className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun paiement.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {payments.map(p => {
              const patName = (p.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name
              const phName = (p.pharmacies as unknown as { name: string } | null)?.name
              return (
                <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    {['confirmed', 'received', 'reconciled'].includes(p.status)
                      ? <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
                      : ['failed', 'rejected'].includes(p.status)
                        ? <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
                        : <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLASSES[p.status] ?? ''}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                        <span className="text-xs text-[var(--sw-ink-3)]">
                          {PAY_TYPE_LABELS[p.payment_type] ?? p.payment_type}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-[var(--sw-ink)]">{fmtCFA(p.amount_fcfa)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--sw-ink-3)] flex-wrap">
                      {patName && <span>{patName}</span>}
                      {phName && <span>→ {phName}</span>}
                      <span>· {fmtDate(p.created_at)}</span>
                      {p.method && <span>· {p.method.replace('_', ' ')}</span>}
                      {p.reference_code && <span className="font-mono">{p.reference_code}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
