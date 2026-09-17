import { cn } from '@/lib/utils'

export interface Slot {
  time: string
  state: 'available' | 'unavailable' | 'full'
}

export interface SlotPickerProps {
  slots: Slot[]
  value?: string
  onSelect?: (time: string) => void
  className?: string
}

/** Créneaux = chips 44 px. 🟢 disponible, 🔴 indisponible, ⚫ complet. */
export function SlotPicker({ slots, value, onSelect, className }: SlotPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-s-2', className)}>
      {slots.map(slot => {
        const disabled = slot.state !== 'available'
        const selected = slot.time === value
        return (
          <button
            key={slot.time}
            type="button"
            disabled={disabled}
            onClick={() => onSelect?.(slot.time)}
            aria-pressed={selected}
            className={cn(
              'h-11 min-w-[68px] rounded-md border px-s-3 text-small font-medium tabular-nums transition-all duration-fast',
              'focus-visible:outline-none focus-visible:shadow-focus',
              selected
                ? 'border-primary bg-primary text-primary-fg'
                : disabled
                  ? 'cursor-not-allowed border-line bg-surface-2 text-ink-3 line-through'
                  : 'border-line bg-surface text-ink hover:border-primary active:scale-[.97]',
            )}
          >
            {slot.time}
          </button>
        )
      })}
    </div>
  )
}
