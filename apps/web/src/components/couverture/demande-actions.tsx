'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendNotificationAction } from '@/app/actions/notifications'
import { CheckCircle2, XCircle, MessageCircle, Loader2 } from 'lucide-react'

type Props = {
  requestId: string
  currentStatus: string
  orgId: string
  totalAmount: number | null
  patientProfileId?: string
}

type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
}

export function DemandeActions({ requestId, currentStatus, orgId, totalAmount, patientProfileId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState('')
  const [modal, setModal]     = useState<'validate' | 'refuse' | 'info' | null>(null)

  // Formulaire validation
  const [coverageRate, setCoverageRate] = useState<string>('80')
  const [coverageAmount, setCoverageAmount] = useState<string>('')
  const [validFrom, setValidFrom] = useState<string>(new Date().toISOString().split('T')[0])
  const [validUntil, setValidUntil] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<'tiers_payant' | 'remboursement'>('tiers_payant')

  // Formulaire refus
  const [refusalReason, setRefusalReason] = useState('')

  // Formulaire info complémentaire
  const [infoRequest, setInfoRequest] = useState('')

  function computedCoverageAmount(): number {
    if (coverageAmount) return parseFloat(coverageAmount) || 0
    const rate = parseFloat(coverageRate) || 0
    return Math.round(((totalAmount ?? 0) * rate) / 100)
  }
  function computedPatientShare(): number {
    return Math.max(0, (totalAmount ?? 0) - computedCoverageAmount())
  }

  async function handleValidate() {
    setLoading('approved'); setError('')
    const supabase = createClient()
    const covAmt = computedCoverageAmount()
    const patAmt = computedPatientShare()
    const { error: err } = await (supabase.from('demandes_couverture') as unknown as UpdateFn)
      .update({
        status: 'approved',
        coverage_amount_fcfa: covAmt,
        patient_amount_fcfa: patAmt,
        coverage_percent: parseFloat(coverageRate) || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('coverage_org_id', orgId)
    if (err) { setError(err.message); setLoading(null); return }
    if (patientProfileId) {
      sendNotificationAction({
        recipient_id: patientProfileId,
        type: 'coverage_validated',
        reference_type: 'coverage_request',
        reference_id: requestId,
      }).catch(() => {})
    }
    setModal(null); router.refresh(); setLoading(null)
  }

  async function handleRefuse() {
    if (!refusalReason.trim()) { setError('Veuillez saisir un motif.'); return }
    setLoading('refused'); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('demandes_couverture') as unknown as UpdateFn)
      .update({ status: 'refused', admin_notes: refusalReason, reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('coverage_org_id', orgId)
    if (err) { setError(err.message); setLoading(null); return }
    if (patientProfileId) {
      sendNotificationAction({
        recipient_id: patientProfileId,
        type: 'coverage_refused',
        reference_type: 'coverage_request',
        reference_id: requestId,
      }).catch(() => {})
    }
    setModal(null); router.refresh(); setLoading(null)
  }

  async function handleInfo() {
    if (!infoRequest.trim()) { setError('Veuillez saisir votre demande.'); return }
    setLoading('info'); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('demandes_couverture') as unknown as UpdateFn)
      .update({ status: 'needs_info', additional_docs_requested: infoRequest })
      .eq('id', requestId)
      .eq('coverage_org_id', orgId)
    if (err) { setError(err.message); setLoading(null); return }
    if (patientProfileId) {
      sendNotificationAction({
        recipient_id: patientProfileId,
        type: 'coverage_info_requested',
        reference_type: 'coverage_request',
        reference_id: requestId,
      }).catch(() => {})
    }
    setModal(null); router.refresh(); setLoading(null)
  }

  const fmtCFA = (n: number) => new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'

  return (
    <>
      <div className="sw-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Actions</h2>
        {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setModal('validate'); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-success)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <CheckCircle2 className="w-4 h-4" /> Valider
          </button>
          <button
            onClick={() => { setModal('refuse'); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-danger,#ef4444)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <XCircle className="w-4 h-4" /> Refuser
          </button>
          {currentStatus === 'pending' && (
            <button
              onClick={() => { setModal('info'); setError('') }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium hover:border-[var(--sw-primary)] transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Demander des infos
            </button>
          )}
        </div>
      </div>

      {/* Modal Valider */}
      {modal === 'validate' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--sw-surface)] rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl my-4">
            <h3 className="font-bold text-[var(--sw-ink)]">Valider la demande</h3>
            {totalAmount != null && (
              <p className="text-sm text-[var(--sw-ink-2)]">Montant total demandé : <strong>{fmtCFA(totalAmount)}</strong></p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink)] mb-1">Taux de couverture (%)</label>
                <input
                  type="number" min={0} max={100} className="sw-input w-full"
                  value={coverageRate} onChange={e => setCoverageRate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink)] mb-1">
                  Montant autorisé (F CFA) <span className="text-[var(--sw-ink-3)] font-normal">— ou laisser vide pour calcul auto</span>
                </label>
                <input
                  type="number" min={0} className="sw-input w-full"
                  placeholder={totalAmount != null ? fmtCFA(computedCoverageAmount()) : ''}
                  value={coverageAmount} onChange={e => setCoverageAmount(e.target.value)}
                />
              </div>
              {totalAmount != null && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--sw-surface-2)] text-xs">
                  <div>
                    <p className="text-[var(--sw-ink-3)]">Prise en charge</p>
                    <p className="font-bold text-[var(--sw-success)]">{fmtCFA(computedCoverageAmount())}</p>
                  </div>
                  <div>
                    <p className="text-[var(--sw-ink-3)]">Reste à charge</p>
                    <p className="font-bold text-[var(--sw-warning)]">{fmtCFA(computedPatientShare())}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--sw-ink)] mb-1">Valide du</label>
                  <input type="date" className="sw-input w-full text-sm" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sw-ink)] mb-1">Valide au</label>
                  <input type="date" className="sw-input w-full text-sm" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--sw-ink)] mb-2">Mode de règlement</label>
                <div className="flex gap-3">
                  {[
                    { value: 'tiers_payant', label: 'Tiers payant' },
                    { value: 'remboursement', label: 'Remboursement différé' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${paymentMode === opt.value ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' : 'border-[var(--sw-line)]'}`}>
                      <input type="radio" className="hidden" value={opt.value} checked={paymentMode === opt.value} onChange={() => setPaymentMode(opt.value as typeof paymentMode)} />
                      <span className={`w-3 h-3 rounded-full border-2 ${paymentMode === opt.value ? 'border-[var(--sw-primary)] bg-[var(--sw-primary)]' : 'border-[var(--sw-line)]'}`} />
                      <span className="text-xs font-medium text-[var(--sw-ink)]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium py-2.5 rounded-xl hover:border-[var(--sw-primary)]">
                Annuler
              </button>
              <button onClick={handleValidate} disabled={loading !== null} className="flex-1 bg-[var(--sw-success)] text-white text-sm font-medium py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading === 'approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Refuser */}
      {modal === 'refuse' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--sw-surface)] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-bold text-[var(--sw-ink)]">Refuser la demande</h3>
            <textarea
              className="sw-input w-full resize-none"
              rows={3}
              placeholder="Motif du refus (obligatoire)…"
              value={refusalReason}
              onChange={e => setRefusalReason(e.target.value)}
            />
            {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium py-2.5 rounded-xl">Annuler</button>
              <button onClick={handleRefuse} disabled={loading !== null} className="flex-1 bg-[var(--sw-danger,#ef4444)] text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center">
                {loading === 'refused' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Info complémentaire */}
      {modal === 'info' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--sw-surface)] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-bold text-[var(--sw-ink)]">Demander une information</h3>
            <p className="text-sm text-[var(--sw-ink-2)]">Précisez ce que vous souhaitez obtenir du patient ou du prestataire.</p>
            <textarea
              className="sw-input w-full resize-none"
              rows={3}
              placeholder="Ex : copie de l'ordonnance, justificatif de frais…"
              value={infoRequest}
              onChange={e => setInfoRequest(e.target.value)}
            />
            {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium py-2.5 rounded-xl">Annuler</button>
              <button onClick={handleInfo} disabled={loading !== null} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center">
                {loading === 'info' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
