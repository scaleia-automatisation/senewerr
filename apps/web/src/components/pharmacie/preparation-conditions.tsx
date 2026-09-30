import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export type PrepConditions = {
  reservationConfirmed: boolean
  prescriptionRequired: boolean
  prescriptionPresent: boolean
  coverageRequested: boolean
  coverageApproved: boolean
  resteAChargeRequired: boolean
  resteAChargePaid: boolean
  deferred: boolean // délai de paiement configuré — ne bloque pas
  allMet: boolean
  reservationId: string
  patientId: string | null
}

function Row({ ok, label, sublabel }: { ok: boolean; label: string; sublabel?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--sw-line)] last:border-0">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0 mt-0.5" />
        : <XCircle className="w-4 h-4 text-[var(--sw-danger)] shrink-0 mt-0.5" />
      }
      <div>
        <p className={`text-sm font-medium ${ok ? 'text-[var(--sw-ink)]' : 'text-[var(--sw-danger)]'}`}>{label}</p>
        {sublabel && <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{sublabel}</p>}
      </div>
    </div>
  )
}

export function PreparationConditions({ conditions }: { conditions: PrepConditions }) {
  if (conditions.allMet) {
    return (
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[var(--sw-success-bg)] border border-[var(--sw-success)]/30">
        <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0" />
        <p className="text-xs font-medium text-[var(--sw-success)]">
          Toutes les conditions de préparation sont remplies (spec 17.4)
        </p>
      </div>
    )
  }

  return (
    <div className="sw-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-[var(--sw-warning)]" />
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-warning)]">
          Conditions de préparation non remplies
        </p>
      </div>

      <div>
        <Row ok={conditions.reservationConfirmed} label="Réservation confirmée par la pharmacie" />

        {conditions.prescriptionRequired && (
          <Row
            ok={conditions.prescriptionPresent}
            label="Ordonnance vérifiée"
            sublabel={conditions.prescriptionPresent ? undefined : 'Ordonnance requise mais non vérifiée'}
          />
        )}

        {conditions.coverageRequested && (
          <Row
            ok={conditions.coverageApproved}
            label="Couverture validée"
            sublabel={conditions.coverageApproved ? undefined : "En attente de décision de l'organisme de couverture"}
          />
        )}

        {conditions.resteAChargeRequired && (
          <Row
            ok={conditions.resteAChargePaid || conditions.deferred}
            label="Reste à charge réglé"
            sublabel={
              conditions.deferred ? 'Règlement différé autorisé par convention'
                : conditions.resteAChargePaid ? undefined
                  : 'Le patient doit régler son reste à charge'
            }
          />
        )}
      </div>

      {!conditions.reservationConfirmed && (
        <p className="text-xs text-[var(--sw-ink-3)]">
          Vérifiez la réservation, l'ordonnance et le statut de couverture avant de passer en préparation.
        </p>
      )}
    </div>
  )
}
