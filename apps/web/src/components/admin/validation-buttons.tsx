'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  profileId: string
  currentStatus: string
}

export function ValidationButtons({ profileId, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [motif, setMotif]     = useState('')
  const [showMotif, setShowMotif] = useState(false)
  const [error, setError]     = useState('')

  async function updateStatus(newStatus: string) {
    setError('')
    setLoading(newStatus)
    const supabase = createClient()
    const payload: Record<string, string> = { account_status: newStatus }
    if (newStatus === 'refused' && motif) payload.verification_notes = motif

    const { error: err } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profileId)

    if (err) { setError(err.message); setLoading(null); return }
    setLoading(null)
    router.refresh()
  }

  if (currentStatus === 'verified') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-[var(--sw-success)] font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Compte validé
        </div>
        <button
          type="button"
          onClick={() => updateStatus('suspended')}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity border border-[var(--sw-line)]"
        >
          {loading === 'suspended' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Suspendre
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateStatus('verified')}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-success-bg)] text-[var(--sw-success)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {loading === 'verified' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Valider
        </button>

        <button
          type="button"
          onClick={() => updateStatus('needs_info')}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {loading === 'needs_info' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
          À compléter
        </button>

        <button
          type="button"
          onClick={() => setShowMotif(s => !s)}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          <XCircle className="w-3.5 h-3.5" />
          Refuser
        </button>
      </div>

      {showMotif && (
        <div className="space-y-2">
          <textarea
            value={motif}
            onChange={e => setMotif(e.target.value)}
            placeholder="Motif du refus (optionnel)…"
            rows={2}
            className="sw-input w-full resize-none text-sm"
          />
          <button
            type="button"
            onClick={() => { updateStatus('refused'); setShowMotif(false) }}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-danger)] text-white text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {loading === 'refused' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  )
}
