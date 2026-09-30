import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  Calendar, FileText, Pill, Bell, ShieldOff, Search,
  ClipboardList, Package, Users, BarChart3, Inbox,
} from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────────────── */
export type EmptyVariant =
  | 'rendez-vous'
  | 'documents'
  | 'reservations'
  | 'resultats'
  | 'prise-en-charge'
  | 'notifications'
  | 'ordonnances'
  | 'medicaments'
  | 'patients'
  | 'statistiques'
  | 'generic'

interface EmptyStateProps {
  /** Variante sémantique avec icône et texte par défaut */
  variant?: EmptyVariant
  /** Icône personnalisée (override la variante) */
  icon?: ReactNode
  /** Titre principal */
  title?: string
  /** Description secondaire */
  description?: string
  /** Bouton ou lien d'action */
  action?: ReactNode
  className?: string
}

/* ── Config par variante ─────────────────────────────────────────────────── */
const VARIANTS: Record<EmptyVariant, { icon: ReactNode; title: string; description: string }> = {
  'rendez-vous': {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Aucun rendez-vous prévu',
    description: 'Vous n\'avez pas encore de rendez-vous planifié.',
  },
  'documents': {
    icon: <FileText className="w-6 h-6" />,
    title: 'Aucun document',
    description: 'Vos documents apparaîtront ici dès qu\'ils seront disponibles.',
  },
  'reservations': {
    icon: <Package className="w-6 h-6" />,
    title: 'Aucune réservation en cours',
    description: 'Vos réservations de médicaments s\'afficheront ici.',
  },
  'resultats': {
    icon: <Search className="w-6 h-6" />,
    title: 'Aucun résultat',
    description: 'Essayez de modifier vos critères de recherche.',
  },
  'prise-en-charge': {
    icon: <ShieldOff className="w-6 h-6" />,
    title: 'Aucune demande de prise en charge',
    description: 'Vos demandes de remboursement apparaîtront ici.',
  },
  'notifications': {
    icon: <Bell className="w-6 h-6" />,
    title: 'Aucune notification',
    description: 'Vous êtes à jour — aucun message en attente.',
  },
  'ordonnances': {
    icon: <ClipboardList className="w-6 h-6" />,
    title: 'Aucune ordonnance',
    description: 'Vos ordonnances numériques seront archivées ici.',
  },
  'medicaments': {
    icon: <Pill className="w-6 h-6" />,
    title: 'Aucun médicament trouvé',
    description: 'Recherchez un médicament pour vérifier sa disponibilité.',
  },
  'patients': {
    icon: <Users className="w-6 h-6" />,
    title: 'Aucun patient',
    description: 'Vos patients apparaîtront ici après leurs premières consultations.',
  },
  'statistiques': {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Pas encore de données',
    description: 'Les statistiques s\'afficheront une fois l\'activité enregistrée.',
  },
  'generic': {
    icon: <Inbox className="w-6 h-6" />,
    title: 'Aucun élément',
    description: 'Cette section est vide pour l\'instant.',
  },
}

/* ── Composant ───────────────────────────────────────────────────────────── */
export function EmptyState({
  variant = 'generic',
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const cfg = VARIANTS[variant]

  const displayIcon = icon ?? cfg.icon
  const displayTitle = title ?? cfg.title
  const displayDesc = description ?? cfg.description

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-16 px-6 gap-4',
      className
    )}>
      {/* Illustration minimaliste : cercles concentriques + icône */}
      <div className="relative flex items-center justify-center mb-1">
        <div className="w-20 h-20 rounded-full bg-[var(--sw-surface-2)] border border-[var(--sw-line)]" />
        <div className="absolute w-14 h-14 rounded-full bg-[var(--sw-surface-3)]" />
        <div className="absolute w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center text-[var(--sw-primary)]">
          {displayIcon}
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <p className="text-sm font-semibold text-[var(--sw-ink)]">{displayTitle}</p>
        {displayDesc && (
          <p className="text-sm text-[var(--sw-ink-3)] leading-relaxed">{displayDesc}</p>
        )}
      </div>

      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
