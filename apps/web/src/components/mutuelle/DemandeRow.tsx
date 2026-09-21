import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'

interface DemandeRowProps {
  adherentNom: string
  adherentAvatar?: string | null
  montant: number
  date: string
  statut: string
  type?: string
  onView?: () => void
  onApprouver?: () => void
  onRefuser?: () => void
}

export function DemandeRow({
  adherentNom, adherentAvatar, montant, date, statut, type,
  onView, onApprouver, onRefuser,
}: DemandeRowProps) {
  return (
    <div className="flex items-center gap-s-3 rounded-xl border border-line bg-surface px-s-4 py-s-3 hover:bg-surface-2/50 transition-colors">
      {/* Avatar */}
      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
        {adherentAvatar
          ? <img src={adherentAvatar} alt="" className="h-full w-full object-cover" />
          : <span className="text-small font-semibold text-primary">{adherentNom[0]?.toUpperCase()}</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink text-small truncate">{adherentNom}</p>
        <p className="text-micro text-ink-3">{type ?? 'Remboursement'}</p>
      </div>

      {/* Montant */}
      <p className="font-semibold text-ink shrink-0">
        {montant.toLocaleString('fr-FR')} <span className="text-micro text-ink-3">FCFA</span>
      </p>

      {/* Date */}
      <p className="text-micro text-ink-3 hidden sm:block shrink-0">
        {format(parseISO(date), 'dd MMM yyyy', { locale: fr })}
      </p>

      {/* Statut */}
      <StatusBadge status={statut} size="sm" />

      {/* Actions */}
      <div className="flex items-center gap-s-1 shrink-0">
        {onView && (
          <Button size="sm" variant="ghost" onClick={onView}>Voir</Button>
        )}
        {statut === 'en_attente' && onApprouver && (
          <Button size="sm" variant="primary" onClick={onApprouver}>Approuver</Button>
        )}
        {statut === 'en_attente' && onRefuser && (
          <Button size="sm" variant="ghost" onClick={onRefuser}>Refuser</Button>
        )}
      </div>
    </div>
  )
}
