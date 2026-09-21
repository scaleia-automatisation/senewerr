import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Stethoscope } from 'lucide-react'

interface SoapNote {
  subjectif?: string | null
  objectif?: string | null
  analyse?: string | null
  plan?: string | null
}

interface ConsultationNoteProps {
  consultation: {
    id: string
    created_at: string
    motif: string
    diagnostic_principal?: string | null
    soap?: SoapNote | null
    patient_name?: string
  }
  /** Patient ne peut jamais voir les notes SOAP */
  showSoap?: boolean
  onClick?: () => void
  className?: string
}

export function ConsultationNote({ consultation, showSoap = false, onClick, className }: ConsultationNoteProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-s-2 rounded-lg border border-line bg-surface p-s-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft',
        className,
      )}
    >
      <div className="flex items-center gap-s-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Stethoscope className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{consultation.motif}</p>
          <p className="text-micro text-ink-3">
            {consultation.patient_name && `${consultation.patient_name} · `}
            {format(parseISO(consultation.created_at), 'd MMM yyyy', { locale: fr })}
          </p>
        </div>
      </div>

      {consultation.diagnostic_principal && (
        <p className="text-small text-ink-2">
          <span className="font-medium">Diagnostic :</span> {consultation.diagnostic_principal}
        </p>
      )}

      {/* Notes SOAP — praticien uniquement, jamais affichées au patient */}
      {showSoap && consultation.soap && (
        <div className="mt-s-1 grid grid-cols-2 gap-s-2 rounded-md bg-surface-2 p-s-2">
          {(['subjectif', 'objectif', 'analyse', 'plan'] as const).map(key => (
            consultation.soap![key] ? (
              <div key={key}>
                <p className="text-micro font-semibold uppercase tracking-wide text-ink-3">{key}</p>
                <p className="text-small text-ink line-clamp-2">{consultation.soap![key]}</p>
              </div>
            ) : null
          ))}
        </div>
      )}
    </button>
  )
}
