'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}
type UpdateResaFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}

type Props = {
  requestId: string
  reservationId: string | null
  currentStatus: string
  currentAmountTotal: number | null
}

type Action = { key: string; label: string; nextStatus: string; variant: 'success' | 'primary' | 'warning' | 'danger' | 'secondary'; needsAmounts?: boolean }

const ACTIONS: Record<string, Action[]> = {
  pending: [
    { key: 'start', label: "Démarrer l'examen", nextStatus: 'reviewing', variant: 'primary' },
    { key: 'refuse', label: 'Refuser', nextStatus: 'refused', variant: 'danger' },
  ],
  reviewing: [
    { key: 'approve', label: 'Valider intégralement', nextStatus: 'approved', variant: 'success', needsAmounts: true },
    { key: 'partial', label: 'Validation partielle', nextStatus: 'partial', variant: 'primary', needsAmounts: true },
    { key: 'info', label: 'Demander des informations', nextStatus: 'info_required', variant: 'warning' },
    { key: 'refuse', label: 'Refuser', nextStatus: 'refused', variant: 'danger' },
  ],
  info_required: [
    { key: 'resume', label: "Reprendre l'examen", nextStatus: 'reviewing', variant: 'primary' },
    { key: 'approve', label: 'Valider', nextStatus: 'approved', variant: 'success', needsAmounts: true },
    { key: 'refuse', label: 'Refuser', nextStatus: 'refused', variant: 'danger' },
  ],
}

const VARIANT_CLASSES: Record<string, string> = {
  success: 'bg-[var(--sw-success)] text-white',
  primary: 'bg-[var(--sw-primary)] text-white',
  warning: 'bg-[var(--sw-warning)] text-white',
  danger: 'bg-[var(--sw-danger)] text-white',
  secondary: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink)] border border-[var(--sw-line)]',
}

export function CoverageDecisionActions({ requestId, reservationId, currentStatus, currentAmountTotal }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [requiredDocs, setRequiredDocs] = useState('')
  const [amountCovered, setAmountCovered] = useState('')
  const [amountPatient, setAmountPatient] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const actions = ACTIONS[currentStatus] ?? []
  if (actions.length === 0) return null

  const needsAmountsActions = actions.filter(a => a.needsAmounts)

  async function handleAction(action: Action) {
    setError(''); setLoading(action.key)
    const supabase = createClient()

    const updatePayload: Record<string, unknown> = {
      status: action.nextStatus,
      decision_notes: notes || null,
      decided_at: ['approved', 'partial', 'refused'].includes(action.nextStatus) ? new Date().toISOString() : null,
    }
    if (action.key === 'info') updatePayload.required_documents = requiredDocs || null
    if (action.needsAmounts && amountCovered) {
      updatePayload.amount_covered = parseFloat(amountCovered)
      updatePayload.amount_patient = parseFloat(amountPatient || '0')
    }
    if (action.nextStatus === 'approved' && currentAmountTotal && !amountCovered) {
      updatePayload.amount_covered = currentAmountTotal
      updatePayload.amount_patient = 0
    }

    const { error: err } = await (supabase.from('coverage_requests') as unknown as UpdateFn)
      .update(updatePayload)
      .eq('id', requestId)

    if (err) { setError(err.message); setLoading(null); return }

    // Sync reservation status
    if (reservationId && ['approved', 'partial'].includes(action.nextStatus)) {
      await (supabase.from('pharmacy_reservations') as unknown as UpdateResaFn)
        .update({ status: 'funded' })
        .eq('id', reservationId)
    }
    if (reservationId && action.nextStatus === 'refused') {
      await (supabase.from('pharmacy_reservations') as unknown as UpdateResaFn)
        .update({ status: 'refused' })
        .eq('id', reservationId)
    }

    setDone(true); setLoading(null)
    setTimeout(() => router.refresh(), 500)
  }

  if (done) {
    return (
      <div className="sw-card p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[var(--sw-success)] shrink-0" />
        <p className="text-sm text-[var(--sw-ink)]">Décision enregistrée</p>
      </div>
    )
  }

  return (
    <div className="sw-card p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">Décision</p>

      {needsAmountsActions.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Montant pris en charge (F CFA)</label>
            <input type="number" className="sw-input w-full" placeholder="0"
              value={amountCovered} onChange={e => setAmountCovered(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Reste à charge patient (F CFA)</label>
            <input type="number" className="sw-input w-full" placeholder="0"
              value={amountPatient} onChange={e => setAmountPatient(e.target.value)} />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Note de décision (motif, exclusions…)</label>
        <textarea rows={2} className="sw-input w-full resize-none"
          placeholder="Motif de la décision, clauses applicables…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {actions.some(a => a.key === 'info') && (
        <div>
          <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Documents requis (si demande d'info)</label>
          <input type="text" className="sw-input w-full" placeholder="Ex : ordonnance originale, attestation adhérent"
            value={requiredDocs} onChange={e => setRequiredDocs(e.target.value)} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {actions.map(action => (
          <button key={action.key} onClick={() => handleAction(action)} disabled={!!loading}
            className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity ${VARIANT_CLASSES[action.variant]}`}>
            {loading === action.key ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
