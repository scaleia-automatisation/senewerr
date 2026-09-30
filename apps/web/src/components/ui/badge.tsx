import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import type { ReservationStatus, AppointmentStatus, AccountStatus, PrescriptionStatus, CoverageRequestStatus } from '@/types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink-2)]',
  success: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  warning: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  danger: 'bg-[var(--sw-danger-bg)] text-[var(--sw-danger)]',
  info: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  muted: 'bg-[var(--sw-surface-3)] text-[var(--sw-ink-3)]',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('sw-badge', variantClasses[variant], className)}
      {...props}
    />
  )
}

// ─── Status badges avec libellés ──────────────────────────────────────────

const reservationStatusMap: Record<ReservationStatus, { label: string; variant: BadgeVariant }> = {
  new: { label: 'Nouvelle', variant: 'info' },
  verifying: { label: 'À vérifier', variant: 'warning' },
  awaiting_coverage: { label: 'Attente couverture', variant: 'warning' },
  awaiting_payment: { label: 'Attente paiement', variant: 'warning' },
  funded: { label: 'Financée', variant: 'success' },
  to_prepare: { label: 'À préparer', variant: 'info' },
  preparing: { label: 'En préparation', variant: 'info' },
  ready: { label: 'Prête', variant: 'success' },
  collected: { label: 'Retirée', variant: 'muted' },
  refused: { label: 'Refusée', variant: 'danger' },
  cancelled: { label: 'Annulée', variant: 'muted' },
  expired: { label: 'Expirée', variant: 'muted' },
}

const appointmentStatusMap: Record<AppointmentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'En attente', variant: 'warning' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  arrived: { label: 'Arrivé', variant: 'info' },
  in_consultation: { label: 'En consultation', variant: 'info' },
  completed: { label: 'Terminé', variant: 'muted' },
  cancelled: { label: 'Annulé', variant: 'muted' },
  rescheduled: { label: 'Reporté', variant: 'warning' },
  no_show: { label: 'Non présenté', variant: 'danger' },
}

const accountStatusMap: Record<AccountStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Brouillon', variant: 'muted' },
  pending: { label: 'En attente', variant: 'warning' },
  needs_info: { label: 'À compléter', variant: 'warning' },
  verified: { label: 'Vérifié', variant: 'success' },
  refused: { label: 'Refusé', variant: 'danger' },
  suspended: { label: 'Suspendu', variant: 'danger' },
  disabled: { label: 'Désactivé', variant: 'muted' },
}

const prescriptionStatusMap: Record<PrescriptionStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Brouillon', variant: 'muted' },
  issued: { label: 'Émise', variant: 'success' },
  shared: { label: 'Partagée', variant: 'info' },
  verifying: { label: 'En vérification', variant: 'warning' },
  validated: { label: 'Validée', variant: 'success' },
  refused: { label: 'Refusée', variant: 'danger' },
  expired: { label: 'Expirée', variant: 'muted' },
  used: { label: 'Utilisée', variant: 'muted' },
}

const coverageStatusMap: Record<CoverageRequestStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'En attente', variant: 'warning' },
  needs_info: { label: 'Informations requises', variant: 'warning' },
  approved: { label: 'Validée', variant: 'success' },
  refused: { label: 'Refusée', variant: 'danger' },
  cancelled: { label: 'Annulée', variant: 'muted' },
}

export function ReservationBadge({ status }: { status: ReservationStatus }) {
  const { label, variant } = reservationStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function AppointmentBadge({ status }: { status: AppointmentStatus }) {
  const { label, variant } = appointmentStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function AccountBadge({ status }: { status: AccountStatus }) {
  const { label, variant } = accountStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function PrescriptionBadge({ status }: { status: PrescriptionStatus }) {
  const { label, variant } = prescriptionStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function CoverageBadge({ status }: { status: CoverageRequestStatus }) {
  const { label, variant } = coverageStatusMap[status]
  return <Badge variant={variant}>{label}</Badge>
}
