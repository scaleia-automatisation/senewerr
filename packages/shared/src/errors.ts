// packages/shared/src/errors.ts
// Source unique de vérité pour tous les codes d'erreur de l'application

export type ErrorCode =
  // VAL_* — Validation (400)
  | 'VAL_INVALID_INPUT'
  | 'VAL_MISSING_FIELD'
  // AUTH_* — Authentification (401)
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_LOCKED'
  | 'AUTH_2FA_REQUIRED'
  | 'AUTH_2FA_INVALID'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  | 'AUTH_SESSION_EXPIRED'
  // PERM_* — Permissions (403/404)
  | 'PERM_DENIED'
  // SEC_* — Sécurité (message générique côté client, cause interne uniquement)
  | 'SEC_TENANT_VIOLATION'
  | 'SEC_RATE_LIMITED'
  | 'SEC_WEBHOOK_SIGNATURE'
  | 'SEC_WITHDRAWAL_LOCKED'
  | 'SEC_CAPTCHA_FAILED'
  // APT_* — Rendez-vous (409)
  | 'SLOT_ALREADY_BOOKED'
  | 'SLOT_NOT_AVAILABLE'
  | 'CANCEL_TOO_LATE'
  | 'PRO_MONTHLY_LIMIT'
  | 'APPOINTMENT_NOT_ARRIVED'
  | 'SCHEDULE_CONFLICT'
  | 'SCHEDULE_HAS_APPOINTMENTS'
  // RX_* — Ordonnance (409/500)
  | 'PRESCRIPTION_REQUIRED'
  | 'PRESCRIPTION_EXPIRED'
  | 'PRESCRIPTION_ALREADY_SHARED'
  | 'PRESCRIPTION_NOT_SIGNABLE'
  | 'PROFESSIONAL_NOT_VERIFIED'
  | 'SHARE_EXPIRED'
  | 'PDF_GENERATION_FAILED'
  // RSV_* — Réservation (409)
  | 'STOCK_INSUFFICIENT'
  | 'STOCK_CHANGED'
  | 'PHARMACY_CLOSED_FOR_RESERVATIONS'
  | 'PHARMACY_NOT_VERIFIED'
  | 'PREPARATION_BLOCKED'
  | 'WITHDRAWAL_CODE_INVALID'
  | 'WITHDRAWAL_LOCKED'
  | 'RESERVATION_EXPIRED'
  | 'CANCEL_NOT_ALLOWED'
  | 'CODE_POOL_EXHAUSTED'
  // INS_* — Mutuelle (409)
  | 'MEMBER_NOT_VERIFIED'
  | 'CEILING_EXCEEDED'
  | 'COVERAGE_RULE_NOT_FOUND'
  | 'MEMBER_QUOTA_REACHED'
  // PAY_* — Paiement (402/409/503)
  | 'PAYMENT_PROVIDER_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'CLIENT_AMOUNT_IGNORED'
  | 'PAYMENT_ALREADY_PAID'
  | 'REFUND_LIMIT_EXCEEDED'
  | 'REFUND_FAILED'
  // BIL_* — Facturation (402/409)
  | 'PLAN_LIMIT_REACHED'
  | 'INSUFFICIENT_CREDITS'
  | 'PROMO_INVALID'
  | 'SUBSCRIPTION_PAST_DUE'
  // AI_* — IA (502/400)
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'AI_INVALID_OUTPUT'
  | 'AUDIO_TOO_LONG'
  | 'AI_EMERGENCY_DETECTED'
  // DOC_* — Documents (400/404)
  | 'DOC_TOO_LARGE'
  | 'DOC_TYPE_UNSUPPORTED'
  | 'DOC_VIRUS_DETECTED'
  | 'DOC_NOT_FOUND'
  // INT_* — Intégrations (502)
  | 'EMAIL_PROVIDER_ERROR'
  | 'GEOCODING_FAILED'
  | 'PUSH_FAILED'
  // SYS_* — Système (500/503)
  | 'SYS_DB_ERROR'
  | 'SYS_TIMEOUT'
  | 'SYS_MAINTENANCE'
  | 'SYS_OFFLINE'

export interface AppError {
  code: ErrorCode
  message: string        // message pour l'utilisateur
  cause?: string         // cause technique (masquée pour SEC_*)
  http: number
  retryable: boolean
  entity?: string        // champ/entité concernée
  meta?: Record<string, unknown>  // données supplémentaires (retry-after, montant limite, etc.)
}

export interface ApiErrorResponse {
  ok: false
  error: AppError
  request_id?: string
}

export interface ApiSuccessResponse<T = unknown> {
  ok: true
  data: T
  request_id?: string
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// Familles qui ne doivent jamais exposer la cause à l'utilisateur
const SEC_CODES = new Set<ErrorCode>([
  'SEC_TENANT_VIOLATION', 'SEC_RATE_LIMITED', 'SEC_WEBHOOK_SIGNATURE',
  'SEC_WITHDRAWAL_LOCKED', 'SEC_CAPTCHA_FAILED',
])

// Messages utilisateur par code
const USER_MESSAGES: Record<ErrorCode, string> = {
  VAL_INVALID_INPUT: '{entity} : {cause}',
  VAL_MISSING_FIELD: 'Le champ {entity} est requis.',
  AUTH_REQUIRED: 'Vous devez être connecté pour accéder à cette ressource.',
  AUTH_INVALID_CREDENTIALS: 'Email ou mot de passe incorrect.',
  AUTH_LOCKED: 'Compte temporairement bloqué. Réessayez dans {meta.until}.',
  AUTH_2FA_REQUIRED: 'Vérification en deux étapes requise.',
  AUTH_2FA_INVALID: 'Code de vérification incorrect.',
  AUTH_EMAIL_NOT_VERIFIED: 'Veuillez vérifier votre adresse email avant de continuer.',
  AUTH_SESSION_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
  PERM_DENIED: 'Ressource introuvable.',
  SEC_TENANT_VIOLATION: 'Accès refusé.',
  SEC_RATE_LIMITED: 'Trop de requêtes. Réessayez dans {meta.retryAfter} s.',
  SEC_WEBHOOK_SIGNATURE: 'Accès refusé.',
  SEC_WITHDRAWAL_LOCKED: 'Accès refusé.',
  SEC_CAPTCHA_FAILED: 'Vérification anti-robot échouée. Réessayez.',
  SLOT_ALREADY_BOOKED: "Ce créneau vient d'être réservé. Veuillez en choisir un autre.",
  SLOT_NOT_AVAILABLE: "Ce créneau n'est plus disponible.",
  CANCEL_TOO_LATE: "L'annulation n'est plus possible à cette heure.",
  PRO_MONTHLY_LIMIT: "Vous avez atteint la limite de rendez-vous de votre plan ce mois-ci.",
  APPOINTMENT_NOT_ARRIVED: "Le patient n'a pas encore été enregistré comme arrivé.",
  SCHEDULE_CONFLICT: "Conflit d'horaire détecté.",
  SCHEDULE_HAS_APPOINTMENTS: '{meta.count} rendez-vous sont affectés par cette modification.',
  PRESCRIPTION_REQUIRED: 'Une ordonnance valide est requise pour cette réservation.',
  PRESCRIPTION_EXPIRED: 'Cette ordonnance a expiré (validité 90 jours).',
  PRESCRIPTION_ALREADY_SHARED: 'Cette ordonnance est déjà partagée avec une pharmacie.',
  PRESCRIPTION_NOT_SIGNABLE: "L'ordonnance ne peut pas être signée : {cause}.",
  PROFESSIONAL_NOT_VERIFIED: "Votre compte professionnel n'est pas encore vérifié.",
  SHARE_EXPIRED: "Le partage d'ordonnance a expiré.",
  PDF_GENERATION_FAILED: 'La génération du PDF a échoué. Réessayez.',
  STOCK_INSUFFICIENT: "{entity} n'est pas disponible en stock suffisant.",
  STOCK_CHANGED: 'Le stock a changé depuis votre dernière consultation. Veuillez vérifier votre panier.',
  PHARMACY_CLOSED_FOR_RESERVATIONS: "Cette pharmacie n'accepte plus de réservations en ce moment.",
  PHARMACY_NOT_VERIFIED: "Cette pharmacie n'est pas encore vérifiée.",
  PREPARATION_BLOCKED: 'La préparation est bloquée : {cause}.',
  WITHDRAWAL_CODE_INVALID: 'Code incorrect ({meta.attempts}/5 tentatives).',
  WITHDRAWAL_LOCKED: "Trop de tentatives. Retrait bloqué jusqu'à {meta.until}.",
  RESERVATION_EXPIRED: 'Cette réservation a expiré : {cause}.',
  CANCEL_NOT_ALLOWED: 'L\'annulation n\'est pas possible pour une commande au statut « {entity} ».',
  CODE_POOL_EXHAUSTED: 'Impossible de générer un code de retrait. Contactez le support.',
  MEMBER_NOT_VERIFIED: "Votre adhésion mutuelle n'est pas encore vérifiée.",
  CEILING_EXCEEDED: 'Votre plafond annuel est atteint. Reste disponible : {meta.remaining} FCFA.',
  COVERAGE_RULE_NOT_FOUND: 'Aucune règle de prise en charge applicable pour cet acte.',
  MEMBER_QUOTA_REACHED: 'Le nombre maximum de bénéficiaires est atteint.',
  PAYMENT_PROVIDER_UNAVAILABLE: 'Le service de paiement {meta.psp} est temporairement indisponible. Réessayez.',
  PAYMENT_DECLINED: 'Votre paiement a échoué : {meta.declineReason}.',
  PAYMENT_AMOUNT_MISMATCH: 'Le montant ne correspond pas. La page va se recharger.',
  CLIENT_AMOUNT_IGNORED: 'Le montant est recalculé côté serveur.',
  PAYMENT_ALREADY_PAID: 'Cette commande a déjà été payée.',
  REFUND_LIMIT_EXCEEDED: 'Montant de remboursement supérieur à votre limite autorisée.',
  REFUND_FAILED: 'Le remboursement a échoué : {meta.psoCause}. Contactez le support.',
  PLAN_LIMIT_REACHED: 'Limite atteinte pour {entity} ({meta.current}/{meta.max}). Passez à un plan supérieur.',
  INSUFFICIENT_CREDITS: 'Crédits insuffisants (solde : {meta.balance}, requis : {meta.required}).',
  PROMO_INVALID: 'Code promo invalide : {cause}.',
  SUBSCRIPTION_PAST_DUE: 'Votre abonnement est en retard de paiement. Accès limité.',
  AI_PROVIDER_TIMEOUT: "La génération a dépassé le délai. Vos crédits n'ont pas été débités.",
  AI_PROVIDER_ERROR: "La génération a échoué : {cause}. Vos crédits n'ont pas été débités.",
  AI_INVALID_OUTPUT: "La réponse de l'IA n'est pas dans le format attendu. Vos crédits n'ont pas été débités.",
  AUDIO_TOO_LONG: 'L\'audio dépasse la durée maximale autorisée.',
  AI_EMERGENCY_DETECTED: 'Une situation d\'urgence a été détectée. Appelez le 15 (SAMU).',
  DOC_TOO_LARGE: 'Fichier trop volumineux (max {meta.maxMb} Mo).',
  DOC_TYPE_UNSUPPORTED: 'Format de fichier non supporté.',
  DOC_VIRUS_DETECTED: 'Le fichier contient un contenu malveillant et a été rejeté.',
  DOC_NOT_FOUND: 'Document introuvable.',
  EMAIL_PROVIDER_ERROR: "L'envoi de l'email a échoué. Réessayez.",
  GEOCODING_FAILED: 'Adresse non localisée. Veuillez la saisir manuellement.',
  PUSH_FAILED: "La notification push n'a pas pu être envoyée.",
  SYS_DB_ERROR: 'Erreur serveur ({meta.requestId}). Nous avons été prévenus.',
  SYS_TIMEOUT: 'La requête a expiré. Réessayez.',
  SYS_MAINTENANCE: 'Maintenance en cours jusqu\'à {meta.until}.',
  SYS_OFFLINE: 'Vous êtes hors ligne. Vérifiez votre connexion.',
}

const HTTP_CODES: Record<ErrorCode, number> = {
  VAL_INVALID_INPUT: 400, VAL_MISSING_FIELD: 400,
  AUTH_REQUIRED: 401, AUTH_INVALID_CREDENTIALS: 401, AUTH_LOCKED: 401,
  AUTH_2FA_REQUIRED: 401, AUTH_2FA_INVALID: 401,
  AUTH_EMAIL_NOT_VERIFIED: 401, AUTH_SESSION_EXPIRED: 401,
  PERM_DENIED: 404,
  SEC_TENANT_VIOLATION: 403, SEC_RATE_LIMITED: 429,
  SEC_WEBHOOK_SIGNATURE: 400, SEC_WITHDRAWAL_LOCKED: 429, SEC_CAPTCHA_FAILED: 400,
  SLOT_ALREADY_BOOKED: 409, SLOT_NOT_AVAILABLE: 409, CANCEL_TOO_LATE: 409,
  PRO_MONTHLY_LIMIT: 409, APPOINTMENT_NOT_ARRIVED: 409,
  SCHEDULE_CONFLICT: 409, SCHEDULE_HAS_APPOINTMENTS: 409,
  PRESCRIPTION_REQUIRED: 409, PRESCRIPTION_EXPIRED: 409,
  PRESCRIPTION_ALREADY_SHARED: 409, PRESCRIPTION_NOT_SIGNABLE: 409,
  PROFESSIONAL_NOT_VERIFIED: 409, SHARE_EXPIRED: 409, PDF_GENERATION_FAILED: 500,
  STOCK_INSUFFICIENT: 409, STOCK_CHANGED: 409,
  PHARMACY_CLOSED_FOR_RESERVATIONS: 409, PHARMACY_NOT_VERIFIED: 409,
  PREPARATION_BLOCKED: 409, WITHDRAWAL_CODE_INVALID: 400,
  WITHDRAWAL_LOCKED: 429, RESERVATION_EXPIRED: 409,
  CANCEL_NOT_ALLOWED: 409, CODE_POOL_EXHAUSTED: 500,
  MEMBER_NOT_VERIFIED: 409, CEILING_EXCEEDED: 409,
  COVERAGE_RULE_NOT_FOUND: 409, MEMBER_QUOTA_REACHED: 409,
  PAYMENT_PROVIDER_UNAVAILABLE: 503, PAYMENT_DECLINED: 402,
  PAYMENT_AMOUNT_MISMATCH: 409, CLIENT_AMOUNT_IGNORED: 400,
  PAYMENT_ALREADY_PAID: 409, REFUND_LIMIT_EXCEEDED: 403, REFUND_FAILED: 500,
  PLAN_LIMIT_REACHED: 402, INSUFFICIENT_CREDITS: 402,
  PROMO_INVALID: 409, SUBSCRIPTION_PAST_DUE: 402,
  AI_PROVIDER_TIMEOUT: 502, AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502, AUDIO_TOO_LONG: 400, AI_EMERGENCY_DETECTED: 400,
  DOC_TOO_LARGE: 400, DOC_TYPE_UNSUPPORTED: 400,
  DOC_VIRUS_DETECTED: 400, DOC_NOT_FOUND: 404,
  EMAIL_PROVIDER_ERROR: 502, GEOCODING_FAILED: 502, PUSH_FAILED: 502,
  SYS_DB_ERROR: 500, SYS_TIMEOUT: 503,
  SYS_MAINTENANCE: 503, SYS_OFFLINE: 503,
}

const RETRYABLE_CODES = new Set<ErrorCode>([
  'PAYMENT_PROVIDER_UNAVAILABLE', 'PDF_GENERATION_FAILED',
  'AI_PROVIDER_TIMEOUT', 'AI_PROVIDER_ERROR',
  'EMAIL_PROVIDER_ERROR', 'PUSH_FAILED', 'GEOCODING_FAILED',
  'SYS_DB_ERROR', 'SYS_TIMEOUT', 'SYS_MAINTENANCE',
])

export function makeError(
  code: ErrorCode,
  cause?: string,
  entity?: string,
  meta?: Record<string, unknown>,
): AppError {
  const isSec = SEC_CODES.has(code)
  return {
    code,
    message: USER_MESSAGES[code] ?? 'Une erreur inattendue est survenue.',
    cause: isSec ? undefined : cause,  // jamais de cause pour SEC_*
    http: HTTP_CODES[code] ?? 500,
    retryable: RETRYABLE_CODES.has(code),
    entity,
    meta,
  }
}

export function errorResponse(
  code: ErrorCode,
  cause?: string,
  entity?: string,
  meta?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  return { ok: false, error: makeError(code, cause, entity, meta), request_id: requestId }
}

export function successResponse<T>(data: T, requestId?: string): ApiSuccessResponse<T> {
  return { ok: true, data, request_id: requestId }
}

export function isSecFamily(code: ErrorCode): boolean {
  return SEC_CODES.has(code)
}

/** Interpolate {meta.key}, {entity} and {cause} placeholders in error message */
export function formatErrorMessage(error: AppError): string {
  let msg = error.message
  if (error.entity) msg = msg.replace('{entity}', error.entity)
  if (error.cause) msg = msg.replace('{cause}', error.cause)
  if (error.meta) {
    for (const [k, v] of Object.entries(error.meta)) {
      msg = msg.replace(`{meta.${k}}`, String(v))
    }
  }
  return msg
}
