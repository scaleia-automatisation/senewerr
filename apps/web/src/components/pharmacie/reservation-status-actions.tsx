'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'À vérifier', awaiting_coverage: 'En attente de couverture',
  awaiting_payment: 'En attente de paiement', funded: 'Financée', to_prepare: 'À préparer',
  preparing: 'En préparation', ready: 'Prête', collected: 'Retirée',
  refused: 'Refusée', cancelled: 'Annulée', expired: 'Expirée',
}

type Transition = {
  to: string
  label: string
  variant: 'primary' | 'success' | 'danger' | 'secondary'
}

const TRANSITIONS: Record<string, Transition[]> = {
  new: [
    { to: 'verifying', label: 'Démarrer la vérification', variant: 'primary' },
    { to: 'refused', label: 'Refuser', variant: 'danger' },
    { to: 'cancelled', label: 'Annuler', variant: 'secondary' },
  ],
  verifying: [
    { to: 'to_prepare', label: 'Valider — À préparer', variant: 'success' },
    { to: 'awaiting_coverage', label: 'En attente de couverture', variant: 'primary' },
    { to: 'awaiting_payment', label: 'En attente de paiement', variant: 'primary' },
    { to: 'refused', label: 'Refuser', variant: 'danger' },
  ],
  awaiting_coverage: [
    { to: 'funded', label: 'Couverture obtenue', variant: 'success' },
    { to: 'refused', label: 'Refuser', variant: 'danger' },
  ],
  awaiting_payment: [
    { to: 'funded', label: 'Paiement reçu', variant: 'success' },
    { to: 'refused', label: 'Refuser', variant: 'danger' },
  ],
  funded: [
    { to: 'to_prepare', label: 'Passer en préparation', variant: 'primary' },
  ],
  to_prepare: [
    { to: 'preparing', label: 'Commencer la préparation', variant: 'primary' },
    { to: 'cancelled', label: 'Annuler', variant: 'secondary' },
  ],
  preparing: [
    { to: 'ready', label: 'Marquer comme prête', variant: 'success' },
    { to: 'cancelled', label: 'Annuler', variant: 'secondary' },
  ],
  ready: [
    { to: 'collected', label: 'Confirmer le retrait', variant: 'success' },
    { to: 'expired', label: 'Marquer comme expirée', variant: 'secondary' },
  ],
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-[var(--sw-primary)] text-white hover:opacity-90',
  success: 'bg-[var(--sw-success)] text-white hover:opacity-90',
  danger: 'bg-[var(--sw-danger)] text-white hover:opacity-90',
  secondary: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink)] hover:bg-[var(--sw-line)] border border-[var(--sw-line)]',
}

type Props = {
  reservationId: string
  currentStatus: string
  pharmacistNotes: string
  blockedTransitions?: string[]
  blockReasons?: Record<string, string>
}

export function ReservationStatusActions({ reservationId, currentStatus, pharmacistNotes: initialNotes, blockedTransitions = [], blockReasons = {} }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const transitions = TRANSITIONS[currentStatus] ?? []
  if (transitions.length === 0) return null

  async function handleTransition(to: string) {
    setError(''); setLoading(to)
    const supabase = createClient()
    const { error: err } = await (supabase.from('pharmacy_reservations') as unknown as UpdateFn)
      .update({ status: to, pharmacist_notes: notes || null, updated_at: new Date().toISOString() })
      .eq('id', reservationId)

    if (err) { setError(err.message); setLoading(null); return }
    setDone(true); setLoading(null)
    setTimeout(() => router.refresh(), 500)
  }

  if (done) {
    return (
      <div className="sw-card p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[var(--sw-success)] shrink-0" />
        <p className="text-sm text-[var(--sw-ink)]">Statut mis à jour</p>
      </div>
    )
  }

  return (
    <div className="sw-card p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">
        Actions — Statut actuel : {STATUS_LABELS[currentStatus] ?? currentStatus}
      </p>

      <div>
        <label className="block text-xs font-semibold text-[var(--sw-ink-2)] mb-1.5">Note pharmacien (optionnel)</label>
        <textarea rows={2} className="sw-input w-full resize-none" placeholder="Motif, précision, instruction pour le patient…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {transitions.map(t => {
          const isBlocked = blockedTransitions.includes(t.to)
          const reason = blockReasons[t.to] ?? 'Conditions de préparation non remplies (spec 17.4)'
          return (
            <div key={t.to}>
              <button onClick={() => !isBlocked && handleTransition(t.to)}
                disabled={!!loading || isBlocked}
                title={isBlocked ? reason : undefined}
                className={`w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-opacity ${isBlocked ? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] border border-[var(--sw-line)] cursor-not-allowed' : `${VARIANT_CLASSES[t.variant]} disabled:opacity-60`}`}>
                {loading === t.to ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t.label}
              </button>
              {isBlocked && (
                <p className="text-xs text-[var(--sw-warning)] mt-1 px-1">{reason}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
