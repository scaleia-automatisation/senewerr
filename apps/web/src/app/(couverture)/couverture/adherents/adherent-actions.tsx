'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Calendar } from 'lucide-react'
import { validerAdherent, refuserAdherent } from '@/app/actions/couverture'

interface Props {
  adherentId: string
  defaultStartDate: string | null
  defaultEndDate: string | null
}

export function AdherentActions({ adherentId, defaultStartDate, defaultEndDate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'valider' | 'refuser'>('idle')
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [endDate, setEndDate] = useState(defaultEndDate ?? '')
  const [motif, setMotif] = useState('')
  const [error, setError] = useState('')

  function handleValider() {
    if (mode !== 'valider') { setMode('valider'); return }
    if (!startDate) { setError('La date de début est requise.'); return }
    setError('')
    startTransition(async () => {
      const res = await validerAdherent(adherentId, {
        startDate,
        endDate: endDate || null,
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  function handleRefuser() {
    if (mode !== 'refuser') { setMode('refuser'); return }
    setError('')
    startTransition(async () => {
      const res = await refuserAdherent(adherentId, motif || undefined)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2 pt-2 border-t border-[var(--sw-line)]">

      {/* Formulaire de validation avec dates */}
      {mode === 'valider' && (
        <div className="space-y-2 pb-1">
          <p className="text-xs font-medium text-[var(--sw-ink)] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--sw-success)]" />
            Confirmer les dates du contrat
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--sw-ink-3)]">Date début *</label>
              <input
                type="date"
                className="sw-input mt-0.5"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--sw-ink-3)]">Date fin</label>
              <input
                type="date"
                className="sw-input mt-0.5"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Motif de refus */}
      {mode === 'refuser' && (
        <input
          className="sw-input w-full text-xs"
          placeholder="Motif du refus (optionnel)"
          value={motif}
          onChange={e => setMotif(e.target.value)}
        />
      )}

      {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleValider}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--sw-success)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {mode === 'valider' ? 'Confirmer la validation' : 'Valider'}
        </button>
        <button
          onClick={handleRefuser}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[var(--sw-danger)] text-[var(--sw-danger)] text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          {mode === 'refuser' ? 'Confirmer le refus' : 'Refuser'}
        </button>
        {mode !== 'idle' && (
          <button
            onClick={() => { setMode('idle'); setError('') }}
            className="px-3 py-2 rounded-lg border border-[var(--sw-line)] text-xs text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] transition-colors"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  )
}
