import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/** Empty state orienté action — jamais d'illustration stock. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-s-3 rounded-lg bg-surface-2 px-s-5 py-s-7 text-center',
        className,
      )}
    >
      {icon && <span className="text-ink-3" aria-hidden="true">{icon}</span>}
      <h3 className="text-h3 font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-small text-ink-3">{description}</p>}
      {action && <div className="mt-s-2">{action}</div>}
    </div>
  )
}
