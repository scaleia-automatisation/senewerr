// Enums TypeScript miroir des enums Postgres
// Générés depuis 0002_enums.sql — mise à jour manuelle synchronisée avec les migrations

export const UserRole = {
  PATIENT:               'patient',
  PROFESSIONAL:          'professional',
  ESTABLISHMENT_ADMIN:   'establishment_admin',
  ESTABLISHMENT_STAFF:   'establishment_staff',
  PHARMACY_ADMIN:        'pharmacy_admin',
  PHARMACY_STAFF:        'pharmacy_staff',
  MUTUAL_ADMIN:          'mutual_admin',
  MUTUAL_STAFF:          'mutual_staff',
  PLATFORM_ADMIN:        'platform_admin',
  SUPER_ADMIN:           'super_admin',
} as const
export type UserRole = typeof UserRole[keyof typeof UserRole]

export const ReservationStatus = {
  DRAFT:                    'draft',
  SUBMITTED:                'submitted',
  PHARMACY_REVIEW:          'pharmacy_review',
  PHARMACY_CONFIRMED:       'pharmacy_confirmed',
  PRESCRIPTION_REVIEW:      'prescription_review',
  INSURANCE_PENDING:        'insurance_pending',
  INSURANCE_VALIDATED:      'insurance_validated',
  INSURANCE_REFUSED:        'insurance_refused',
  PATIENT_PAYMENT_PENDING:  'patient_payment_pending',
  PATIENT_PAYMENT_RECEIVED: 'patient_payment_received',
  MUTUAL_PAYMENT_PENDING:   'mutual_payment_pending',
  MUTUAL_PAYMENT_RECEIVED:  'mutual_payment_received',
  FULLY_FINANCED:           'fully_financed',
  PREPARATION:              'preparation',
  READY:                    'ready',
  WITHDRAWAL_PENDING:       'withdrawal_pending',
  WITHDRAWN:                'withdrawn',
  COMPLETED:                'completed',
  CANCELLED:                'cancelled',
  EXPIRED:                  'expired',
  REFUND_PENDING:           'refund_pending',
  REFUNDED:                 'refunded',
  DISPUTE:                  'dispute',
} as const
export type ReservationStatus = typeof ReservationStatus[keyof typeof ReservationStatus]

export const AppointmentStatus = {
  REQUESTED:                 'requested',
  CONFIRMED:                 'confirmed',
  PAYMENT_PENDING:           'payment_pending',
  PAID:                      'paid',
  PATIENT_ARRIVED:           'patient_arrived',
  IN_CONSULTATION:           'in_consultation',
  COMPLETED:                 'completed',
  RESCHEDULED:               'rescheduled',
  CANCELLED_PATIENT:         'cancelled_patient',
  CANCELLED_PROFESSIONAL:    'cancelled_professional',
  CANCELLED_ESTABLISHMENT:   'cancelled_establishment',
  NO_SHOW:                   'no_show',
} as const
export type AppointmentStatus = typeof AppointmentStatus[keyof typeof AppointmentStatus]

export const PrescriptionStatus = {
  DRAFT:                  'draft',
  ISSUED:                 'issued',
  SIGNED:                 'signed',
  AVAILABLE_PATIENT:      'available_patient',
  SHARED_PHARMACY:        'shared_pharmacy',
  UNDER_PHARMACY_REVIEW:  'under_pharmacy_review',
  VALIDATED_PHARMACY:     'validated_pharmacy',
  PROBLEM_REPORTED:       'problem_reported',
  EXPIRED:                'expired',
  USED:                   'used',
  CANCELLED:              'cancelled',
} as const
export type PrescriptionStatus = typeof PrescriptionStatus[keyof typeof PrescriptionStatus]

export const PlanCode = {
  PATIENT_FREE:       'patient_free',
  PRO_FREE:           'pro_free',
  PRO_SOLO:           'pro_solo',
  PRO_PRO:            'pro_pro',
  PRO_EXPERT:         'pro_expert',
  PHARMACY_FREE:      'pharmacy_free',
  PHARMACY_START:     'pharmacy_start',
  PHARMACY_PRO:       'pharmacy_pro',
  PHARMACY_PREMIUM:   'pharmacy_premium',
  EST_CABINET:        'est_cabinet',
  EST_CENTRE:         'est_centre',
  EST_CLINIQUE:       'est_clinique',
  EST_CLINIQUE_PLUS:  'est_clinique_plus',
  MUTUAL_START:       'mutual_start',
  MUTUAL_PRO:         'mutual_pro',
  MUTUAL_ENTERPRISE:  'mutual_enterprise',
} as const
export type PlanCode = typeof PlanCode[keyof typeof PlanCode]

// Couleurs de statut (règle transversale §0.4)
export const STATUS_COLORS = {
  success: 'text-green-600 bg-green-50',   // terminé/validé/reçu
  warning: 'text-orange-600 bg-orange-50', // en attente/à traiter
  info:    'text-blue-600 bg-blue-50',     // en cours
  danger:  'text-red-600 bg-red-50',       // refusé/erreur/bloqué
  neutral: 'text-gray-600 bg-gray-50',     // non commencé
} as const

// Couleur par statut de réservation
export function reservationStatusColor(status: ReservationStatus): keyof typeof STATUS_COLORS {
  const map: Record<ReservationStatus, keyof typeof STATUS_COLORS> = {
    draft:                    'neutral',
    submitted:                'warning',
    pharmacy_review:          'warning',
    pharmacy_confirmed:       'info',
    prescription_review:      'info',
    insurance_pending:        'info',
    insurance_validated:      'info',
    insurance_refused:        'danger',
    patient_payment_pending:  'warning',
    patient_payment_received: 'info',
    mutual_payment_pending:   'info',
    mutual_payment_received:  'info',
    fully_financed:           'info',
    preparation:              'info',
    ready:                    'warning',
    withdrawal_pending:       'warning',
    withdrawn:                'success',
    completed:                'success',
    cancelled:                'danger',
    expired:                  'danger',
    refund_pending:           'warning',
    refunded:                 'neutral',
    dispute:                  'danger',
  }
  return map[status] ?? 'neutral'
}
