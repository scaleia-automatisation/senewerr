'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X } from 'lucide-react'
import { renvoyerDeclaration } from '@/app/actions/couverture'

interface Props {
  adherentId: string
  defaultMemberNumber: string | null
  defaultEmployerName: string | null
  defaultStartDate: string | null
  defaultEndDate: string | null
  showEmployer: boolean
}

export function RenvoyerForm({
  adherentId,
  defaultMemberNumber,
  defaultEmployerName,
  defaultStartDate,
  defaultEndDate,
  showEmployer,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [memberNumber, setMemberNumber] = useState(defaultMemberNumber ?? '')
  const [employerName, setEmployerName] = useState(defaultEmployerName ?? '')
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [endDate, setEndDate] = useState(defaultEndDate ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate) { setError('La date de début est requise.'); return }
    setError('')
    startTransition(async () => {
      const res = await renvoyerDeclaration(adherentId, {
        memberNumber: memberNumber || null,
        employerName: employerName || null,
        startDate,
        endDate: endDate || null,
      })
      if (res.error) { setError(res.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sw-primary)] text-[var(--sw-primary)] text-xs font-semibold hover:bg-[var(--sw-primary)] hover:text-white transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Modifier et renvoyer
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-[var(--sw-line)] pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--sw-ink)]">Modifier votre déclaration</p>
        <button type="button" onClick={() => setOpen(false)}>
          <X className="w-4 h-4 text-[var(--sw-ink-3)]" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-[var(--sw-ink-2)]">N° adhérent</label>
          <input
            className="sw-input mt-0.5"
            value={memberNumber}
            onChange={e => setMemberNumber(e.target.value)}
            placeholder="Numéro d'adhérent"
          />
        </div>

        {showEmployer && (
          <div>
            <label className="text-xs text-[var(--sw-ink-2)]">Employeur</label>
            <input
              className="sw-input mt-0.5"
              value={employerName}
              onChange={e => setEmployerName(e.target.value)}
              placeholder="Nom de l'employeur"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--sw-ink-2)]">Date début *</label>
            <input
              type="date"
              className="sw-input mt-0.5"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--sw-ink-2)]">Date fin</label>
            <input
              type="date"
              className="sw-input mt-0.5"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--sw-primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Envoi…' : 'Renvoyer à l\'organisme'}
      </button>
    </form>
  )
}
