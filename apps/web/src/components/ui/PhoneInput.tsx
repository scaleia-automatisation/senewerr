import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  /** Indicatif par défaut +221 (Sénégal) */
  dialCode?: string
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { label, error, dialCode = '+221', className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="flex flex-col gap-s-2">
      {label && (
        <label htmlFor={inputId} className="text-small font-medium text-ink-2">{label}</label>
      )}
      <div
        className={cn(
          'flex h-12 items-center rounded-sm border bg-surface focus-within:border-primary focus-within:shadow-focus',
          error ? 'border-status-danger' : 'border-line',
        )}
      >
        <span className="flex h-full items-center border-r border-line px-s-3 text-body text-ink-2 tabular-nums">
          {dialCode}
        </span>
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          placeholder="77 123 45 67"
          aria-invalid={error ? true : undefined}
          className={cn('h-full flex-1 rounded-r-sm bg-transparent px-s-3 text-body text-ink placeholder:text-ink-3 focus:outline-none tabular-nums', className)}
          {...props}
        />
      </div>
      {error && <p className="text-small text-status-danger">{error}</p>}
    </div>
  )
})
