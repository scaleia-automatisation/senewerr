import { cn } from '@/lib/utils'

export type StatusKind = 'success' | 'pending' | 'progress' | 'danger' | 'neutral'

/**
 * Mapping des statuts métier vers les 5 déclinaisons visuelles.
 * Le libellé est TOUJOURS affiché (jamais la couleur seule).
 */
const STATUS_STYLES: Record<StatusKind, { fg: string; bg: string; dot: string }> = {
  success:  { fg: 'text-status-success',  bg: 'bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)]',  dot: 'bg-status-success' },
  pending:  { fg: 'text-status-pending',  bg: 'bg-[color-mix(in_srgb,var(--status-pending)_12%,transparent)]',  dot: 'bg-status-pending' },
  progress: { fg: 'text-status-progress', bg: 'bg-[color-mix(in_srgb,var(--status-progress)_12%,transparent)]', dot: 'bg-status-progress' },
  danger:   { fg: 'text-status-danger',   bg: 'bg-[color-mix(in_srgb,var(--status-danger)_12%,transparent)]',   dot: 'bg-status-danger' },
  neutral:  { fg: 'text-status-neutral',  bg: 'bg-[color-mix(in_srgb,var(--status-neutral)_12%,transparent)]',  dot: 'bg-status-neutral' },
}

export interface StatusPillProps {
  status: StatusKind
  label: string
  className?: string
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-s-2 rounded-pill px-s-3 py-s-1 text-small font-medium',
        s.fg,
        s.bg,
        className,
      )}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-pill', s.dot)} aria-hidden="true" />
      {label}
    </span>
  )
}
