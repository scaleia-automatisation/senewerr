'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendNotificationAction } from '@/app/actions/notifications'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Package, MapPin, AlertTriangle, FileText, Info } from 'lucide-react'

type Product = {
  id: string; name: string; dosage: string | null
  prescription_required: boolean; unit_price_fcfa: number
}
type Pharmacy = {
  id: string; name: string; address_commune: string | null
  address_region: string | null; phone: string | null; profile_id: string
}
type Stock = { id: string; quantity_available: number | null } | null
type Prescription = { id: string; status: string; created_at: string }

type Props = {
  patientId: string
  product: Product
  pharmacy: Pharmacy
  stock: Stock
  prescriptions: Prescription[]
  preselectedPrescriptionId: string | null
}

const DEFAULT_EXPIRY_HOURS = 72

function fmtCFA(n: number | null) {
  if (n == null) return null
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

type InsertFn = {
  insert: (v: unknown) => {
    select: (q: string) => {
      single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>
    }
  }
}

export function ReservationFlow({ patientId, product, pharmacy, stock, prescriptions, preselectedPrescriptionId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [prescriptionId, setPrescriptionId] = useState<string | null>(preselectedPrescriptionId)
  const [hasCoverage, setHasCoverage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successId, setSuccessId] = useState<string | null>(null)

  const price = product.unit_price_fcfa ?? null
  const total = price ? price * quantity : null

  async function handleConfirm() {
    setError(''); setSubmitting(true)
    const supabase = createClient()
    const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 3600 * 1000).toISOString()

    // 1. Créer la réservation
    const { data: reservation, error: reservErr } = await (supabase.from('pharmacy_reservations') as unknown as InsertFn)
      .insert({
        patient_id: patientId,
        pharmacy_id: pharmacy.id,
        prescription_id: prescriptionId || null,
        status: 'new',
        expiry_at: expiresAt,
        total_amount_fcfa: total ?? 0,
        has_coverage: hasCoverage,
        notes: notes || null,
      })
      .select('id')
      .single()

    if (reservErr) { setError(reservErr.message); setSubmitting(false); return }

    const reservationId = reservation!.id

    // 2. Ajouter l'article de réservation
    const { error: itemErr } = await (supabase.from('pharmacy_reservation_items') as unknown as { insert: (v: unknown) => Promise<{ error: Error | null }> }).insert({
      reservation_id: reservationId,
      product_id: product.id,
      medication_name: product.name,
      quantity,
      unit_price_fcfa: price ?? null,
      total_price_fcfa: total ?? null,
    })

    if (itemErr) {
      setError(itemErr.message); setSubmitting(false); return
    }

    // 3. Notifier la pharmacie et le patient (fire-and-forget)
    sendNotificationAction({
      recipient_id: pharmacy.profile_id,
      type: 'reservation_confirmed',
      body: `Nouvelle réservation — ${product.name} × ${quantity}`,
      reference_type: 'reservation',
      reference_id: reservationId,
    }).catch(() => {})

    // Récupérer le profile_id du patient pour lui confirmer la réservation
    const supabase2 = createClient()
    supabase2.from('patients').select('profile_id').eq('id', patientId).maybeSingle().then(({ data }) => {
      if (data?.profile_id) {
        sendNotificationAction({
          recipient_id: (data as unknown as { profile_id: string }).profile_id,
          type: 'reservation_confirmed',
          body: `Votre réservation de ${product.name} chez ${pharmacy.name} a bien été transmise.`,
          reference_type: 'reservation',
          reference_id: reservationId,
        }).catch(() => {})
      }
    }).catch(() => {})

    setSuccessId(reservationId)
    setSubmitting(false)
  }

  if (successId) {
    return (
      <div className="sw-card p-10 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-[var(--sw-success)] mx-auto" />
        <div>
          <p className="text-base font-bold text-[var(--sw-ink)]">Réservation confirmée</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1">
            La pharmacie <strong>{pharmacy.name}</strong> a été notifiée. Vous recevrez une mise à jour du statut.
          </p>
        </div>
        <p className="text-xs text-[var(--sw-ink-3)]">
          Validité : {DEFAULT_EXPIRY_HOURS} heures. Venez retirer votre médicament avant l'expiration.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={() => router.push(`/patient/pharmacie/reservations/${successId}`)}
            className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            Voir ma réservation
          </button>
          <button onClick={() => router.push('/patient/pharmacie')}
            className="w-full py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm">
            Retour à mes réservations
          </button>
        </div>
      </div>
    )
  }

  const steps = ['Récapitulatif', 'Quantité & Options', 'Confirmation']
  const stepIdx = step

  return (
    <div className="space-y-5">
      {/* Indicateur étapes */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${i < stepIdx ? 'bg-[var(--sw-success)] text-white' : i === stepIdx ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
              {i < stepIdx ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i === stepIdx ? 'text-[var(--sw-ink)]' : 'text-[var(--sw-ink-3)]'}`}>{label}</span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-[var(--sw-line)]" />}
          </div>
        ))}
      </div>

      {/* Étape 0 — Récapitulatif produit + pharmacie */}
      {step === 0 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Votre réservation</h1>

          <div className="sw-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">Médicament</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-[var(--sw-primary)]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--sw-ink)]">{product.name}</p>
                {product.dosage && <p className="text-xs text-[var(--sw-ink-2)]">{product.dosage}</p>}
                {product.prescription_required && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 mt-1">
                    <FileText className="w-3 h-3" /> Sur ordonnance
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="sw-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">Pharmacie</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--sw-ink)]">{pharmacy.name}</p>
                {(pharmacy.address_commune || pharmacy.address_region) && (
                  <p className="text-xs text-[var(--sw-ink-2)]">{[pharmacy.address_commune, pharmacy.address_region].filter(Boolean).join(', ')}</p>
                )}
                {pharmacy.phone && <p className="text-xs text-[var(--sw-ink-3)]">{pharmacy.phone}</p>}
              </div>
            </div>
            {price && (
              <div className="border-t border-[var(--sw-line)] pt-3">
                <p className="text-xs text-[var(--sw-ink-3)]">Prix unitaire</p>
                <p className="text-base font-bold text-[var(--sw-ink)]">{fmtCFA(price)}</p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              La réservation ne constitue pas une vente. Le prix est indicatif. Aucun paiement en ligne n'est effectué. Vous réglez en pharmacie lors du retrait.
            </p>
          </div>

          <button onClick={() => setStep(1)}
            className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold flex items-center justify-center gap-2">
            Continuer <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Étape 1 — Quantité + ordonnance + notes */}
      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Détails de la réservation</h1>

          <div className="sw-card p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide mb-1.5">Quantité</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-lg font-bold hover:bg-[var(--sw-line)]">−</button>
                <span className="text-lg font-bold text-[var(--sw-ink)] w-8 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(20, q + 1))}
                  className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-lg font-bold hover:bg-[var(--sw-line)]">+</button>
                {total && <span className="ml-auto text-sm font-semibold text-[var(--sw-primary)]">{fmtCFA(total)}</span>}
              </div>
            </div>

            {/* Ordonnance */}
            <div>
              <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide mb-1.5">
                Ordonnance {product.prescription_required ? <span className="text-orange-600">(requise)</span> : '(optionnelle)'}
              </label>
              {prescriptions.length === 0 ? (
                <p className="text-xs text-[var(--sw-ink-3)] italic">Aucune ordonnance disponible.</p>
              ) : (
                <div className="space-y-2">
                  {!product.prescription_required && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="presc" checked={!prescriptionId} onChange={() => setPrescriptionId(null)} className="accent-[var(--sw-primary)]" />
                      <span className="text-sm text-[var(--sw-ink)]">Sans ordonnance</span>
                    </label>
                  )}
                  {prescriptions.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="presc" checked={prescriptionId === p.id} onChange={() => setPrescriptionId(p.id)} className="accent-[var(--sw-primary)]" />
                      <span className="text-sm text-[var(--sw-ink)]">
                        Ordonnance du {new Date(p.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Couverture */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={hasCoverage} onChange={e => setHasCoverage(e.target.checked)} className="accent-[var(--sw-primary)] w-4 h-4" />
              <span className="text-sm text-[var(--sw-ink)]">Demander une prise en charge (couverture)</span>
            </label>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide mb-1.5">Note pour la pharmacie (optionnel)</label>
              <textarea rows={2} className="sw-input w-full resize-none" placeholder="Précision sur le générique accepté, etc."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(0)} className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm font-medium flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button onClick={() => setStep(2)}
              disabled={product.prescription_required && !prescriptionId && prescriptions.length > 0}
              className="flex-1 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              Confirmer <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 — Récap final + confirmation */}
      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Confirmer la réservation</h1>

          <div className="sw-card p-4 divide-y divide-[var(--sw-line)]">
            <div className="pb-3">
              <p className="text-xs text-[var(--sw-ink-3)] font-medium">Médicament</p>
              <p className="text-sm font-semibold text-[var(--sw-ink)]">{product.name}{product.dosage ? ` ${product.dosage}` : ''}</p>
            </div>
            <div className="py-3">
              <p className="text-xs text-[var(--sw-ink-3)] font-medium">Pharmacie</p>
              <p className="text-sm font-semibold text-[var(--sw-ink)]">{pharmacy.name}</p>
              {pharmacy.address_commune && <p className="text-xs text-[var(--sw-ink-3)]">{pharmacy.address_commune}</p>}
            </div>
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--sw-ink-3)] font-medium">Quantité</p>
                <p className="text-sm font-semibold text-[var(--sw-ink)]">{quantity}</p>
              </div>
              {total && (
                <div className="text-right">
                  <p className="text-xs text-[var(--sw-ink-3)] font-medium">Montant estimé</p>
                  <p className="text-base font-bold text-[var(--sw-primary)]">{fmtCFA(total)}</p>
                </div>
              )}
            </div>
            {prescriptionId && (
              <div className="pt-3">
                <p className="text-xs text-[var(--sw-ink-3)] font-medium">Ordonnance jointe</p>
                <p className="text-sm text-[var(--sw-ink)]">Oui</p>
              </div>
            )}
            {hasCoverage && (
              <div className="pt-3">
                <p className="text-xs text-[var(--sw-ink-3)] font-medium">Couverture</p>
                <p className="text-sm text-[var(--sw-ink)]">Demandée</p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)] border border-[var(--sw-warning)]/30">
            <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--sw-warning)]">
              Le prix est indicatif et sera confirmé par la pharmacie. Le règlement s'effectue en pharmacie, aucun paiement n'est dû maintenant.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm font-medium flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button onClick={handleConfirm} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Réserver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
