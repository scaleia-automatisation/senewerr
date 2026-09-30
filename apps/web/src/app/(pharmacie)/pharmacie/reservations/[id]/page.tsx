import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, FileText } from 'lucide-react'
import { ReservationStatusActions } from '@/components/pharmacie/reservation-status-actions'
import { PreparationConditions } from '@/components/pharmacie/preparation-conditions'
import type { PrepConditions } from '@/components/pharmacie/preparation-conditions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Détail réservation' }

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'À vérifier', awaiting_coverage: 'En attente de couverture',
  awaiting_payment: 'En attente de paiement', funded: 'Financée', to_prepare: 'À préparer',
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

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="py-2.5 border-b border-[var(--sw-line)] last:border-0">
      <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
      <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value}</p>
    </div>
  )
}

export default async function PharmacieReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string } | null
  if (!pharmacy) redirect('/connexion')

  const { data: resaData } = await supabase
    .from('pharmacy_reservations')
    .select('id, status, created_at, expires_at, quantity, notes, pharmacist_notes, has_coverage, pickup_code, patients(id, profiles(full_name, phone)), pharmacy_reservation_items(medication_name, pharmacy_products(dosage, form, prescription_required)), prescriptions(id, issued_at)')
    .eq('id', id)
    .eq('pharmacy_id', pharmacy.id)
    .maybeSingle()

  const resa = resaData as unknown as {
    id: string; status: string; created_at: string; expires_at: string | null; quantity: number | null
    notes: string | null; pharmacist_notes: string | null; has_coverage: boolean; pickup_code: string | null
    patients: { id: string; profiles: { full_name: string | null; phone: string | null } | null } | null
    pharmacy_reservation_items: { medication_name: string; pharmacy_products: { dosage: string | null; form: string | null; prescription_required: boolean } | null }[]
    prescriptions: { id: string; issued_at: string | null } | null
  } | null

  if (!resa) notFound()

  // Spec 17.4 — fetch conditions data in parallel
  const [covRes, payRes] = await Promise.all([
    supabase.from('coverage_requests')
      .select('id, status, amount_patient')
      .eq('reservation_id', id)
      .maybeSingle(),
    supabase.from('payments')
      .select('id, status')
      .eq('reservation_id', id)
      .eq('payment_type', 'patient_charge')
      .eq('status', 'confirmed')
      .maybeSingle(),
  ])

  const cov = covRes.data as unknown as { id: string; status: string; amount_patient: number | null } | null
  const confirmedPayment = payRes.data as unknown as { id: string; status: string } | null

  type ResaRaw = {
    pharmacy_reservation_items: { pharmacy_products: { prescription_required: boolean } | null }[]
    prescriptions: { id: string } | null
    patients: { id: string } | null
  }
  const resaRaw = resaData as unknown as ResaRaw | null
  const med2 = resaRaw?.pharmacy_reservation_items?.[0] ?? null
  const presc2 = resaRaw?.prescriptions ?? null

  const prepConditions: PrepConditions = {
    reservationId: id,
    patientId: resaRaw?.patients?.id ?? null,
    reservationConfirmed: !['new'].includes(resa.status),
    prescriptionRequired: med2?.pharmacy_products?.prescription_required === true,
    prescriptionPresent: presc2 !== null,
    coverageRequested: resa.has_coverage,
    coverageApproved: cov !== null && ['approved', 'partial'].includes(cov.status),
    resteAChargeRequired: (cov?.amount_patient ?? 0) > 0,
    resteAChargePaid: confirmedPayment !== null,
    deferred: false,
    allMet: false,
  }
  prepConditions.allMet =
    prepConditions.reservationConfirmed &&
    (!prepConditions.prescriptionRequired || prepConditions.prescriptionPresent) &&
    (!prepConditions.coverageRequested || prepConditions.coverageApproved) &&
    (!prepConditions.resteAChargeRequired || prepConditions.resteAChargePaid || prepConditions.deferred)

  const blockedTransitions = prepConditions.allMet ? [] : ['to_prepare']
  const blockReasons: Record<string, string> = prepConditions.allMet ? {} : {
    to_prepare: 'Conditions de préparation non remplies (spec 17.4) — vérifiez ordonnance, couverture et paiement',
  }

  const pat = (resa.patients as unknown as { id: string; profiles: { full_name: string | null; phone: string | null } | null } | null)
  const firstItem = resa.pharmacy_reservation_items?.[0]
  const med = firstItem ? { name: firstItem.medication_name, dosage: firstItem.pharmacy_products?.dosage ?? null, presentation: firstItem.pharmacy_products?.form ?? null, requires_prescription: firstItem.pharmacy_products?.prescription_required ?? false } : null
  const presc = (resa.prescriptions as unknown as { id: string; issued_at: string | null } | null)
  const refCode = resa.pickup_code ? `MED-${resa.pickup_code}` : null

  function fmtDateTime(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const terminalStatuses = ['collected', 'refused', 'cancelled', 'expired']
  const isTerminal = terminalStatuses.includes(resa.status)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/pharmacie/reservations" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Réservations
      </Link>

      {/* Header */}
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div className="flex-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASSES[resa.status] ?? ''}`}>
              {STATUS_LABELS[resa.status] ?? resa.status}
            </span>
            {refCode && <p className="text-xs font-mono text-[var(--sw-ink-2)] mt-1">{refCode}</p>}
          </div>
        </div>
        <div>
          {med?.name && <Field label="Médicament" value={`${med.name}${med.dosage ? ` ${med.dosage}` : ''}${med.presentation ? ` · ${med.presentation}` : ''}`} />}
          {resa.quantity && <Field label="Quantité demandée" value={`${resa.quantity}`} />}
          {med?.requires_prescription && <Field label="Ordonnance" value="Requise" />}
          <Field label="Réservé le" value={fmtDateTime(resa.created_at)} />
          {resa.expires_at && <Field label="Expire le" value={fmtDateTime(resa.expires_at)} />}
        </div>
      </div>

      {/* Patient */}
      <div className="sw-card p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Patient</p>
        {pat?.profiles?.full_name ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center text-sm font-bold text-[var(--sw-ink-2)]">
              {pat.profiles.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">{pat.profiles.full_name}</p>
              {pat.profiles.phone && (
                <div className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)]">
                  <MapPin className="w-3 h-3" /> {pat.profiles.phone}
                </div>
              )}
            </div>
          </div>
        ) : <p className="text-sm text-[var(--sw-ink-3)]">Informations patient non disponibles</p>}
        {resa.has_coverage && <p className="text-xs text-blue-600 mt-2">Prise en charge (couverture) demandée</p>}
        {resa.notes && (
          <div className="mt-2 p-2.5 rounded-xl bg-[var(--sw-surface-2)]">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium mb-0.5">Note du patient</p>
            <p className="text-xs text-[var(--sw-ink)] italic">{resa.notes}</p>
          </div>
        )}
      </div>

      {/* Ordonnance jointe */}
      {presc && (
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--sw-ink)]">Ordonnance jointe</p>
            {presc.issued_at && <p className="text-xs text-[var(--sw-ink-3)]">Émise le {new Date(presc.issued_at).toLocaleDateString('fr-SN')}</p>}
          </div>
        </div>
      )}

      {/* Conditions de préparation (spec 17.4) */}
      {!isTerminal && ['verifying', 'funded', 'awaiting_coverage', 'awaiting_payment'].includes(resa.status) && (
        <PreparationConditions conditions={prepConditions} />
      )}

      {/* Actions de statut */}
      {!isTerminal && (
        <ReservationStatusActions
          reservationId={resa.id}
          currentStatus={resa.status}
          pharmacistNotes={resa.pharmacist_notes ?? ''}
          blockedTransitions={blockedTransitions}
          blockReasons={blockReasons}
        />
      )}
    </div>
  )
}
