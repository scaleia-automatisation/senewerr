import { createClient } from '@/lib/supabase/server'
import { Shield, ShieldOff } from 'lucide-react'

const ORG_TYPE_LABELS: Record<string, string> = {
  mutuelle_communautaire:   'Mutuelle communautaire',
  mutuelle_professionnelle: 'Mutuelle professionnelle',
  msae:                     'MSAE',
  ipm:                      'IPM',
  assurance_privee:         'Assurance privée',
}

function fmtDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ActiveCoverage {
  id: string
  member_number: string | null
  start_date: string | null
  end_date: string | null
  organismes_couverture: { name: string; org_type: string | null } | null
}

export async function CouvertureBadge({ patientId }: { patientId: string }) {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from('adherents_couverture')
    .select('id, member_number, start_date, end_date, organismes_couverture(name, org_type)')
    .eq('patient_id', patientId)
    .eq('statut' as never, 'actif')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)

  const coverages = (data ?? []) as unknown as ActiveCoverage[]

  if (coverages.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 w-fit">
        <ShieldOff className="w-3.5 h-3.5 text-[var(--sw-danger)] flex-shrink-0" />
        <span className="text-xs text-[var(--sw-danger)] font-medium">Aucune couverture active</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {coverages.map(c => {
        const org = c.organismes_couverture
        const orgLabel = org?.org_type ? (ORG_TYPE_LABELS[org.org_type] ?? org.org_type) : null
        const dateStart = fmtDate(c.start_date)
        const dateEnd = fmtDate(c.end_date)
        return (
          <div key={c.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--sw-success-bg)] border border-green-100 w-fit max-w-full">
            <Shield className="w-3.5 h-3.5 text-[var(--sw-success)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--sw-success)] truncate">
                {org?.name ?? 'Organisme'}
                {orgLabel && <span className="font-normal text-green-600"> · {orgLabel}</span>}
              </p>
              <p className="text-xs text-green-700">
                {dateStart && <>Du {dateStart}</>}
                {dateEnd && <> au {dateEnd}</>}
                {!dateStart && !dateEnd && 'Contrat en cours'}
                {c.member_number && <span className="ml-2 opacity-70">N° {c.member_number}</span>}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
