import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  /** Icône/bouton à droite (ex. afficher/masquer le mot de passe) */
  rightIcon?: React.ReactNode
  /** Suffixe textuel, ex. « FCFA » */
  suffix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, suffix, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-s-2">
      {label && (
        <label htmlFor={inputId} className="text-small font-medium text-ink-2">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-s-3 text-ink-3">{leftIcon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-sm border bg-surface text-body text-ink',
            'placeholder:text-ink-3 transition-colors duration-fast',
            'focus:outline-none focus:border-primary focus:shadow-focus',
            'disabled:opacity-45 disabled:cursor-not-allowed',
            leftIcon ? 'pl-[42px]' : 'pl-s-3',
            suffix || rightIcon ? 'pr-[68px]' : 'pr-s-3',
            error ? 'border-status-danger' : 'border-line',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-s-3 text-small text-ink-3">{suffix}</span>
        )}
        {rightIcon && !suffix && (
          <span className="absolute right-s-2 flex items-center text-ink-3">{rightIcon}</span>
        )}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-small text-status-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-small text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
