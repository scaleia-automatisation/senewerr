import { cn } from '@/lib/utils'
import {
  Clock, Loader2, CheckCircle2, CircleCheckBig, Ban, XCircle, Timer, AlertTriangle,
} from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────────────── */
export type StatusKey =
  | 'en_attente'
  | 'en_cours'
  | 'confirme'
  | 'valide'
  | 'refuse'
  | 'annule'
  | 'termine'
  | 'expire'
  | 'a_completer'

interface StatusConfig {
  label: string
  icon: typeof Clock
  className: string
}

/* ── Config statuts ──────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  en_attente: {
    label: 'En attente',
    icon: Clock,
    className: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] border-amber-200',
  },
  en_cours: {
    label: 'En cours',
    icon: Loader2,
    className: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)] border-blue-200',
  },
  confirme: {
    label: 'Confirmé',
    icon: CheckCircle2,
    className: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] border-teal-200',
  },
  valide: {
    label: 'Validé',
    icon: CircleCheckBig,
    className: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)] border-green-200',
  },
  refuse: {
    label: 'Refusé',
    icon: Ban,
    className: 'bg-[var(--sw-danger-bg)] text-[var(--sw-danger)] border-red-200',
  },
  annule: {
    label: 'Annulé',
    icon: XCircle,
    className: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink-3)] border-[var(--sw-line)]',
  },
  termine: {
    label: 'Terminé',
    icon: CheckCircle2,
    className: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink-2)] border-[var(--sw-line)]',
  },
  expire: {
    label: 'Expiré',
    icon: Timer,
    className: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink-3)] border-[var(--sw-line)]',
  },
  a_completer: {
    label: 'À compléter',
    icon: AlertTriangle,
    className: 'bg-orange-50 text-orange-600 border-orange-200',
  },
}

/* ── StatusBadge ─────────────────────────────────────────────────────────── */
interface StatusBadgeProps {
  status: StatusKey
  /** Override le label par défaut */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, label, size = 'sm', className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  const Icon = cfg.icon
  const spin = status === 'en_cours'

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      cfg.className,
      className,
    )}>
      <Icon className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5', spin && 'animate-spin')} />
      {label ?? cfg.label}
    </span>
  )
}

/* ── Utilitaire — mapper des strings arbitraires vers StatusKey ────────────── */
export function normalizeStatus(raw: string): StatusKey {
  const map: Record<string, StatusKey> = {
    pending: 'en_attente',
    waiting: 'en_attente',
    en_attente: 'en_attente',
    processing: 'en_cours',
    en_cours: 'en_cours',
    confirmed: 'confirme',
    confirme: 'confirme',
    approved: 'valide',
    valide: 'valide',
    rejected: 'refuse',
    refuse: 'refuse',
    cancelled: 'annule',
    annule: 'annule',
    completed: 'termine',
    termine: 'termine',
    expired: 'expire',
    expire: 'expire',
    incomplete: 'a_completer',
    a_completer: 'a_completer',
  }
  return map[raw?.toLowerCase()] ?? 'en_attente'
}
