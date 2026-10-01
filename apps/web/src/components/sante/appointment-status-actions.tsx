'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendNotificationAction } from '@/app/actions/notifications'
import { CheckCircle2, XCircle, UserCheck, Activity, Ban, Loader2 } from 'lucide-react'
import type { NotifType } from '@/lib/notifications'

type UpdateFn = {
  update: (v: unknown) => {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

const TRANSITIONS: Record<string, {
  status: string; label: string; icon: typeof CheckCircle2
  variant: 'primary' | 'success' | 'danger' | 'default'
}[]> = {
  pending: [
    { status: 'confirmed',      label: 'Confirmer',       icon: CheckCircle2, variant: 'success' },
    { status: 'cancelled',      label: 'Annuler',         icon: XCircle,      variant: 'danger' },
  ],
  confirmed: [
    { status: 'arrived',        label: 'Patient arrivé',  icon: UserCheck,    variant: 'primary' },
    { status: 'cancelled',      label: 'Annuler',         icon: XCircle,      variant: 'danger' },
    { status: 'no_show',        label: 'Absent',          icon: Ban,          variant: 'default' },
  ],
  arrived: [
    { status: 'in_consultation',label: 'Démarrer',        icon: Activity,     variant: 'primary' },
    { status: 'cancelled',      label: 'Annuler',         icon: XCircle,      variant: 'danger' },
  ],
  in_consultation: [
    { status: 'completed',      label: 'Terminer',        icon: CheckCircle2, variant: 'success' },
  ],
}

const STATUS_TO_NOTIF: Partial<Record<string, NotifType>> = {
  confirmed: 'appointment_confirmed',
  cancelled: 'appointment_cancelled',
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-[var(--sw-primary)] text-white',
  success: 'bg-[var(--sw-success)] text-white',
  danger:  'border border-[var(--sw-danger)] text-[var(--sw-danger)] hover:bg-red-50',
  default: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
}

export function AppointmentStatusActions({
  appointmentId, professionalId, currentStatus, patientProfileId,
}: {
  appointmentId: string
  professionalId: string
  currentStatus: string
  patientProfileId?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')

  const transitions = TRANSITIONS[currentStatus] ?? []
  if (transitions.length === 0) return null

  async function handleUpdate(newStatus: string) {
    setLoading(newStatus); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('rendez_vous') as unknown as UpdateFn)
      .update({ status: newStatus, notes: notes || null })
      .eq('id', appointmentId)
      .eq('professional_id', professionalId)

    if (err) { setError(err.message); setLoading(null); return }

    // Notifier le patient
    const notifType = STATUS_TO_NOTIF[newStatus]
    if (notifType && patientProfileId) {
      sendNotificationAction({
        recipient_id: patientProfileId,
        type: notifType,
        reference_type: 'appointment',
        reference_id: appointmentId,
      }).catch(() => {})
    }

    router.refresh()
    setLoading(null)
  }

  return (
    <div className="sw-card p-4 space-y-3">
      <p className="text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Mettre à jour le statut</p>

      <div>
        <label className="block text-xs text-[var(--sw-ink-3)] mb-1.5">Notes (facultatif)</label>
        <textarea rows={2} className="sw-input w-full resize-none text-sm" placeholder="Observations, traitement…" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {transitions.map(t => {
          const Icon = t.icon
          const isLoading = loading === t.status
          return (
            <button key={t.status} onClick={() => handleUpdate(t.status)} disabled={!!loading}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${VARIANT_CLASSES[t.variant]}`}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              {t.label}
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs text-[var(--sw-danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>}
    </div>
  )
}
