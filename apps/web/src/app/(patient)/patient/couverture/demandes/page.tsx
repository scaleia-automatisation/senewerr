import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  COVERAGE_REQUEST_STATUS_LABELS,
  COVERAGE_REQUEST_STATUS_CLASSES,
} from '@/lib/constants/statuses'
import { Shield, AlertTriangle, Clock, CheckCircle2, XCircle, Info } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes demandes de prise en charge' }

type CoverageRequest = {
  id: string
  status: string
  request_type: string | null
  total_amount_fcfa: number | null
  coverage_amount_fcfa: number | null
  patient_amount_fcfa: number | null
  coverage_percent: number | null
  reason: string | null
  created_at: string
  updated_at: string
  coverage_orgs: { name: string } | null
  coverage_plans: { name: string } | null
  prescriptions: { medications: unknown[] | null } | null
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  pharmacy:       'Médicaments',
  consultation:   'Consultation',
  exam:           'Examen',
  hospitalization:'Hospitalisation',
  other:          'Autre',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:    <Clock className="w-4 h-4 text-yellow-600" aria-hidden="true" />,
  needs_info: <Info className="w-4 h-4 text-orange-600" aria-hidden="true" />,
  approved:   <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />,
  refused:    <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />,
  cancelled:  <XCircle className="w-4 h-4 text-gray-400" aria-hidden="true" />,
}

export default async function DemandesCouverturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase
    .from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  // Charger les demandes de prise en charge du patient
  type FetchFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null }>
      }
    }
  }
  const { data: requestsData } = await (supabase.from('coverage_requests') as unknown as FetchFn)
    .select(`
      id, status, request_type,
      total_amount_fcfa, coverage_amount_fcfa, patient_amount_fcfa, coverage_percent,
      reason, created_at, updated_at,
      coverage_orgs(name),
      coverage_plans(name),
      prescriptions(medications)
    `)
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })

  const requests = (requestsData ?? []) as unknown as CoverageRequest[]

  const pending   = requests.filter(r => r.status === 'pending' || r.status === 'needs_info')
  const resolved  = requests.filter(r => r.status === 'approved' || r.status === 'refused' || r.status === 'cancelled')

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Prises en charge</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Demandes transmises à vos organismes de couverture</p>
        </div>
        <Link
          href="/patient/couverture"
          className="text-xs text-[var(--sw-primary)] font-medium hover:underline"
        >
          ← Ma couverture
        </Link>
      </div>

      {requests.length === 0 && (
        <div className="sw-card p-6 text-center space-y-2">
          <Shield className="w-8 h-8 text-[var(--sw-ink-3)] mx-auto" aria-hidden="true" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune demande de prise en charge.</p>
          <p className="text-xs text-[var(--sw-ink-3)]">
            Les demandes sont créées automatiquement lors d'une réservation avec tiers payant.
          </p>
        </div>
      )}

      {/* Demandes en cours */}
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">
            En cours ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(r => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* Demandes traitées */}
      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">
            Traitées ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map(r => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        </section>
      )}

      {/* Info tiers payant */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Pour initier une demande de prise en charge, commencez une réservation de médicaments
          depuis votre ordonnance — la demande est créée automatiquement si vous êtes couvert.
        </p>
      </div>
    </div>
  )
}

function RequestCard({ request }: { request: CoverageRequest }) {
  const statusLabel = COVERAGE_REQUEST_STATUS_LABELS[request.status] ?? request.status
  const statusClass = COVERAGE_REQUEST_STATUS_CLASSES[request.status] ?? 'bg-gray-100 text-gray-600'
  const icon = STATUS_ICONS[request.status]
  const typeLabel = REQUEST_TYPE_LABELS[request.request_type ?? ''] ?? request.request_type ?? '—'

  const createdAt = new Date(request.created_at).toLocaleDateString('fr-SN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="sw-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--sw-ink)] truncate">
              {request.coverage_orgs?.name ?? 'Organisme inconnu'}
            </p>
            <p className="text-xs text-[var(--sw-ink-3)]">
              {request.coverage_plans?.name ?? '—'} · {typeLabel}
            </p>
          </div>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-lg font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Montants */}
      {request.total_amount_fcfa !== null && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-[var(--sw-surface-2)]">
            <p className="text-xs text-[var(--sw-ink-3)]">Total</p>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">
              {request.total_amount_fcfa.toLocaleString('fr-SN')} F
            </p>
          </div>
          <div className="p-2 rounded-lg bg-green-50">
            <p className="text-xs text-green-600">Pris en charge</p>
            <p className="text-sm font-semibold text-green-700">
              {(request.coverage_amount_fcfa ?? 0).toLocaleString('fr-SN')} F
              {request.coverage_percent !== null && (
                <span className="text-xs font-normal ml-1">({request.coverage_percent}%)</span>
              )}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-[var(--sw-warning-bg)]">
            <p className="text-xs text-[var(--sw-warning)]">Reste à charge</p>
            <p className="text-sm font-semibold text-[var(--sw-warning)]">
              {(request.patient_amount_fcfa ?? 0).toLocaleString('fr-SN')} F
            </p>
          </div>
        </div>
      )}

      {/* Complément d'information demandé */}
      {request.status === 'needs_info' && request.reason && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-50">
          <Info className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-orange-700">{request.reason}</p>
        </div>
      )}

      {/* Motif de refus */}
      {request.status === 'refused' && request.reason && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50">
          <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-red-700">{request.reason}</p>
        </div>
      )}

      <p className="text-xs text-[var(--sw-ink-3)]">Soumise le {createdAt}</p>
    </div>
  )
}
