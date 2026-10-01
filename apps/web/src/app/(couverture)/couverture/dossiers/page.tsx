import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCFA, formatDate, cn } from '@/lib/utils'

type CoverageRequest = {
  id: string
  request_type: string | null
  status: string
  total_amount_fcfa: number | null
  coverage_amount_fcfa: number | null
  patient_amount_fcfa: number | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  needs_info: 'Info requise',
  approved: 'Approuvé',
  refused: 'Refusé',
  cancelled: 'Annulé',
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  needs_info: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  approved: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

const TYPE_LABELS: Record<string, string> = {
  medication: 'Médicament',
  consultation: 'Consultation',
  hospitalization: 'Hospitalisation',
  exam: 'Examen',
  other: 'Autre',
}

export default async function DossiersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('id, name')
    .eq('profile_id', user.id)
    .single()
  const org = orgData as unknown as { id: string; name: string } | null

  if (!org) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Organisme introuvable.</p>
      </div>
    )
  }

  const { data: requestsData } = await supabase
    .from('demandes_couverture')
    .select('id, request_type, status, total_amount_fcfa, coverage_amount_fcfa, patient_amount_fcfa, created_at')
    .eq('coverage_org_id', org.id)
    .order('created_at', { ascending: false })

  const requests = (requestsData ?? []) as unknown as CoverageRequest[]

  const pending = requests.filter(r => ['pending', 'needs_info'].includes(r.status))
  const approved = requests.filter(r => r.status === 'approved')
  const refused = requests.filter(r => ['refused', 'cancelled'].includes(r.status))

  const pendingAmount = pending.reduce((s, r) => s + (r.total_amount_fcfa ?? 0), 0)
  const approvedAmount = approved.reduce((s, r) => s + (r.coverage_amount_fcfa ?? 0), 0)

  function RequestCard({ r }: { r: CoverageRequest }) {
    return (
      <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {r.request_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] font-medium">
                {TYPE_LABELS[r.request_type] ?? r.request_type}
              </span>
            )}
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_CLASSES[r.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]')}>
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>
          <p className="text-xs text-[var(--sw-ink-3)] shrink-0">{formatDate(r.created_at)}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Montant total</p>
            <p className="text-sm font-medium text-[var(--sw-ink)]">{formatCFA(r.total_amount_fcfa ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Prise en charge</p>
            <p className="text-sm font-medium text-[var(--sw-success)]">{formatCFA(r.coverage_amount_fcfa ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Part patient</p>
            <p className="text-sm font-medium text-[var(--sw-ink-2)]">{formatCFA(r.patient_amount_fcfa ?? 0)}</p>
          </div>
        </div>
      </div>
    )
  }

  function Tab({ label, count, amount, amountLabel, items }: {
    label: string
    count: number
    amount?: number
    amountLabel?: string
    items: CoverageRequest[]
  }) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[var(--sw-ink)]">{label}</h2>
            <span className="text-xs bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] px-2 py-0.5 rounded-full">{count}</span>
          </div>
          {amount !== undefined && amountLabel && (
            <span className="text-sm text-[var(--sw-ink-2)]">{amountLabel} : <strong className="text-[var(--sw-ink)]">{formatCFA(amount)}</strong></span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-8 text-center">
            <p className="text-[var(--sw-ink-2)] text-sm">Aucun dossier dans cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(r => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Dossiers</h1>
        <p className="text-[var(--sw-ink-2)] mt-1">{org.name}</p>
      </div>

      <Tab
        label="En attente"
        count={pending.length}
        amount={pendingAmount}
        amountLabel="Montant en attente"
        items={pending}
      />
      <Tab
        label="Approuvés"
        count={approved.length}
        amount={approvedAmount}
        amountLabel="Total pris en charge"
        items={approved}
      />
      <Tab
        label="Refusés / Annulés"
        count={refused.length}
        items={refused}
      />
    </div>
  )
}
