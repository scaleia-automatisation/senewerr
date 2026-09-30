'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendNotificationAction } from '@/app/actions/notifications'
import { CheckCircle2, XCircle, PlayCircle, Package, Loader2 } from 'lucide-react'
import type { NotifType } from '@/lib/notifications'

type Props = {
  reservationId: string
  currentStatus: string
  pharmacyId: string
  patientProfileId?: string
}

type UpdateFn = {
  update: (v: unknown) => {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

const STATUS_TO_NOTIF: Partial<Record<string, NotifType>> = {
  to_prepare: 'reservation_confirmed',
  preparing: 'reservation_confirmed',
  ready: 'reservation_ready',
  refused: 'reservation_refused',
}

export function ReservationActions({ reservationId, currentStatus, pharmacyId, patientProfileId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [refusalReason, setRefusalReason] = useState('')
  const [showRefuse, setShowRefuse] = useState(false)

  async function updateStatus(newStatus: string, extra?: Record<string, unknown>) {
    setLoading(newStatus); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('pharmacy_reservations') as unknown as UpdateFn)
      .update({ status: newStatus, ...extra })
      .eq('id', reservationId)
      .eq('pharmacy_id', pharmacyId)
    if (err) { setError(err.message); setLoading(null); return }

    // Notifier le patient si possible
    const notifType = STATUS_TO_NOTIF[newStatus]
    if (notifType && patientProfileId) {
      sendNotificationAction({
        recipient_id: patientProfileId,
        type: notifType,
        reference_type: 'reservation',
        reference_id: reservationId,
      }).catch(() => {})
    }

    router.refresh()
    setLoading(null)
  }

  async function handleRefuse() {
    if (!refusalReason.trim()) { setError('Veuillez saisir un motif de refus.'); return }
    await updateStatus('refused', { refused_reason: refusalReason })
    setShowRefuse(false)
  }

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, status: string, variant: 'primary' | 'danger' | 'secondary' = 'primary') => (
    <button
      onClick={onClick}
      disabled={loading !== null}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60 ${
        variant === 'primary'   ? 'bg-[var(--sw-primary)] text-white hover:opacity-90' :
        variant === 'danger'    ? 'bg-[var(--sw-danger,#ef4444)] text-white hover:opacity-90' :
        'border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
      }`}
    >
      {loading === status ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )

  return (
    <div className="sw-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Actions</h2>

      {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}

      {/* NEW : Confirmer ou Refuser */}
      {currentStatus === 'new' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--sw-ink-2)]">Vérifiez la disponibilité des médicaments puis confirmez ou refusez la réservation.</p>
          <div className="flex flex-wrap gap-2">
            {btn('Vérifier & confirmer', <CheckCircle2 className="w-4 h-4" />, () => updateStatus('to_prepare', { confirmed_at: new Date().toISOString() }), 'to_prepare')}
            {btn('Refuser', <XCircle className="w-4 h-4" />, () => setShowRefuse(true), 'refused', 'danger')}
          </div>
        </div>
      )}

      {/* VERIFYING (intermédiaire) */}
      {currentStatus === 'verifying' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--sw-ink-2)]">Confirmez ou refusez après vérification.</p>
          <div className="flex flex-wrap gap-2">
            {btn('Confirmer', <CheckCircle2 className="w-4 h-4" />, () => updateStatus('to_prepare', { confirmed_at: new Date().toISOString() }), 'to_prepare')}
            {btn('Refuser', <XCircle className="w-4 h-4" />, () => setShowRefuse(true), 'refused', 'danger')}
          </div>
        </div>
      )}

      {/* TO_PREPARE : Lancer la préparation */}
      {currentStatus === 'to_prepare' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--sw-ink-2)]">La réservation est confirmée. Lancez la préparation lorsque vous êtes prêt.</p>
          <div className="flex flex-wrap gap-2">
            {btn('Lancer la préparation', <PlayCircle className="w-4 h-4" />, () => updateStatus('preparing'), 'preparing')}
            {btn('Refuser', <XCircle className="w-4 h-4" />, () => setShowRefuse(true), 'refused', 'danger')}
          </div>
        </div>
      )}

      {/* PREPARING : Marquer comme prête */}
      {currentStatus === 'preparing' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--sw-ink-2)]">Marquez la réservation comme prête quand tous les médicaments sont préparés.</p>
          {btn('Marquer comme prête', <Package className="w-4 h-4" />, () => updateStatus('ready', { ready_at: new Date().toISOString() }), 'ready')}
        </div>
      )}

      {/* READY : attente du code */}
      {currentStatus === 'ready' && (
        <div className="p-4 rounded-xl bg-[var(--sw-success-bg)] space-y-2">
          <p className="text-sm font-semibold text-[var(--sw-success)]">Prête au retrait</p>
          <p className="text-xs text-[var(--sw-ink-2)]">
            La commande est prête. Le patient doit se présenter avec son code de retrait.
            Rendez-vous sur la page <span className="font-medium text-[var(--sw-primary)]">Retraits</span> pour valider.
          </p>
        </div>
      )}

      {/* Modal refus */}
      {showRefuse && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--sw-surface)] rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-bold text-[var(--sw-ink)]">Refuser la réservation</h3>
            <p className="text-sm text-[var(--sw-ink-2)]">Indiquez le motif du refus (obligatoire).</p>
            <textarea
              className="sw-input w-full resize-none"
              rows={3}
              placeholder="Ex : médicament en rupture de stock…"
              value={refusalReason}
              onChange={e => setRefusalReason(e.target.value)}
            />
            {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowRefuse(false); setRefusalReason('') }} className="flex-1 border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium py-2.5 rounded-xl hover:border-[var(--sw-primary)]">
                Annuler
              </button>
              <button onClick={handleRefuse} disabled={loading !== null} className="flex-1 bg-[var(--sw-danger,#ef4444)] text-white text-sm font-medium py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60">
                {loading === 'refused' ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
