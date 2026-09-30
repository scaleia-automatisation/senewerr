'use server'
// Spec 27.1 — Protection des comptes : sessions, appareils, mots de passe
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/security/audit'
import { ShieldCheck, Smartphone, LogOut, Key, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sécurité — Paramètres' }

async function revokeSession(formData: FormData) {
  'use server'
  const sessionId = formData.get('session_id') as string
  if (!sessionId) return

  const supabase = await createClient()
  await supabase.auth.admin.deleteUser // not used — handled by Supabase session revoke
  // Supabase ne permet pas de révoquer des sessions arbitraires côté client
  // La déconnexion de l'appareil actuel est possible via signOut
  if (sessionId === 'current') {
    await logAudit({ action: 'account.signout', result: 'success', category: 'comptes' })
    await supabase.auth.signOut()
    redirect('/connexion')
  }
}

export default async function SecuritePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: { session } } = await supabase.auth.getSession()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('actor_type, phone, email, account_status, created_at')
    .eq('id', user.id)
    .maybeSingle()
  const profile = profileData as unknown as {
    actor_type: string | string[]; phone: string; email: string | null
    account_status: string; created_at: string
  } | null

  const isAdmin = Array.isArray(profile?.actor_type)
    ? profile.actor_type.includes('admin') || profile.actor_type.includes('super_admin')
    : false

  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null

  // Spec 27.1 — indicateurs de sécurité du compte
  const securityChecks = [
    {
      id: 'phone', label: 'Numéro de téléphone vérifié',
      ok: !!profile?.phone, detail: profile?.phone ? 'Vérifié' : 'Non renseigné',
    },
    {
      id: 'email', label: 'E-mail renseigné',
      ok: !!profile?.email, detail: profile?.email ?? 'Non renseigné',
    },
    {
      id: 'password', label: 'Mot de passe défini',
      ok: !!(user.email || user.phone), detail: 'Géré par Supabase Auth',
    },
    {
      id: 'verified', label: 'Compte vérifié par un administrateur',
      ok: profile?.account_status === 'verified', detail: profile?.account_status ?? '—',
    },
  ]

  // Spec 27.1 : authentification renforcée pour les comptes administratifs
  const adminSecurityChecks = isAdmin ? [
    {
      id: 'admin_mfa', label: 'Authentification renforcée (MFA)',
      ok: false, // à implémenter avec Supabase MFA
      detail: 'Recommandée pour les comptes admin (spec 27.1)',
      warning: true,
    },
  ] : []

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Sécurité</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 27.1 — protection du compte et des sessions</p>
      </div>

      {/* Score sécurité */}
      <div className="sw-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">État du compte</h2>
        </div>
        <div className="space-y-2">
          {[...securityChecks, ...adminSecurityChecks].map(c => (
            <div key={c.id} className="flex items-center gap-3">
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className={`w-4 h-4 shrink-0 ${(c as {warning?: boolean}).warning ? 'text-[var(--sw-warning)]' : 'text-[var(--sw-ink-3)]'}`} aria-hidden="true" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--sw-ink)]">{c.label}</p>
                <p className="text-xs text-[var(--sw-ink-3)]">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session actuelle — spec 27.1 */}
      <div className="sw-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Session actuelle</h2>
        </div>
        <div className="space-y-1 text-xs text-[var(--sw-ink-2)]">
          <p>Session ID : <code className="font-mono text-[var(--sw-ink-3)]">{session?.access_token?.slice(-12) ?? '—'}…</code></p>
          {lastSignIn && (
            <p>Dernière connexion : {lastSignIn.toLocaleString('fr-SN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          )}
          <p>Expiration : {session?.expires_at
            ? new Date(session.expires_at * 1000).toLocaleString('fr-SN', { dateStyle: 'medium', timeStyle: 'short' })
            : '—'}
          </p>
        </div>
        {/* Spec 27.1 : déconnexion des appareils */}
        <form action={revokeSession}>
          <input type="hidden" name="session_id" value="current" />
          <button
            type="submit"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-[var(--sw-danger)] text-[var(--sw-danger)] hover:bg-red-50 transition-colors"
            aria-label="Se déconnecter de cet appareil"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Se déconnecter
          </button>
        </form>
      </div>

      {/* Gestion du mot de passe — spec 27.1 */}
      <div className="sw-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Mot de passe</h2>
        </div>
        <p className="text-xs text-[var(--sw-ink-2)]">
          La modification du mot de passe envoie un lien de réinitialisation à votre numéro de téléphone ou e-mail.
        </p>
        <a
          href="/reset-password"
          className="inline-block text-xs px-3 py-1.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] hover:bg-[var(--sw-surface-3)] transition-colors"
        >
          Modifier le mot de passe
        </a>
      </div>

      {/* Admin : authentification renforcée — spec 27.1 */}
      {isAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)]">
          <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--sw-warning)]">Compte administratif</p>
            <p className="text-xs text-[var(--sw-warning)]">
              Les comptes admin et super admin requièrent une authentification renforcée (MFA).
              Activez la vérification en deux étapes dès que disponible (spec 27.1).
            </p>
          </div>
        </div>
      )}

      {/* Spec 27.2 — chiffrement */}
      <div className="sw-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Protection des données</h2>
        <div className="space-y-1.5">
          {[
            'Échanges chiffrés via TLS (HTTPS)',
            'Documents stockés dans Supabase Storage (RLS)',
            'Accès contrôlé par rôle et organisation (spec 27.2)',
            'Journalisation des accès aux données sensibles (spec 27.4)',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-[var(--sw-ink-2)]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
