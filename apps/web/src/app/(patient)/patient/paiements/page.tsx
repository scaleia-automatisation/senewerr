import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, CreditCard, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes paiements' }

const TYPE_LABELS: Record<string, string> = {
  patient_charge: 'Reste à charge',
  refund: 'Remboursement',
  advance: 'Avance',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', failed: 'Échoué', refunded: 'Remboursé',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  failed: 'bg-red-50 text-[var(--sw-danger)]',
  refunded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
}
const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-[var(--sw-warning)]" />,
  confirmed: <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />,
  failed: <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />,
  refunded: <CheckCircle2 className="w-4 h-4 text-[var(--sw-primary)]" />,
}

type Payment = {
  id: string; payment_type: string; amount_fcfa: number; status: string; method: string | null
  reference_code: string | null; created_at: string; confirmed_at: string | null
  pharmacy_reservations: { pharmacy_reservation_items: { medication_name: string }[] } | null
  appointments: { professionals: { profiles: { full_name: string | null } | null } | null } | null
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PatientPaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const payments: Payment[] = []
  if (patient) {
    const { data } = await supabase
      .from('paiements')
      .select('id, payment_type, amount_fcfa, status, method, reference_code, created_at, confirmed_at, pharmacy_reservations(pharmacy_reservation_items(medication_name)), appointments(professionals(profiles(full_name)))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) payments.push(...(data as unknown as Payment[]))
  }

  const totalPaid = payments.filter(p => p.status === 'confirmed' && p.payment_type !== 'refund').reduce((s, p) => s + p.amount_fcfa, 0)
  const totalRefunded = payments.filter(p => p.payment_type === 'refund' && p.status === 'confirmed').reduce((s, p) => s + p.amount_fcfa, 0)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes paiements</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Historique et justificatifs</p>
      </div>

      {/* Résumé */}
      {payments.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="sw-card p-4 text-center">
            <p className="text-xs text-[var(--sw-ink-3)]">Total payé</p>
            <p className="text-lg font-bold text-[var(--sw-ink)] mt-0.5">{fmtCFA(totalPaid)}</p>
          </div>
          <div className="sw-card p-4 text-center">
            <p className="text-xs text-[var(--sw-ink-3)]">Remboursements</p>
            <p className="text-lg font-bold text-[var(--sw-success)] mt-0.5">{fmtCFA(totalRefunded)}</p>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun paiement enregistré.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const medName = (p.pharmacy_reservations as unknown as { pharmacy_reservation_items: { medication_name: string }[] } | null)?.pharmacy_reservation_items?.[0]?.medication_name ?? null
            const pro = (p.appointments as unknown as { professionals: { profiles: { full_name: string | null } | null } | null } | null)?.professionals?.profiles
            return (
              <Link key={p.id} href={`/patient/paiements/${p.id}`}
                className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  {STATUS_ICONS[p.status] ?? <CreditCard className="w-4 h-4 text-[var(--sw-ink-3)]" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[p.status] ?? ''}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-sm font-bold text-[var(--sw-ink)] shrink-0">
                      {p.payment_type === 'refund' ? '+' : ''}{fmtCFA(p.amount_fcfa)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--sw-ink)]">
                    {TYPE_LABELS[p.payment_type] ?? p.payment_type}
                    {medName ? ` · ${medName}` : ''}
                    {pro?.full_name ? ` · Dr ${pro.full_name}` : ''}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--sw-ink-3)]">
                    <span>{fmtDate(p.created_at)}</span>
                    {p.method && <span className="capitalize">{p.method.replace('_', ' ')}</span>}
                    {p.reference_code && <span className="font-mono">{p.reference_code}</span>}
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
