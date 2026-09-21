import { cn } from '@/lib/utils'

type StatusValue = 'active' | 'suspendue' | 'en_attente' | 'valide' | 'refuse' | 'expire' | 'pending' | 'approuve' | 'rembourse' | string

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  active:       { label: 'Active',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  suspendue:    { label: 'Suspendue',    classes: 'bg-red-100 text-red-700 border-red-200' },
  en_attente:   { label: 'En attente',   classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  pending:      { label: 'En attente',   classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  valide:       { label: 'Validé',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  approuve:     { label: 'Approuvé',     classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  refuse:       { label: 'Refusé',       classes: 'bg-red-100 text-red-700 border-red-200' },
  expire:       { label: 'Expiré',       classes: 'bg-surface-2 text-ink-3 border-line' },
  rembourse:    { label: 'Remboursé',    classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_cours:     { label: 'En cours',     classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  resilie:      { label: 'Résilié',      classes: 'bg-surface-2 text-ink-3 border-line' },
}

interface StatusBadgeProps {
  status: StatusValue
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: 'bg-surface-2 text-ink-3 border-line' }
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      size === 'sm' ? 'px-s-1.5 py-s-0.5 text-micro' : 'px-s-2 py-s-0.5 text-small',
      cfg.classes,
    )}>
      {cfg.label}
    </span>
  )
}
