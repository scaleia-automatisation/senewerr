import { StatusBadge } from './StatusBadge'
import { CheckCircle, XCircle } from 'lucide-react'

interface AdherentCardProps {
  nom: string
  numeroContrat: string
  statut: string
  cotisationsAJour: boolean
  avatar?: string | null
  dateAdhesion?: string
  onClick?: () => void
}

export function AdherentCard({
  nom, numeroContrat, statut, cotisationsAJour, avatar, dateAdhesion, onClick,
}: AdherentCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-s-3 rounded-xl border border-line bg-surface p-s-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Avatar */}
      <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
        {avatar
          ? <img src={avatar} alt="" className="h-full w-full object-cover" />
          : <span className="text-body font-bold text-primary">{nom[0]?.toUpperCase()}</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink truncate">{nom}</p>
        <p className="text-micro text-ink-3">N° {numeroContrat}</p>
        {dateAdhesion && <p className="text-micro text-ink-3">Adhérent depuis {dateAdhesion}</p>}
      </div>

      {/* Right column */}
      <div className="flex flex-col items-end gap-s-1 shrink-0">
        <StatusBadge status={statut} size="sm" />
        <span className={`flex items-center gap-s-1 text-micro font-medium ${cotisationsAJour ? 'text-emerald-600' : 'text-red-500'}`}>
          {cotisationsAJour
            ? <><CheckCircle className="h-3.5 w-3.5" /> Cotisations à jour</>
            : <><XCircle className="h-3.5 w-3.5" /> Cotisations en retard</>
          }
        </span>
      </div>
    </button>
  )
}
