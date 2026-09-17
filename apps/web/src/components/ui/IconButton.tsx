import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Obligatoire pour l'accessibilité */
  'aria-label': string
}

const variants: Record<Variant, string> = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  secondary: 'bg-transparent text-ink border border-line hover:bg-surface-2',
  ghost:     'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger:    'bg-transparent text-status-danger hover:bg-surface-2',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-md transition-all duration-fast ease-out',
        'active:scale-[.97] focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
