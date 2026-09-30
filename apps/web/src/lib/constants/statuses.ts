// Constantes de statut centralisées — source unique de vérité
// À importer dans toutes les pages qui affichent ou filtrent des statuts

// ── Réservations pharmacie ───────────────────────────────────────────────────
export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  new:              'Nouvelle',
  verifying:        'Vérification',
  pending_coverage: 'En attente de prise en charge',
  pending_payment:  'En attente de paiement',
  funded:           'Financée',
  to_prepare:       'À préparer',
  preparing:        'En préparation',
  ready:            'Prête',
  collected:        'Retirée',
  refused:          'Refusée',
  cancelled:        'Annulée',
  expired:          'Expirée',
}

export const RESERVATION_STATUS_CLASSES: Record<string, string> = {
  new:              'bg-gray-100 text-gray-600',
  verifying:        'bg-yellow-50 text-yellow-700',
  pending_coverage: 'bg-purple-50 text-purple-700',
  pending_payment:  'bg-orange-50 text-orange-700',
  funded:           'bg-blue-50 text-blue-700',
  to_prepare:       'bg-cyan-50 text-cyan-700',
  preparing:        'bg-cyan-50 text-cyan-700',
  ready:            'bg-green-50 text-green-700',
  collected:        'bg-gray-50 text-gray-500',
  refused:          'bg-red-50 text-red-700',
  cancelled:        'bg-gray-50 text-gray-500',
  expired:          'bg-gray-50 text-gray-500',
}

// ── Demandes de prise en charge ──────────────────────────────────────────────
export const COVERAGE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending:    'En attente',
  needs_info: 'Complément requis',
  approved:   'Approuvée',
  refused:    'Refusée',
  cancelled:  'Annulée',
}

export const COVERAGE_REQUEST_STATUS_CLASSES: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700',
  needs_info: 'bg-orange-50 text-orange-700',
  approved:   'bg-green-50 text-green-700',
  refused:    'bg-red-50 text-red-700',
  cancelled:  'bg-gray-50 text-gray-500',
}

// ── Ordonnances ──────────────────────────────────────────────────────────────
export const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  draft:            'Brouillon',
  active:           'Active',
  partially_served: 'Partiellement servie',
  fully_served:     'Servie',
  expired:          'Expirée',
  cancelled:        'Annulée',
}

export const PRESCRIPTION_STATUS_CLASSES: Record<string, string> = {
  draft:            'bg-gray-100 text-gray-600',
  active:           'bg-green-50 text-green-700',
  partially_served: 'bg-blue-50 text-blue-700',
  fully_served:     'bg-gray-50 text-gray-500',
  expired:          'bg-red-50 text-red-700',
  cancelled:        'bg-gray-50 text-gray-500',
}

// ── Rendez-vous ──────────────────────────────────────────────────────────────
export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show:   'Absent',
}

// ── Comptes / profils ────────────────────────────────────────────────────────
export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  draft:         'En attente',
  verified:      'Vérifié',
  suspended:     'Suspendu',
  refused:       'Refusé',
  info_required: 'Complément requis',
}

export const ACCOUNT_STATUS_CLASSES: Record<string, string> = {
  draft:         'bg-yellow-50 text-yellow-700',
  verified:      'bg-green-50 text-green-700',
  suspended:     'bg-red-50 text-red-700',
  refused:       'bg-red-50 text-red-700',
  info_required: 'bg-orange-50 text-orange-700',
}

// ── Paiements ────────────────────────────────────────────────────────────────
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  completed: 'Effectué',
  failed:    'Échoué',
  refunded:  'Remboursé',
}
