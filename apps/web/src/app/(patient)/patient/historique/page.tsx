import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Calendar, Stethoscope, FileText, Package, Shield, CreditCard,
  CheckCircle2, XCircle, Clock, AlertCircle, Info
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Historique des événements' }

type SysEvent = {
  id: string; event_type: string; actor_type: string; object_type: string; object_id: string
  result: string | null; metadata: Record<string, unknown> | null; correlation_id: string | null
  category: string | null; created_at: string
}

// Spec 18.2 — événements visibles côté patient
const PATIENT_EVENT_LABELS: Record<string, string> = {
  'appointment.created': 'Rendez-vous pris',
  'appointment.confirmed': 'Rendez-vous confirmé',
  'appointment.cancelled': 'Rendez-vous annulé',
  'appointment.patient_arrived': 'Arrivée enregistrée',
  'appointment.started': 'Consultation démarrée',
  'appointment.completed': 'Consultation terminée',
  'prescription.created': 'Ordonnance disponible',
  'prescription.shared': 'Ordonnance partagée',
  'reservation.created': 'Réservation enregistrée',
  'reservation.confirmed': 'Réservation confirmée par la pharmacie',
  'reservation.funded': 'Couverture et paiement validés',
  'reservation.ready': 'Médicament prêt — venez le retirer',
  'reservation.collected': 'Médicament retiré',
  'reservation.refused': 'Réservation refusée',
  'reservation.cancelled': 'Réservation annulée',
  'reservation.expired': 'Réservation expirée',
  'coverage.approved': 'Couverture accordée',
  'coverage.partial': 'Couverture partielle accordée',
  'coverage.refused': 'Couverture refusée',
  'payment.confirmed': 'Paiement confirmé — reçu disponible',
  'payment.failed': 'Paiement échoué',
}

const OBJECT_HREFS: Record<string, (id: string) => string> = {
  appointment: (id) => `/patient/rendez-vous/${id}`,
  prescription: (id) => `/patient/dossier/ordonnances/${id}`,
  reservation: (id) => `/patient/pharmacie/reservations/${id}`,
  payment: (id) => `/patient/paiements/${id}`,
}

function EventIcon({ type, result }: { type: string; result: string | null }) {
  const ok = result !== 'failure'
  const cls = ok ? 'text-[var(--sw-success)]' : 'text-[var(--sw-danger)]'
  if (type.startsWith('appointment')) return <Calendar className={`w-4 h-4 ${cls}`} />
  if (type.startsWith('consultation')) return <Stethoscope className={`w-4 h-4 ${cls}`} />
  if (type.startsWith('prescription')) return <FileText className={`w-4 h-4 ${cls}`} />
  if (type.startsWith('reservation')) {
    if (type.endsWith('.refused') || type.endsWith('.cancelled') || type.endsWith('.expired'))
      return <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
    if (type.endsWith('.ready') || type.endsWith('.collected'))
      return <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
    return <Package className={`w-4 h-4 ${cls}`} />
  }
  if (type.startsWith('coverage')) return <Shield className={`w-4 h-4 ${cls}`} />
  if (type.startsWith('payment')) return <CreditCard className={`w-4 h-4 ${cls}`} />
  return <Info className="w-4 h-4 text-[var(--sw-ink-3)]" />
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result || result === 'success') return null
  if (result === 'pending')
    return <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]">En cours</span>
  if (result === 'failure')
    return <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-[var(--sw-danger)]">Échec</span>
  return null
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

function groupByDate(events: SysEvent[]): { dateLabel: string; events: SysEvent[] }[] {
  const groups: Record<string, SysEvent[]> = {}
  events.forEach(e => {
    const d = new Date(e.created_at)
    const key = d.toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })
  return Object.entries(groups).map(([dateLabel, events]) => ({ dateLabel, events }))
}

const CATEGORY_FILTERS = [
  { key: '', label: 'Tout' },
  { key: 'rdv', label: 'Rendez-vous' },
  { key: 'consultations', label: 'Consultations' },
  { key: 'pharmacie', label: 'Pharmacie' },
  { key: 'couverture', label: 'Couverture' },
  { key: 'paiements', label: 'Paiements' },
]

export default async function PatientHistoriquePage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string }> }) {
  const { cat, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const pageSize = 30

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  // Spec 18.2 — patient sees events where they are the actor
  type EventQuery = {
    select: (q: string) => {
      eq: (c: string, v: string) => EventQuery
      eq2?: never
      in: (c: string, v: string[]) => EventQuery
      order: (c: string, o: { ascending: boolean }) => EventQuery
      range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
    }
  }

  // Build query using stale-types cast
  type Chain = {
    eq: (c: string, v: string) => Chain
    in: (c: string, v: string[]) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }

  let q = (supabase.from('evenements_systeme') as unknown as RawQuery)
    .select('id, event_type, actor_type, object_type, object_id, result, metadata, correlation_id, category, created_at', { count: 'exact' })
    .eq('actor_id', patient.id)
    .in('event_type', Object.keys(PATIENT_EVENT_LABELS))
    .order('created_at', { ascending: false })

  if (cat) q = q.eq('category', cat)

  const { data, count } = await q.range((page - 1) * pageSize, page * pageSize - 1)

  const events = (data ?? []) as unknown as SysEvent[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / pageSize)
  const grouped = groupByDate(events)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Historique</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Toutes vos activités sur Séné Wérr</p>
      </div>

      {/* Filtres catégories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {CATEGORY_FILTERS.map(f => (
          <a key={f.key} href={f.key ? `?cat=${f.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(f.key === (cat ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {f.label}
          </a>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Clock className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun événement enregistré.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <section key={group.dateLabel}>
              <h2 className="text-xs font-semibold text-[var(--sw-ink-3)] capitalize mb-2">{group.dateLabel}</h2>
              <div className="sw-card overflow-hidden">
                <div className="divide-y divide-[var(--sw-line)]">
                  {group.events.map(e => {
                    const label = PATIENT_EVENT_LABELS[e.event_type] ?? e.event_type
                    const href = OBJECT_HREFS[e.object_type]?.(e.object_id) ?? null
                    const content = (
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                          <EventIcon type={e.event_type} result={e.result} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-[var(--sw-ink)]">{label}</p>
                            <ResultBadge result={e.result} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--sw-ink-3)] flex-wrap">
                            <span>{fmtDate(e.created_at)}</span>
                            {e.correlation_id && (
                              <span className="font-mono text-[var(--sw-ink-3)] opacity-60">#{e.correlation_id.slice(-6)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                    return href ? (
                      <Link key={e.id} href={href} className="block hover:bg-[var(--sw-surface-2)] transition-colors">{content}</Link>
                    ) : (
                      <div key={e.id}>{content}</div>
                    )
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--sw-ink-3)]">Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?${cat ? `cat=${cat}&` : ''}page=${page - 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)]">← Précédent</a>
            )}
            {page < totalPages && (
              <a href={`?${cat ? `cat=${cat}&` : ''}page=${page + 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-primary)] text-white">Suivant →</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
