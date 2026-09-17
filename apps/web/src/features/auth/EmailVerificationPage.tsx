import { useLocation, Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'

export default function EmailVerificationPage() {
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email

  return (
    <AuthLayout title="Vérifiez votre email">
      <div className="flex flex-col items-center gap-s-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-primary-soft">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-small text-ink-2">Un email de confirmation a été envoyé à</p>
          {email && <p className="mt-s-1 font-semibold text-ink">{email}</p>}
        </div>
        <p className="max-w-xs text-micro text-ink-3">
          Cliquez sur le lien dans l'email pour activer votre compte. Vérifiez vos spams si besoin.
        </p>
        <Button variant="secondary" fullWidth className="mt-s-2" asChild>
          <Link to="/auth/connexion">
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
