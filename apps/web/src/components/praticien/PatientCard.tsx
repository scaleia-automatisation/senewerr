import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { format, differenceInYears, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PatientCardProps {
  patient: {
    id: string
    full_name: string
    date_naissance?: string | null
    avatar_url?: string | null
    groupe_sanguin?: string | null
  }
  subtitle?: string
  badge?: string
  badgeVariant?: 'primary' | 'success' | 'pending' | 'danger' | 'neutral' | 'accent'
  onClick?: () => void
  className?: string
}

export function PatientCard({ patient, subtitle, badge, badgeVariant = 'neutral', onClick, className }: PatientCardProps) {
  const age = patient.date_naissance
    ? differenceInYears(new Date(), parseISO(patient.date_naissance))
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-s-3 rounded-lg p-s-3 text-left transition-colors',
        onClick ? 'hover:bg-surface-2 cursor-pointer' : 'cursor-default',
        className,
      )}
    >
      <Avatar src={patient.avatar_url} fallback={patient.full_name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{patient.full_name}</p>
        <p className="truncate text-small text-ink-3">
          {subtitle ?? (age !== null ? `${age} ans` : '—')}
        </p>
      </div>
      {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      {patient.groupe_sanguin && (
        <span className="shrink-0 rounded-sm bg-red-100 px-s-1.5 py-0.5 text-micro font-bold text-red-700">
          {patient.groupe_sanguin}
        </span>
      )}
    </button>
  )
}
