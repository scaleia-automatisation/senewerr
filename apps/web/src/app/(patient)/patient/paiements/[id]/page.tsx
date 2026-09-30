import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, CreditCard, CheckCircle2, Clock, XCircle, Download } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Détail paiement' }

const TYPE_LABELS: Record<string, string> = {
  patient_charge: 'Reste à charge patient',
  refund: 'Remboursement',
  advance: 'Avance',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de confirmation', confirmed: 'Paiement confirmé',
  failed: 'Paiement échoué', refunded: 'Remboursé',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  failed: 'bg-red-50 text-[var(--sw-danger)]',
  refunded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
}
const METHOD_LABELS: Record<string, string> = {
  mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte bancaire',
  orange_money: 'Orange Money', wave: 'Wave', free_money: 'Free Money',
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="py-2.5 border-b border-[var(--sw-line)] last:border-0">
      <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
      <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value}</p>
    </div>
  )
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function PaiementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const { data: payData } = await supabase
    .from('payments')
    .select('id, payment_type, amount_fcfa, status, method, reference_code, notes, receipt_url, created_at, confirmed_at, pharmacy_reservations(id, pharmacy_reservation_items(medication_name, pharmacy_products(dosage)), pharmacies(name)), coverage_requests(id, amount_covered, amount_patient)')
    .eq('id', id)
    .eq('patient_id', patient.id)
    .maybeSingle()

  const pay = payData as unknown as {
    id: string; payment_type: string; amount_fcfa: number; status: string; method: string | null
    reference_code: string | null; notes: string | null; receipt_url: string | null
    created_at: string; confirmed_at: string | null
    pharmacy_reservations: { id: string; pharmacy_reservation_items: { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[]; pharmacies: { name: string } | null } | null
    coverage_requests: { id: string; amount_covered: number | null; amount_patient: number | null } | null
  } | null

  if (!pay) notFound()

  const resa = pay.pharmacy_reservations as unknown as typeof pay.pharmacy_reservations
  const firstItem = (resa?.pharmacy_reservation_items as { medication_name: string; pharmacy_products?: { dosage?: string | null } | null }[] | undefined)?.[0]
  const ph = resa?.pharmacies as unknown as { name: string } | null
  const cov = pay.coverage_requests as unknown as { id: string; amount_covered: number | null; amount_patient: number | null } | null
  const statusIcon = {
    pending: <Clock className="w-10 h-10 text-[var(--sw-warning)]" />,
    confirmed: <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)]" />,
    failed: <XCircle className="w-10 h-10 text-[var(--sw-danger)]" />,
    refunded: <CheckCircle2 className="w-10 h-10 text-[var(--sw-primary)]" />,
  }[pay.status] ?? <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)]" />

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/patient/paiements" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Paiements
      </Link>

      {/* Montant + statut (spec 17.2) */}
      <div className="sw-card p-6 text-center space-y-3">
        <div className="flex justify-center">{statusIcon}</div>
        <div>
          <p className="text-3xl font-bold text-[var(--sw-ink)]">
            {pay.payment_type === 'refund' ? '+' : ''}{fmtCFA(pay.amount_fcfa)}
          </p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">{TYPE_LABELS[pay.payment_type] ?? pay.payment_type}</p>
        </div>
        <span className={`inline-block text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_CLASSES[pay.status] ?? ''}`}>
          {STATUS_LABELS[pay.status] ?? pay.status}
        </span>
      </div>

      {/* Détails (spec 17.2: montant, bénéficiaire, référence, statut, justificatif) */}
      <div className="sw-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-1">Détails</p>
        <Field label="Référence" value={pay.reference_code} />
        <Field label="Bénéficiaire" value={ph?.name ?? null} />
        <Field label="Médicament" value={firstItem ? `${firstItem.medication_name}${firstItem.pharmacy_products?.dosage ? ` ${firstItem.pharmacy_products.dosage}` : ''}` : null} />
        <Field label="Mode de paiement" value={pay.method ? (METHOD_LABELS[pay.method] ?? pay.method) : null} />
        <Field label="Date" value={fmtDateTime(pay.created_at)} />
        {pay.confirmed_at && <Field label="Confirmé le" value={fmtDateTime(pay.confirmed_at)} />}
        {pay.notes && <Field label="Note" value={pay.notes} />}
      </div>

      {/* Prise en charge associée */}
      {cov && (
        <div className="sw-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Couverture</p>
          <div className="grid grid-cols-2 gap-3">
            {cov.amount_covered && (
              <div className="sw-card p-3 text-center">
                <p className="text-xs text-[var(--sw-ink-3)]">Pris en charge</p>
                <p className="text-sm font-bold text-[var(--sw-success)]">{fmtCFA(cov.amount_covered)}</p>
              </div>
            )}
            {cov.amount_patient != null && (
              <div className="sw-card p-3 text-center">
                <p className="text-xs text-[var(--sw-ink-3)]">Votre part</p>
                <p className="text-sm font-bold text-[var(--sw-ink)]">{fmtCFA(cov.amount_patient)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Justificatif (spec 17.2) */}
      {pay.status === 'confirmed' && (
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--sw-success-bg)] flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-[var(--sw-success)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--sw-ink)]">Justificatif disponible</p>
            <p className="text-xs text-[var(--sw-ink-3)]">Réf. {pay.reference_code ?? pay.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {pay.receipt_url ? (
            <a href={pay.receipt_url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-[var(--sw-success)] text-white text-xs font-medium">
              Télécharger
            </a>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] text-xs">En cours</span>
          )}
        </div>
      )}
    </div>
  )
}
