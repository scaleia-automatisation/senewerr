'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2, AlertTriangle } from 'lucide-react'

type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
}

export function CancelAppointmentButton({ appointmentId, patientId }: { appointmentId: string; patientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCancel() {
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('appointments') as unknown as UpdateFn)
      .update({ status: 'cancelled', cancellation_reason: reason || null })
      .eq('id', appointmentId)
      .eq('patient_id', patientId)

    if (err) { setError(err.message); setLoading(false); return }
    router.push('/patient/rendez-vous')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded-xl border border-[var(--sw-danger)] text-[var(--sw-danger)] text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
      >
        <X className="w-4 h-4" /> Annuler ce rendez-vous
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--sw-surface)] rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--sw-danger)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--sw-ink)]">Annuler le rendez-vous ?</p>
                <p className="text-xs text-[var(--sw-ink-2)]">Cette action ne peut pas être annulée.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1.5">
                Motif d'annulation (facultatif)
              </label>
              <textarea
                rows={3}
                className="sw-input w-full resize-none"
                placeholder="Ex : Empêchement personnel, changement de planning…"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-[var(--sw-danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-sm font-medium text-[var(--sw-ink-2)]">
                Retour
              </button>
              <button onClick={handleCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[var(--sw-danger)] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
