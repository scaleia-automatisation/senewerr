import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  error?: string
  className?: string
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Sélectionner…',
  disabled,
  label,
  error,
  className,
}: SelectProps) {
  return (
    <div className={cn('flex flex-col gap-s-2', className)}>
      {label && <label className="text-small font-medium text-ink-2">{label}</label>}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          aria-invalid={error ? true : undefined}
          className={cn(
            'flex h-12 w-full items-center justify-between rounded-sm border bg-surface px-s-3 text-body text-ink',
            'transition-colors focus:outline-none focus:border-primary focus:shadow-focus',
            'disabled:opacity-45 disabled:cursor-not-allowed',
            'data-[placeholder]:text-ink-3',
            error ? 'border-status-danger' : 'border-line',
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="h-4 w-4 text-ink-3" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-line bg-surface shadow-2 animate-in fade-in-0 zoom-in-95"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-s-1">
              {options.map(opt => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={cn(
                    'relative flex cursor-default select-none items-center rounded-sm px-s-3 py-s-2 pr-s-6 text-body text-ink-2 outline-none transition-colors',
                    'data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary',
                    'data-[disabled]:opacity-45 data-[disabled]:cursor-not-allowed',
                  )}
                >
                  <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-s-3">
                    <Check className="h-4 w-4" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="text-small text-status-danger" role="alert">{error}</p>}
    </div>
  )
}
