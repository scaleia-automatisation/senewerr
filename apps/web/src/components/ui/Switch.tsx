import { useId } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
  id?: string
}

export function Switch({ checked, onCheckedChange, disabled, label, description, id }: SwitchProps) {
  const autoId = useId()
  const switchId = id ?? autoId
  return (
    <div className="flex items-start gap-s-3">
      <RadixSwitch.Root
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-pill border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-45',
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-2',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-pill bg-surface shadow-1 transition-transform',
            'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
          )}
        />
      </RadixSwitch.Root>
      {(label || description) && (
        <div className="flex flex-col gap-s-1">
          {label && (
            <label htmlFor={switchId} className="cursor-pointer text-small font-medium text-ink-2">
              {label}
            </label>
          )}
          {description && <p className="text-micro text-ink-3">{description}</p>}
        </div>
      )}
    </div>
  )
}
