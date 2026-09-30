'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Smartphone, CheckCircle2, Loader2, AlertTriangle, Clock, ArrowLeft, Download } from 'lucide-react'

type InsertFn = {
  insert: (v: unknown) => { select: (q: string) => { single: () => Promise<{ data: { id: string; reference_code: string | null } | null; error: { message: string } | null }> } }
}
type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}

type Props = {
  patientId: string
  reservationId: string
  coverageRequestId: string | null
  medicationName: string
  pharmacyName: string
  pharmacyId: string
  amountFcfa: number
  totalAmount: number | null
  coveredAmount: number | null
  pickupCode: string | null
  existingPayment: { id: string; status: string; amount_fcfa: number; method: string | null; reference_code: string | null; confirmed_at: string | null } | null
}

type Method = { key: string; label: string; sublabel: string; color: string }
const METHODS: Method[] = [
  { key: 'orange_money', label: 'Orange Money', sublabel: 'Paiement mobile', color: 'bg-orange-500' },
  { key: 'wave', label: 'Wave', sublabel: 'Paiement mobile', color: 'bg-blue-500' },
  { key: 'free_money', label: 'Free Money', sublabel: 'Paiement mobile', color: 'bg-purple-500' },
  { key: 'cash', label: 'Espèces', sublabel: 'Payer à la pharmacie', color: 'bg-[var(--sw-success)]' },
]

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

export function PaymentForm({
  patientId, reservationId, coverageRequestId,
  medicationName, pharmacyName, pharmacyId,
  amountFcfa, totalAmount, coveredAmount, pickupCode,
  existingPayment,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'summary' | 'method' | 'phone' | 'pending' | 'confirmed' | 'error'>(
    existingPayment?.status === 'confirmed' ? 'confirmed' : 'summary'
  )
  const [method, setMethod] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [paymentId, setPaymentId] = useState<string | null>(existingPayment?.id ?? null)
  const [refCode, setRefCode] = useState<string | null>(existingPayment?.reference_code ?? null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isMobileMoney = method && method !== 'cash'

  async function handleInitiate() {
    if (!method) return
    if (isMobileMoney && !phone.trim()) { setErrorMsg('Entrez votre numéro de téléphone.'); return }
    setErrorMsg(''); setLoading(true)

    const supabase = createClient()
    const ref = `PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const { data, error: err } = await (supabase.from('payments') as unknown as InsertFn)
      .insert({
        patient_id: patientId,
        pharmacy_id: pharmacyId,
        reservation_id: reservationId,
        coverage_request_id: coverageRequestId ?? null,
        payment_type: 'patient_charge',
        amount_fcfa: amountFcfa,
        status: method === 'cash' ? 'pending_at_counter' : 'pending',
        method,
        phone_number: phone || null,
        reference_code: ref,
      })
      .select('id')
      .single()

    setLoading(false)
    if (err) { setErrorMsg(err.message); return }
    setPaymentId(data?.id ?? null)
    setRefCode(ref)
    setStep(method === 'cash' ? 'pending' : 'pending')
  }

  async function handleSimulateConfirmation() {
    if (!paymentId) return
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await (supabase.from('payments') as unknown as UpdateFn)
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', paymentId)

    if (err) { setErrorMsg(err.message); setLoading(false); return }

    // Update reservation to funded / pending_payment resolved
    await (supabase.from('pharmacy_reservations') as unknown as UpdateFn)
      .update({ status: 'funded', updated_at: new Date().toISOString() })
      .eq('id', reservationId)

    setLoading(false)
    setStep('confirmed')
  }

  // —— Screens ——

  if (step === 'confirmed') {
    return (
      <div className="sw-card p-8 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-[var(--sw-success)] mx-auto" />
        <div>
          <p className="text-base font-bold text-[var(--sw-ink)]">Paiement confirmé</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1">Votre règlement a été reçu.</p>
        </div>
        {refCode && (
          <div className="sw-card p-3 bg-[var(--sw-surface-2)]">
            <p className="text-xs text-[var(--sw-ink-3)]">Référence</p>
            <p className="text-sm font-mono font-bold text-[var(--sw-ink)]">{refCode}</p>
          </div>
        )}
        {/* Spec 17.2 : justificatif après confirmation */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-success-bg)]">
          <Download className="w-4 h-4 text-[var(--sw-success)]" />
          <p className="text-xs text-[var(--sw-success)] font-medium">Justificatif disponible dans Mes paiements</p>
        </div>
        <button onClick={() => router.push(`/patient/pharmacie/reservations/${reservationId}`)}
          className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
          Voir ma réservation
        </button>
      </div>
    )
  }

  if (step === 'pending') {
    return (
      <div className="sw-card p-6 space-y-5">
        <div className="text-center space-y-2">
          <Clock className="w-12 h-12 text-[var(--sw-warning)] mx-auto" />
          <p className="text-base font-bold text-[var(--sw-ink)]">
            {method === 'cash' ? 'Règlement en espèces enregistré' : 'En attente du prestataire'}
          </p>
          <p className="text-sm text-[var(--sw-ink-2)]">
            {method === 'cash'
              ? 'Vous réglez les espèces directement à la pharmacie lors du retrait.'
              : 'Votre demande de paiement a été transmise. Le système attend la confirmation du prestataire.'}
          </p>
        </div>

        {refCode && (
          <div className="p-3 rounded-xl bg-[var(--sw-surface-2)] text-center">
            <p className="text-xs text-[var(--sw-ink-3)]">Référence</p>
            <p className="text-sm font-mono font-bold text-[var(--sw-ink)]">{refCode}</p>
          </div>
        )}

        {/* Spec 17.2 : le système attend la confirmation du prestataire */}
        {method !== 'cash' && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)]">
            <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--sw-warning)]">
              Le paiement ne sera validé qu'après confirmation du prestataire Mobile Money.
            </p>
          </div>
        )}

        {/* Bouton de simulation (démo) */}
        <button onClick={handleSimulateConfirmation} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-[var(--sw-success)] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {method === 'cash' ? 'Confirmer le règlement en espèces' : 'Simuler la confirmation du prestataire'}
        </button>
        <button onClick={() => router.push(`/patient/pharmacie/reservations/${reservationId}`)}
          className="w-full py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm">
          Retour à ma réservation
        </button>
      </div>
    )
  }

  // Étape summary
  if (step === 'summary') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Payer mon reste à charge</h1>

        {/* Spec 17.2 : montant, bénéficiaire, référence, statut */}
        <div className="sw-card p-5 space-y-3">
          <div className="text-center pb-3 border-b border-[var(--sw-line)]">
            <p className="text-xs text-[var(--sw-ink-3)] mb-1">Montant à payer</p>
            <p className="text-3xl font-bold text-[var(--sw-ink)]">{fmtCFA(amountFcfa)}</p>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--sw-ink-3)]">Bénéficiaire</span>
              <span className="font-medium text-[var(--sw-ink)]">{pharmacyName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--sw-ink-3)]">Médicament</span>
              <span className="font-medium text-[var(--sw-ink)]">{medicationName}</span>
            </div>
            {pickupCode && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--sw-ink-3)]">Code retrait</span>
                <span className="font-mono font-bold text-[var(--sw-ink)]">{pickupCode}</span>
              </div>
            )}
            {totalAmount && coveredAmount != null && (
              <>
                <div className="flex justify-between text-sm border-t border-[var(--sw-line)] pt-2.5">
                  <span className="text-[var(--sw-ink-3)]">Montant total</span>
                  <span className="text-[var(--sw-ink)]">{fmtCFA(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--sw-success)]">Pris en charge</span>
                  <span className="font-medium text-[var(--sw-success)]">−{fmtCFA(coveredAmount)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <button onClick={() => setStep('method')}
          className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" /> Choisir mon mode de paiement
        </button>
      </div>
    )
  }

  // Étape méthode
  if (step === 'method') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('summary')} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mode de paiement</h1>
        </div>
        <p className="text-sm text-[var(--sw-ink-2)]">Montant : <strong>{fmtCFA(amountFcfa)}</strong></p>

        <div className="space-y-2.5">
          {METHODS.map(m => (
            <button key={m.key} onClick={() => { setMethod(m.key); setStep('phone') }}
              className="w-full sw-card p-4 flex items-center gap-4 hover:border-[var(--sw-primary)] transition-colors text-left">
              <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center shrink-0`}>
                {m.key === 'cash' ? <CreditCard className="w-5 h-5 text-white" /> : <Smartphone className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--sw-ink)]">{m.label}</p>
                <p className="text-xs text-[var(--sw-ink-3)]">{m.sublabel}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Étape saisie téléphone / confirmation
  if (step === 'phone') {
    const selectedMethod = METHODS.find(m => m.key === method)
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('method')} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">{selectedMethod?.label}</h1>
        </div>

        <div className="sw-card p-4 flex justify-between items-center">
          <span className="text-sm text-[var(--sw-ink-2)]">À payer</span>
          <span className="text-lg font-bold text-[var(--sw-ink)]">{fmtCFA(amountFcfa)}</span>
        </div>

        {isMobileMoney && (
          <div className="sw-card p-4 space-y-3">
            <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
              Numéro {selectedMethod?.label}
            </label>
            <input type="tel" className="sw-input w-full text-lg font-mono" placeholder="+221 77 000 00 00"
              value={phone} onChange={e => setPhone(e.target.value)} />
            <p className="text-xs text-[var(--sw-ink-3)]">
              Vous recevrez une demande de confirmation sur ce numéro.
            </p>
          </div>
        )}

        {method === 'cash' && (
          <div className="sw-card p-4">
            <p className="text-sm text-[var(--sw-ink-2)]">
              Vous réglez <strong>{fmtCFA(amountFcfa)}</strong> directement à la pharmacie lors du retrait de votre médicament.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
          </div>
        )}

        <button onClick={handleInitiate} disabled={loading || (!!isMobileMoney && !phone.trim())}
          className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {method === 'cash' ? 'Confirmer le paiement en espèces' : 'Initier le paiement'}
        </button>
      </div>
    )
  }

  return null
}
