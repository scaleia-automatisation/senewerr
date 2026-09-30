import { Clock, AlertCircle, CheckCircle2, XCircle, PauseCircle } from 'lucide-react'

type AccountStatus = 'brouillon' | 'pending' | 'a_completer' | 'verifie' | 'refuse' | 'suspendu' | 'desactive'

interface Props {
  status: AccountStatus
  motif?: string | null
}

const STATUS_CONFIG: Record<AccountStatus, {
  icon: typeof Clock
  label: string
  desc: string
  className: string
}> = {
  brouillon: {
    icon: Clock,
    label: 'Inscription incomplète',
    desc: "Finalisez votre dossier pour accéder à toutes les fonctionnalités.",
    className: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)] text-[var(--sw-ink-2)]',
  },
  pending: {
    icon: Clock,
    label: 'En attente de validation',
    desc: "Votre dossier est en cours d'examen par notre équipe. Vous serez notifié(e) dès validation.",
    className: 'bg-[var(--sw-warning-bg)] border-[var(--sw-warning)] text-[var(--sw-warning)]',
  },
  a_completer: {
    icon: AlertCircle,
    label: 'Informations manquantes',
    desc: "Des informations supplémentaires sont requises pour valider votre compte.",
    className: 'bg-[var(--sw-warning-bg)] border-[var(--sw-warning)] text-[var(--sw-warning)]',
  },
  verifie: {
    icon: CheckCircle2,
    label: 'Compte vérifié',
    desc: 'Votre compte est validé et actif.',
    className: 'bg-[var(--sw-success-bg)] border-[var(--sw-success)] text-[var(--sw-success)]',
  },
  refuse: {
    icon: XCircle,
    label: 'Demande refusée',
    desc: "Votre demande n'a pas pu être validée.",
    className: 'bg-[var(--sw-danger-bg,#fef2f2)] border-[var(--sw-danger)] text-[var(--sw-danger)]',
  },
  suspendu: {
    icon: PauseCircle,
    label: 'Compte suspendu',
    desc: 'Votre accès est temporairement bloqué. Contactez le support.',
    className: 'bg-[var(--sw-danger-bg,#fef2f2)] border-[var(--sw-danger)] text-[var(--sw-danger)]',
  },
  desactive: {
    icon: XCircle,
    label: 'Compte désactivé',
    desc: 'Ce compte a été fermé.',
    className: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)] text-[var(--sw-ink-3)]',
  },
}

export function AccountStatusBanner({ status, motif }: Props) {
  if (status === 'verifie') return null

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.className} text-sm`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{cfg.label}</p>
        <p className="mt-0.5 opacity-80 text-xs">{cfg.desc}</p>
        {motif && <p className="mt-1 text-xs font-medium">Motif : {motif}</p>}
      </div>
    </div>
  )
}
