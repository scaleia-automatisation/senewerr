'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

type TableName = 'professionals' | 'establishments' | 'pharmacies' | 'coverage_orgs'

interface Props {
  id: string
  table: TableName
  currentStatus: string
}

export function ValidationButtons({ id, table, currentStatus }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [motif, setMotif]     = useState('')
  const [showMotif, setShowMotif] = useState(false)
  const [error, setError]     = useState('')

  async function updateStatus(newStatus: string) {
    setError('')
    setLoading(newStatus)
    const supabase = createClient()
    const { error: err } = await (supabase.from(table) as unknown as {
      update: (v: unknown) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> }
    }).update({ status: newStatus, ...(newStatus === 'refuse' && motif ? { refusal_reason: motif } : {}) }).eq('id', id)

    if (err) { setError(err.message); setLoading(null); return }
    setLoading(null)
    router.refresh()
  }

  if (currentStatus === 'verifie') {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--sw-success)] font-medium">
        <CheckCircle2 className="w-4 h-4" />
        Compte validé
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {/* Valider */}
        <button
          type="button"
          onClick={() => updateStatus('verifie')}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-success-bg)] text-[var(--sw-success)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {loading === 'verifie' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Valider
        </button>

        {/* Demander complément */}
        <button
          type="button"
          onClick={() => updateStatus('a_completer')}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {loading === 'a_completer' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
          À compléter
        </button>

        {/* Refuser */}
        <button
          type="button"
          onClick={() => setShowMotif(s => !s)}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          <XCircle className="w-3.5 h-3.5" />
          Refuser
        </button>

        {/* Suspendre */}
        {currentStatus === 'verifie' && (
          <button
            type="button"
            onClick={() => updateStatus('suspendu')}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity border border-[var(--sw-line)]"
          >
            Suspendre
          </button>
        )}
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
            onClick={() => { updateStatus('refuse'); setShowMotif(false) }}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--sw-danger)] text-white text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {loading === 'refuse' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  )
}
