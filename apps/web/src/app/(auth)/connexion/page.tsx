import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { Logo } from '@/components/ui/logo'

export const metadata = { title: 'Connexion — Séné Wérr' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface-2)]">
      {/* Header */}
      <div className="p-6">
        <Link href="/" className="w-fit">
          <Logo size="sm" />
        </Link>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Bon retour</h1>
            <p className="text-sm text-[var(--sw-ink-2)]">Connectez-vous à votre espace Séné Wérr</p>
          </div>
          <div className="sw-card p-6">
            <LoginForm />
          </div>
          <p className="text-center text-sm text-[var(--sw-ink-2)]">
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="text-[var(--sw-primary)] font-medium hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
