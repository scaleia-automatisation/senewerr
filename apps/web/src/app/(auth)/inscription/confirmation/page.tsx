import Link from 'next/link'
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Compte créé' }

export default function RegisterConfirmationPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--sw-surface-2)]">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-[var(--sw-ink)]">Séné Wérr</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Compte créé avec succès !</h1>
            <p className="text-[var(--sw-ink-2)]">
              Votre compte Séné Wérr est en cours de création. Vous pouvez maintenant vous connecter.
            </p>
          </div>

          {/* Pour comptes professionnels */}
          <div className="sw-card p-5 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--sw-warning-bg)] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--sw-ink)]">Vérification en cours</p>
                <p className="text-xs text-[var(--sw-ink-2)]">Pour les comptes professionnels</p>
              </div>
            </div>
            <p className="text-sm text-[var(--sw-ink-2)]">
              Si vous avez créé un compte professionnel (établissement, pharmacie, mutuelle),
              votre dossier sera examiné par notre équipe. Vous recevrez une notification dès
              que votre compte est validé.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/connexion">
              <Button className="w-full" size="lg">
                Accéder à mon espace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="w-full" size="lg">
                Retour à l'accueil
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
