import { cn } from '@/lib/utils'

type Variant = 'neutral' | 'primary' | 'accent' | 'success' | 'pending' | 'danger'

const variants: Record<Variant, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-soft text-primary',
  accent:  'bg-accent-soft text-accent',
  success: 'text-status-success bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)]',
  pending: 'text-status-pending bg-[color-mix(in_srgb,var(--status-pending)_12%,transparent)]',
  danger:  'text-status-danger bg-[color-mix(in_srgb,var(--status-danger)_12%,transparent)]',
}

export interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-s-2 py-[2px] text-micro font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
