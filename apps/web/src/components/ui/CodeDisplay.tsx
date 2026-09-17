import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './IconButton'

export interface CodeDisplayProps {
  /** Code à afficher, ex. « 4827 » (chiffres espacés) */
  code: string
  label?: string
  copyable?: boolean
  className?: string
}

/** Affiche un code (retrait 4 chiffres, n° ordonnance). Chiffres 40 px espacés. */
export function CodeDisplay({ code, label, copyable = true, className }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard indisponible */
    }
  }

  return (
    <div className={cn('flex flex-col gap-s-1', className)}>
      {label && (
        <span className="text-micro font-medium uppercase tracking-[0.06em] text-ink-3">{label}</span>
      )}
      <div className="flex items-center gap-s-3">
        <span className="font-display text-[40px] font-semibold leading-none tracking-[0.15em] text-ink tabular-nums">
          {code}
        </span>
        {copyable && (
          <IconButton
            aria-label={copied ? 'Copié' : 'Copier le code'}
            variant="ghost"
            onClick={copy}
            className="h-9 w-9"
          >
            {copied ? <Check className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
          </IconButton>
        )}
      </div>
    </div>
  )
}
