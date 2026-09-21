import { Button } from '@/components/ui/Button'

interface EmptyStateProps {
  icon: React.ReactNode
  message: string
  description?: string
  ctaLabel?: string
  onCta?: () => void
}

export function EmptyState({ icon, message, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-s-3 py-s-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">
        {icon}
      </div>
      <p className="font-semibold text-ink">{message}</p>
      {description && <p className="max-w-xs text-small text-ink-3">{description}</p>}
      {ctaLabel && onCta && (
        <Button variant="primary" onClick={onCta} size="sm">{ctaLabel}</Button>
      )}
    </div>
  )
}
