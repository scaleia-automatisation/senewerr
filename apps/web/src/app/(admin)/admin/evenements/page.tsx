import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Calendar, Package, Shield, CreditCard, FileText, User, Activity } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Journal des événements' }

// Spec 18.5 : chaque événement a type, acteur, objet, date, résultat, corrélation
const EVENT_LABELS: Record<string, string> = {
  appointment_created: 'Rendez-vous créé',
  appointment_modified: 'Rendez-vous modifié',
  appointment_cancelled: 'Rendez-vous annulé',
  patient_arrived: 'Patient arrivé',
  consultation_started: 'Consultation démarrée',
  consultation_completed: 'Consultation terminée',
  prescription_created: 'Ordonnance créée',
  prescription_shared: 'Ordonnance partagée',
  reservation_created: 'Réservation créée',
  reservation_confirmed: 'Réservation confirmée',
  reservation_ready: 'Réservation prête',
  reservation_collected: 'Retrait confirmé',
  coverage_requested: 'Prise en charge demandée',
  coverage_validated: 'Prise en charge validée',
  coverage_refused: 'Prise en charge refusée',
  payment_received: 'Paiement reçu',
  payment_rejected: 'Paiement rejeté',
  account_validated: 'Compte validé',
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  appointment_created: <Calendar className="w-4 h-4 text-blue-600" />,
  appointment_modified: <Calendar className="w-4 h-4 text-[var(--sw-warning)]" />,
  patient_arrived: <User className="w-4 h-4 text-[var(--sw-primary)]" />,
  consultation_started: <FileText className="w-4 h-4 text-purple-600" />,
  consultation_completed: <FileText className="w-4 h-4 text-[var(--sw-success)]" />,
  prescription_created: <FileText className="w-4 h-4 text-purple-600" />,
  prescription_shared: <FileText className="w-4 h-4 text-[var(--sw-primary)]" />,
  reservation_created: <Package className="w-4 h-4 text-[var(--sw-primary)]" />,
  reservation_ready: <Package className="w-4 h-4 text-[var(--sw-success)]" />,
  reservation_collected: <Package className="w-4 h-4 text-[var(--sw-success)]" />,
  coverage_requested: <Shield className="w-4 h-4 text-blue-600" />,
  coverage_validated: <Shield className="w-4 h-4 text-[var(--sw-success)]" />,
  coverage_refused: <Shield className="w-4 h-4 text-[var(--sw-danger)]" />,
  payment_received: <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />,
  payment_rejected: <CreditCard className="w-4 h-4 text-[var(--sw-danger)]" />,
}

const ACTOR_LABELS: Record<string, string> = {
  patient: 'Patient', professionnel: 'Professionnel', pharmacie: 'Pharmacie',
  couverture: 'Organisme', admin: 'Admin', system: 'Système',
}

const EVENT_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'rdv', label: 'RDV', types: ['appointment_created', 'appointment_modified', 'appointment_cancelled', 'patient_arrived'] },
  { key: 'consultation', label: 'Consultations', types: ['consultation_started', 'consultation_completed', 'prescription_created', 'prescription_shared'] },
  { key: 'pharmacie', label: 'Pharmacie', types: ['reservation_created', 'reservation_confirmed', 'reservation_ready', 'reservation_collected'] },
  { key: 'couverture', label: 'Couverture', types: ['coverage_requested', 'coverage_validated', 'coverage_refused'] },
  { key: 'paiement', label: 'Paiements', types: ['payment_received', 'payment_rejected'] },
]

type Event = {
  id: string; event_type: string; actor_type: string | null; actor_id: string | null
  object_type: string | null; object_id: string | null; result: string | null
  correlation_id: string | null; created_at: string
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function AdminEvenementsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const { filter = 'all', page = '1' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('id, actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { id: string; actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  const pageNum = parseInt(page) || 1
  const pageSize = 30
  const offset = (pageNum - 1) * pageSize

  const activeFilter = EVENT_FILTERS.find(f => f.key === filter) ?? EVENT_FILTERS[0]
  let query = supabase
    .from('system_events')
    .select('id, event_type, actor_type, actor_id, object_type, object_id, result, correlation_id, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (activeFilter.types && activeFilter.types.length > 0) {
    query = query.in('event_type', activeFilter.types)
  }

  const { data } = await query
  const events = (data ?? []) as unknown as Event[]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-[var(--sw-primary)]" />
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Journal des événements</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Audit complet — spec Blocs 18 + 20.3</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {EVENT_FILTERS.map(f => (
          <a key={f.key} href={`?filter=${f.key}`}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${f.key === filter ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)]'}`}>
            {f.label}
          </a>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Activity className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun événement.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {events.map(e => {
              const icon = EVENT_ICONS[e.event_type] ?? <Activity className="w-4 h-4 text-[var(--sw-ink-3)]" />
              return (
                <div key={e.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--sw-surface-2)] transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0 mt-0.5">
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[var(--sw-ink)]">
                        {EVENT_LABELS[e.event_type] ?? e.event_type}
                      </p>
                      {e.actor_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]">
                          {ACTOR_LABELS[e.actor_type] ?? e.actor_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--sw-ink-3)] mt-0.5">
                      <span>{fmtDateTime(e.created_at)}</span>
                      {e.object_type && <span>· {e.object_type}</span>}
                      {e.correlation_id && (
                        <span className="font-mono text-xs text-[var(--sw-ink-3)]" title="Corrélation">
                          corr:{e.correlation_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {e.result && (
                      <p className="text-xs text-[var(--sw-ink-3)] mt-0.5 font-mono truncate">
                        {e.result}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-[var(--sw-ink-2)]">
        {pageNum > 1 && (
          <a href={`?filter=${filter}&page=${pageNum - 1}`}
            className="px-4 py-2 rounded-xl border border-[var(--sw-line)] hover:bg-[var(--sw-surface-2)]">
            ← Précédent
          </a>
        )}
        <span className="text-xs ml-auto">Page {pageNum}</span>
        {events.length === pageSize && (
          <a href={`?filter=${filter}&page=${pageNum + 1}`}
            className="px-4 py-2 rounded-xl border border-[var(--sw-line)] hover:bg-[var(--sw-surface-2)] ml-2">
            Suivant →
          </a>
        )}
      </div>
    </div>
  )
}
