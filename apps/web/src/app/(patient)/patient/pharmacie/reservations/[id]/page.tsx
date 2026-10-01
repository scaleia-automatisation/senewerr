import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, Clock, AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ma réservation' }

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'À vérifier', awaiting_coverage: 'En attente de couverture',
  awaiting_payment: 'En attente de paiement', funded: 'Financée', to_prepare: 'À préparer',
  preparing: 'En préparation', ready: 'Prête au retrait', collected: 'Retirée',
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

export default async function PatientReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const { data: resaData } = await supabase
    .from('reservations_pharmacie')
    .select('id, status, created_at, expiry_at, pickup_code, has_coverage, quantity, notes, pharmacist_notes, pharmacies(name, address_commune, address_region, phone), pharmacy_reservation_items(medication_name, pharmacy_products(dosage, form, prescription_required)), prescriptions(id)')
    .eq('id', id)
    .eq('patient_id', patient.id)
    .maybeSingle()

  const resa = resaData as unknown as {
    id: string; status: string; created_at: string; expiry_at: string | null; pickup_code: string | null
    has_coverage: boolean; quantity: number | null; notes: string | null; pharmacist_notes: string | null
    pharmacies: { name: string; address_commune: string | null; address_region: string | null; phone: string | null } | null
    pharmacy_reservation_items: { medication_name: string; pharmacy_products: { dosage: string | null; form: string | null; prescription_required: boolean } | null }[]
    prescriptions: { id: string } | null
  } | null

  if (!resa) notFound()

  const ph = (resa.pharmacies as unknown as { name: string; address_commune: string | null; address_region: string | null; phone: string | null } | null)
  const firstItem = resa.pharmacy_reservation_items?.[0]
  const med = firstItem ? { name: firstItem.medication_name, dosage: firstItem.pharmacy_products?.dosage ?? null, presentation: firstItem.pharmacy_products?.form ?? null, requires_prescription: firstItem.pharmacy_products?.prescription_required ?? false } : null
  const refCode = resa.pickup_code ? `MED-${resa.pickup_code}` : null

  function fmtDateTime(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const canCancel = ['new', 'verifying'].includes(resa.status)
  const isExpiringSoon = resa.expiry_at && (new Date(resa.expiry_at).getTime() - Date.now()) < 24 * 3600 * 1000 * 2 && !['collected', 'refused', 'cancelled', 'expired'].includes(resa.status)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/patient/pharmacie" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Pharmacie
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
          {resa.quantity && <Field label="Quantité" value={`${resa.quantity}`} />}
          {ph?.name && (
            <div className="py-2.5 border-b border-[var(--sw-line)]">
              <p className="text-xs text-[var(--sw-ink-3)] font-medium">Pharmacie</p>
              <p className="text-sm text-[var(--sw-ink)] mt-0.5">{ph.name}</p>
              {(ph.address_commune || ph.address_region) && (
                <div className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)] mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span>{[ph.address_commune, ph.address_region].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {ph.phone && <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">{ph.phone}</p>}
            </div>
          )}
          <Field label="Réservé le" value={fmtDateTime(resa.created_at)} />
          {resa.expiry_at && <Field label="Expire le" value={fmtDateTime(resa.expiry_at)} />}
          {resa.notes && <Field label="Votre note" value={resa.notes} />}
          {resa.pharmacist_notes && <Field label="Note du pharmacien" value={resa.pharmacist_notes} />}
          {resa.has_coverage && <Field label="Couverture" value="Prise en charge demandée" />}
        </div>
      </div>

      {/* Alerte expiration proche */}
      {isExpiringSoon && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--sw-warning-bg)] border border-[var(--sw-warning)]/30">
          <Clock className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--sw-warning)]">
            Cette réservation expire bientôt. Venez retirer vos médicaments à la pharmacie {ph?.name ?? ''} avant la date d'expiration.
          </p>
        </div>
      )}

      {/* Bouton annulation */}
      {canCancel && (
        <Link href={`/patient/pharmacie/reservations/${id}/annuler`}
          className="w-full py-2.5 rounded-xl border border-[var(--sw-danger)] text-[var(--sw-danger)] text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Annuler la réservation
        </Link>
      )}
    </div>
  )
}
