import { Link } from 'react-router-dom'
import { Zap, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface UpgradeBannerProps {
  reason: 'ai_credits' | 'appointments' | 'establishments' | 'users'
  currentBalance?: number
  required?: number
  className?: string
}

export function UpgradeBanner({
  reason,
  currentBalance,
  required,
  className,
}: UpgradeBannerProps) {
  const messages = {
    ai_credits: {
      icon: <Zap className="w-4 h-4 text-accent" />,
      text:
        currentBalance !== undefined
          ? `Vous n'avez plus de crédits IA (${currentBalance} restant${currentBalance > 1 ? 's' : ''}).`
          : 'Crédits IA insuffisants.',
      actions: [
        { label: 'Acheter un pack', to: '/abonnement#credits', primary: true },
        { label: 'Passer au plan supérieur', to: '/tarifs', primary: false },
      ],
    },
    appointments: {
      icon: <ArrowUp className="w-4 h-4 text-primary" />,
      text: 'Vous avez atteint votre limite de rendez-vous ce mois-ci.',
      actions: [{ label: 'Voir les plans', to: '/tarifs', primary: true }],
    },
    establishments: {
      icon: <ArrowUp className="w-4 h-4 text-primary" />,
      text: "Vous avez atteint le nombre maximum d'établissements.",
      actions: [{ label: 'Passer au plan Pro', to: '/tarifs', primary: true }],
    },
    users: {
      icon: <ArrowUp className="w-4 h-4 text-primary" />,
      text: "Vous avez atteint le nombre maximum d'utilisateurs.",
      actions: [{ label: 'Voir les plans', to: '/tarifs', primary: true }],
    },
  }

  const config = messages[reason]

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-s-3 rounded-md border border-accent/30 bg-accent/5 p-s-3 ${className ?? ''}`}
    >
      <div className="flex items-center gap-s-2 flex-1">
        {config.icon}
        <p className="text-small text-ink">{config.text}</p>
      </div>
      <div className="flex gap-s-2 shrink-0">
        {config.actions.map((a) => (
          <Button
            key={a.to}
            variant={a.primary ? 'primary' : 'ghost'}
            className="text-small"
            asChild
          >
            <Link to={a.to}>{a.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
