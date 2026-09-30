import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paiements organisme' }

// Spec 17.3 : statuts paiements organisme
const STATUS_LABELS: Record<string, string> = {
  authorized: 'Autorisé', invoiced: 'Facturé', expected: 'En attente',
  received: 'Reçu', rejected: 'Rejeté', reconciled: 'Rapproché',
}
const STATUS_CLASSES: Record<string, string> = {
  authorized: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  invoiced: 'bg-blue-50 text-blue-600',
  expected: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  received: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  rejected: 'bg-red-50 text-[var(--sw-danger)]',
  reconciled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type OrgPayment = {
  id: string; status: string; amount_fcfa: number; reference_code: string | null; created_at: string; reconciled_at: string | null
  pharmacy_reservations: { pharmacies: { name: string } | null; pharmacy_reservation_items: { medication_name: string }[] } | null
  patients: { profiles: { full_name: string | null } | null } | null
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
}

export default async function CouverturePaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('coverage_orgs').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const { data } = await supabase
    .from('payments')
    .select('id, status, amount_fcfa, reference_code, created_at, reconciled_at, pharmacy_reservations(pharmacies(name), pharmacy_reservation_items(medication_name)), patients(profiles(full_name))')
    .eq('payer_id', org.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const payments = (data ?? []) as unknown as OrgPayment[]

  // Résumé financier (spec 17.3: prise en charge autorisée, facture/demande, paiement attendu, reçu, rejeté, rapproché)
  const summary = {
    authorized: payments.filter(p => p.status === 'authorized').reduce((s, p) => s + p.amount_fcfa, 0),
    invoiced: payments.filter(p => p.status === 'invoiced').reduce((s, p) => s + p.amount_fcfa, 0),
    expected: payments.filter(p => p.status === 'expected').reduce((s, p) => s + p.amount_fcfa, 0),
    received: payments.filter(p => p.status === 'received').reduce((s, p) => s + p.amount_fcfa, 0),
    rejected: payments.filter(p => p.status === 'rejected').reduce((s, p) => s + p.amount_fcfa, 0),
    reconciled: payments.filter(p => p.status === 'reconciled').reduce((s, p) => s + p.amount_fcfa, 0),
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paiements & remboursements</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Suivi des règlements aux pharmacies</p>
      </div>

      {/* Tableau récap (spec 17.3) */}
      <div className="sw-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-3">Récapitulatif</p>
        {Object.entries(summary).map(([key, val]) => val > 0 ? (
          <div key={key} className="flex items-center justify-between py-1.5 border-b border-[var(--sw-line)] last:border-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[key] ?? ''}`}>
              {STATUS_LABELS[key] ?? key}
            </span>
            <span className="text-sm font-semibold text-[var(--sw-ink)]">{fmtCFA(val)}</span>
          </div>
        ) : null)}
      </div>

      {payments.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun paiement enregistré.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const resa = p.pharmacy_reservations as unknown as { pharmacies: { name: string } | null; pharmacy_reservation_items: { medication_name: string }[] } | null
            const phName = resa?.pharmacies?.name ?? null
            const medName = (resa?.pharmacy_reservation_items as { medication_name: string }[] | undefined)?.[0]?.medication_name ?? null
            const pat = (p.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name

            return (
              <div key={p.id} className="sw-card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  {p.status === 'received' || p.status === 'reconciled'
                    ? <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
                    : p.status === 'rejected'
                      ? <AlertCircle className="w-4 h-4 text-[var(--sw-danger)]" />
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
                  {medName && <p className="text-xs font-medium text-[var(--sw-ink)]">{medName}</p>}
                  <div className="flex items-center gap-2 text-xs text-[var(--sw-ink-3)]">
                    {phName && <span>{phName}</span>}
                    {pat && <span>· {pat}</span>}
                    <span>· {fmtDate(p.created_at)}</span>
                  </div>
                  {p.reference_code && <p className="text-xs font-mono text-[var(--sw-ink-3)]">{p.reference_code}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
