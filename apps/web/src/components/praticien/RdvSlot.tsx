import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

type RdvStatus = 'pending' | 'confirmed' | 'patient_arrived' | 'in_consultation' | 'completed' | 'cancelled_patient' | 'cancelled_professional' | 'no_show'

const STATUS_LABEL: Record<RdvStatus, string> = {
  pending:                 'En attente',
  confirmed:               'Confirmé',
  patient_arrived:         'Arrivé',
  in_consultation:         'En consultation',
  completed:               'Terminé',
  cancelled_patient:       'Annulé (patient)',
  cancelled_professional:  'Annulé',
  no_show:                 'Absent',
}

const STATUS_VARIANT: Record<RdvStatus, 'neutral' | 'primary' | 'success' | 'accent' | 'pending' | 'danger'> = {
  pending:                'pending',
  confirmed:              'primary',
  patient_arrived:        'success',
  in_consultation:        'accent',
  completed:              'neutral',
  cancelled_patient:      'danger',
  cancelled_professional: 'danger',
  no_show:                'danger',
}

interface RdvSlotProps {
  appointment: {
    id: string
    start_time: string
    end_time?: string | null
    status: string
    motif?: string | null
    patient?: { full_name: string; avatar_url?: string | null } | null
  }
  onClick?: () => void
  className?: string
}

export function RdvSlot({ appointment, onClick, className }: RdvSlotProps) {
  const status = appointment.status as RdvStatus
  const start = parseISO(appointment.start_time)

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-s-3 rounded-lg border border-line bg-surface p-s-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft',
        className,
      )}
    >
      {/* Heure */}
      <div className="flex w-14 shrink-0 flex-col items-center">
        <span className="text-h3 font-semibold text-primary leading-none">
          {format(start, 'HH:mm')}
        </span>
        <span className="text-micro text-ink-3 flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {appointment.end_time
            ? format(parseISO(appointment.end_time), 'HH:mm')
            : '—'}
        </span>
      </div>

      {/* Infos */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">
          {appointment.patient?.full_name ?? 'Patient inconnu'}
        </p>
        {appointment.motif && (
          <p className="truncate text-small text-ink-3">{appointment.motif}</p>
        )}
      </div>

      <Badge variant={STATUS_VARIANT[status] ?? 'neutral'}>
        {STATUS_LABEL[status] ?? status}
      </Badge>
    </button>
  )
}
