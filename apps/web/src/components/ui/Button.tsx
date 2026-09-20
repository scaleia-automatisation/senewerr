import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: React.ReactNode
  fullWidth?: boolean
  /** Rend le composant enfant (ex. <Link>) en conservant le style du bouton. */
  asChild?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary !text-primary-fg hover:bg-primary-hover active:scale-[.97]',
  secondary:
    'bg-transparent text-ink border border-line hover:bg-surface-2 active:scale-[.97]',
  ghost:
    'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:scale-[.97]',
  danger:
    'bg-status-danger text-white hover:brightness-110 active:scale-[.97]',
  accent:
    'bg-accent text-accent-fg hover:brightness-105 active:scale-[.97]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-s-3 text-small gap-s-2',
  md: 'h-11 px-s-4 text-body gap-s-2',
  lg: 'h-[52px] px-s-5 text-body gap-s-3',
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, leftIcon, fullWidth, asChild, className, children, disabled, ...props },
  ref,
) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-all duration-fast ease-out',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  )

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {children}
    </button>
  )
})
