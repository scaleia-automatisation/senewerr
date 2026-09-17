import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...props },
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
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-[96px] w-full rounded-sm border bg-surface p-s-3 text-body text-ink',
          'placeholder:text-ink-3 transition-colors duration-fast resize-y',
          'focus:outline-none focus:border-primary focus:shadow-focus',
          'disabled:opacity-45 disabled:cursor-not-allowed',
          error ? 'border-status-danger' : 'border-line',
          className,
        )}
        {...props}
      />
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
