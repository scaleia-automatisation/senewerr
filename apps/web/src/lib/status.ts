import type { StatusKind } from '@/components/ui/StatusPill'

export interface StatusDisplay {
  kind: StatusKind
  label: string
}

/** Libellés patient (§2.6) : À venir, En cours, À faire, Prête, Terminée, Annulée. */

const APPOINTMENT: Record<string, StatusDisplay> = {
  pending:     { kind: 'pending',  label: 'À venir' },
  confirmed:   { kind: 'progress', label: 'Confirmé' },
  in_progress: { kind: 'progress', label: 'En cours' },
  completed:   { kind: 'success',  label: 'Terminée' },
  cancelled:   { kind: 'danger',   label: 'Annulée' },
  no_show:     { kind: 'danger',   label: 'Absent' },
}

const RESERVATION: Record<string, StatusDisplay> = {
  pending:           { kind: 'pending',  label: 'À traiter' },
  accepted:          { kind: 'progress', label: 'Acceptée' },
  payment_requested: { kind: 'pending',  label: 'Paiement demandé' },
  payment_pending:   { kind: 'pending',  label: 'Paiement en attente' },
  paid:              { kind: 'progress', label: 'Payée' },
  ready:             { kind: 'success',  label: 'Prête' },
  dispensed:         { kind: 'success',  label: 'Terminée' },
  cancelled:         { kind: 'danger',   label: 'Annulée' },
  expired:           { kind: 'neutral',  label: 'Expirée' },
}

const COVERAGE: Record<string, StatusDisplay> = {
  pending:            { kind: 'pending',  label: 'À traiter' },
  info_requested:     { kind: 'pending',  label: 'Info demandée' },
  approved:           { kind: 'success',  label: 'Approuvée' },
  partially_approved: { kind: 'progress', label: 'Partiellement approuvée' },
  rejected:           { kind: 'danger',   label: 'Refusée' },
  paid:               { kind: 'success',  label: 'Payée' },
}

const PRESCRIPTION: Record<string, StatusDisplay> = {
  active:    { kind: 'progress', label: 'Active' },
  dispensed: { kind: 'success',  label: 'Délivrée' },
  expired:   { kind: 'neutral',  label: 'Expirée' },
  cancelled: { kind: 'danger',   label: 'Annulée' },
}

const FALLBACK: StatusDisplay = { kind: 'neutral', label: '—' }

export function appointmentStatus(s: string): StatusDisplay { return APPOINTMENT[s] ?? FALLBACK }
export function reservationStatus(s: string): StatusDisplay { return RESERVATION[s] ?? FALLBACK }
export function coverageStatus(s: string): StatusDisplay { return COVERAGE[s] ?? FALLBACK }
export function prescriptionStatus(s: string): StatusDisplay { return PRESCRIPTION[s] ?? FALLBACK }
