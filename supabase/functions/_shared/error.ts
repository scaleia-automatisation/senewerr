// ============================================================
// Erreurs standardisées Medikool
// Format : { ok: false, error: { code, message, cause } }
// ============================================================

export type MedikoolError = {
  code: string
  message: string
  cause?: string
}

export const errors = {
  UNAUTHORIZED:               { code: 'UNAUTHORIZED',               message: 'Non autorisé' },
  FORBIDDEN:                  { code: 'FORBIDDEN',                  message: 'Accès interdit' },
  NOT_FOUND:                  { code: 'NOT_FOUND',                  message: 'Ressource introuvable' },
  VALIDATION_ERROR:           { code: 'VALIDATION_ERROR',           message: 'Données invalides' },
  STATUS_UPDATE_FORBIDDEN:    { code: 'STATUS_UPDATE_FORBIDDEN',    message: 'Modification de statut interdite depuis le client' },
  SCHEDULE_OVERLAP:           { code: 'SCHEDULE_OVERLAP',           message: 'Conflit de planning' },
  CODE_POOL_EXHAUSTED:        { code: 'CODE_POOL_EXHAUSTED',        message: 'Impossible de générer un code de retrait unique' },
  INSUFFICIENT_CREDITS:       { code: 'INSUFFICIENT_CREDITS',       message: 'Crédits IA insuffisants' },
  PAYMENT_PROVIDER_UNAVAILABLE:{ code: 'PAYMENT_PROVIDER_UNAVAILABLE', message: 'Service de paiement momentanément indisponible' },
  AI_PROVIDER_TIMEOUT:        { code: 'AI_PROVIDER_TIMEOUT',        message: 'Le service IA n\'a pas répondu à temps. Vos crédits n\'ont pas été débités.' },
  SLOT_NOT_AVAILABLE:         { code: 'SLOT_NOT_AVAILABLE',         message: 'Ce créneau n\'est plus disponible' },
  PRESCRIPTION_EXPIRED:       { code: 'PRESCRIPTION_EXPIRED',       message: 'Ordonnance expirée' },
  PRESCRIPTION_NOT_SIGNED:    { code: 'PRESCRIPTION_NOT_SIGNED',    message: 'Ordonnance non signée' },
  WITHDRAWAL_CODE_INVALID:    { code: 'WITHDRAWAL_CODE_INVALID',    message: 'Code de retrait incorrect' },
  WITHDRAWAL_LOCKED:          { code: 'WITHDRAWAL_LOCKED',          message: 'Retrait verrouillé suite à trop d\'essais' },
  PLAN_LIMIT_REACHED:         { code: 'PLAN_LIMIT_REACHED',         message: 'Limite du plan atteinte' },
  INTERNAL_ERROR:             { code: 'INTERNAL_ERROR',             message: 'Erreur interne du serveur' },
} as const

export type ErrorCode = keyof typeof errors

export function errorResponse(
  code: ErrorCode,
  cause?: string,
  status: number = 400
): Response {
  const err = errors[code]
  return new Response(
    JSON.stringify({ ok: false, error: { ...err, cause: cause ?? err.message } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

export function successResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify({ ok: true, data }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}
