import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import type { Database } from '@medikool/shared'

type UserRole = Database['public']['Enums']['user_role']

// ──────────────────────────────────────────────────────────
// RequireAuth — redirige vers /auth/connexion si non connecté
// ──────────────────────────────────────────────────────────
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!session) {
    return <Navigate to="/auth/connexion" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// ──────────────────────────────────────────────────────────
// RequireRole — redirige vers / si rôle non autorisé
// ──────────────────────────────────────────────────────────
export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: ReactNode
}) {
  const { profile, loading } = useAuth()

  if (loading) return null
  if (!profile) return <Navigate to="/auth/connexion" replace />

  if (!roles.includes(profile.role as UserRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ──────────────────────────────────────────────────────────
// Require2FA — force la validation MFA pour les admins
// Redirige vers /auth/2fa si session aal1 et aal2 requis
// ──────────────────────────────────────────────────────────
export function Require2FA({ children }: { children: ReactNode }) {
  const { profile, needsMfa, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!profile) return <Navigate to="/auth/connexion" replace />

  const requiresMfa = ['platform_admin', 'super_admin'].includes(profile.role)

  if (requiresMfa && needsMfa) {
    return <Navigate to="/auth/2fa" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

// ──────────────────────────────────────────────────────────
// PendingVerificationBanner
// Affiché pour les acteurs non-patients en attente de vérification
// ──────────────────────────────────────────────────────────
export function PendingVerificationBanner() {
  const { profile } = useAuth()

  if (!profile) return null
  if (profile.role === 'patient') return null
  if ((profile as { verification_status?: string }).verification_status === 'verified') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-s-3 bg-[var(--status-pending)] bg-opacity-10 border border-[var(--status-pending)] px-s-4 py-s-3 text-small text-ink"
    >
      <span className="font-medium">⏳</span>
      <p>
        <span className="font-medium">Compte en attente de vérification.</span>
        {' '}Notre équipe examine votre dossier. Vous recevrez un email dès validation.
        En attendant, votre profil n'est pas visible publiquement.
      </p>
    </div>
  )
}
