import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { FileText, RefreshCw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface OrdonnanceItemProps {
  ordonnance: {
    id: string
    created_at: string
    patient_name: string
    medicaments: { nom: string; posologie?: string }[]
    is_renouvelable?: boolean
    renouvellements_restants?: number | null
    qr_code_url?: string | null
  }
  onClick?: () => void
  className?: string
}

export function OrdonnanceItem({ ordonnance, onClick, className }: OrdonnanceItemProps) {
  const meds = ordonnance.medicaments ?? []
  const hasRenew = ordonnance.is_renouvelable && (ordonnance.renouvellements_restants ?? 0) > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-s-3 rounded-lg border border-line bg-surface p-s-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft',
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/10">
        <FileText className="h-5 w-5 text-secondary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{ordonnance.patient_name}</p>
        <p className="truncate text-small text-ink-3">
          {meds.slice(0, 2).map(m => m.nom).join(', ')}
          {meds.length > 2 && ` +${meds.length - 2}`}
        </p>
        <p className="mt-s-1 text-micro text-ink-3">
          {format(parseISO(ordonnance.created_at), 'd MMM yyyy', { locale: fr })}
        </p>
      </div>

      <div className="flex flex-col items-end gap-s-1">
        {hasRenew && (
          <Badge variant="accent">
            <RefreshCw className="mr-0.5 h-3 w-3" />
            {ordonnance.renouvellements_restants}×
          </Badge>
        )}
        {ordonnance.qr_code_url && (
          <span className="rounded-sm bg-primary-soft px-s-1.5 py-0.5 text-micro font-medium text-primary">QR</span>
        )}
      </div>
    </button>
  )
}
