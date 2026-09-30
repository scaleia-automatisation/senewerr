import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--sw-ink)]">
            {label}
            {props.required && <span className="text-[var(--sw-danger)] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sw-ink-3)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-10 rounded-lg border bg-[var(--sw-surface)] text-sm text-[var(--sw-ink)] placeholder:text-[var(--sw-ink-3)]',
              'px-3 py-2 transition-colors',
              'border-[var(--sw-line)] focus:border-[var(--sw-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-primary)]/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--sw-danger)] focus:border-[var(--sw-danger)] focus:ring-[var(--sw-danger)]/20',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sw-ink-3)]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--sw-ink-3)]">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
