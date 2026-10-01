'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'
import { validerAdherent, refuserAdherent } from '@/app/actions/couverture'

export function AdherentActions({ adherentId }: { adherentId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showRefus, setShowRefus] = useState(false)
  const [motif, setMotif] = useState('')
  const [error, setError] = useState('')

  function handleValider() {
    setError('')
    startTransition(async () => {
      const res = await validerAdherent(adherentId)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  function handleRefuser() {
    if (!showRefus) { setShowRefus(true); return }
    setError('')
    startTransition(async () => {
      const res = await refuserAdherent(adherentId, motif || undefined)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 pt-1 border-t border-[var(--sw-line)]">
      {showRefus && (
        <div>
          <input
            className="sw-input w-full text-xs"
            placeholder="Motif du refus (optionnel)"
            value={motif}
            onChange={e => setMotif(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--sw-danger)]">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleValider}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--sw-success)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Valider
        </button>
        <button
          onClick={handleRefuser}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[var(--sw-danger)] text-[var(--sw-danger)] text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          {showRefus ? 'Confirmer le refus' : 'Refuser'}
        </button>
        {showRefus && (
          <button
            onClick={() => { setShowRefus(false); setMotif('') }}
            className="px-3 py-2 rounded-lg border border-[var(--sw-line)] text-xs text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] transition-colors"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  )
}
