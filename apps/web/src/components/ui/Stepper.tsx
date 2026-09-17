import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepperProps {
  steps: string[]
  /** Index de l'étape courante (0-based) */
  current: number
  className?: string
}

/** Tunnel RDV / réservation : étapes faites / courante / à venir. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-s-2', className)}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={step} className="flex flex-1 items-center gap-s-2">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-micro font-semibold transition-colors',
                done && 'bg-primary text-primary-fg',
                active && 'bg-primary-soft text-primary ring-2 ring-primary',
                !done && !active && 'bg-surface-2 text-ink-3',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn('hidden text-small sm:inline', active ? 'font-medium text-ink' : 'text-ink-3')}>
              {step}
            </span>
            {i < steps.length - 1 && (
              <span className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-line')} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
