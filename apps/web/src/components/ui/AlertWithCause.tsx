import { formatErrorMessage, type AppError } from '@medikool/shared'

// Composant qui affiche une erreur typée avec sa cause (sauf SEC_*)
// Utilisé par tous les catch dans le front

interface AlertWithCauseProps {
  error: AppError | null
  className?: string
}

export function AlertWithCause({ error, className }: AlertWithCauseProps) {
  if (!error) return null
  const message = formatErrorMessage(error)

  const isWarning =
    error.http === 429 ||
    error.code === 'PLAN_LIMIT_REACHED' ||
    error.code === 'INSUFFICIENT_CREDITS'
  const isInfo =
    error.code.startsWith('AI_') || error.code === 'GEOCODING_FAILED'

  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-s-3 rounded-lg border p-s-4 text-small',
        isInfo
          ? 'border-primary/30 bg-primary/5 text-primary'
          : isWarning
            ? 'border-status-warning/30 bg-status-warning/5 text-status-warning'
            : 'border-status-danger/30 bg-status-danger/5 text-status-danger',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="mt-0.5 shrink-0 text-base">
        {isInfo ? 'ℹ' : isWarning ? '⚠' : '✕'}
      </span>
      <div className="flex-1 space-y-0.5">
        <p className="font-medium">{message}</p>
        {error.retryable && (
          <p className="text-micro opacity-70">Vous pouvez réessayer.</p>
        )}
        {error.meta?.requestId != null && (
          <p className="text-micro font-mono opacity-50">
            Réf. {String(error.meta.requestId)}
          </p>
        )}
      </div>
    </div>
  )
}

// Hook utilitaire pour normaliser les erreurs venant d'une Edge Function
export function useApiError() {
  function parseError(raw: unknown): AppError | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    if (r.ok === false && r.error) {
      return r.error as AppError
    }
    // Erreur Supabase brute (pas encore migrée)
    if (r.message) {
      return {
        code: 'SYS_DB_ERROR',
        message: 'Erreur serveur. Nous avons été prévenus.',
        http: 500,
        retryable: true,
      }
    }
    return null
  }
  return { parseError }
}
