'use client'
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--sw-primary)] text-white hover:bg-[var(--sw-primary-dark)] focus-visible:ring-[var(--sw-primary)]',
        secondary: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink)] hover:bg-[var(--sw-line)] focus-visible:ring-[var(--sw-primary)]',
        outline: 'border border-[var(--sw-line)] bg-transparent text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)] focus-visible:ring-[var(--sw-primary)]',
        ghost: 'bg-transparent text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] hover:text-[var(--sw-ink)]',
        danger: 'bg-[var(--sw-danger)] text-white hover:opacity-90 focus-visible:ring-[var(--sw-danger)]',
        link: 'text-[var(--sw-primary)] underline-offset-4 hover:underline bg-transparent p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-sm rounded-lg',
        lg: 'h-11 px-6 text-base rounded-lg',
        xl: 'h-12 px-8 text-base rounded-xl',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
