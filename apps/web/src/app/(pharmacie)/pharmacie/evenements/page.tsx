import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Package, Shield, CreditCard, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: "Journal d'activité — Pharmacie" }

type SysEvent = {
  id: string; event_type: string; actor_type: string; object_type: string; object_id: string
  result: string | null; metadata: Record<string, unknown> | null; correlation_id: string | null
  category: string | null; created_at: string
}

// Spec 18.2 — événements visibles côté pharmacie
const PHARMACIE_EVENT_LABELS: Record<string, string> = {
  'reservation.created': 'Nouvelle réservation reçue',
  'reservation.verifying': 'Vérification démarrée',
  'reservation.awaiting_coverage': 'En attente de couverture',
  'reservation.awaiting_payment': 'En attente de paiement patient',
  'reservation.funded': 'Financement confirmé',
  'reservation.to_prepare': 'Passée en file de préparation',
  'reservation.preparing': 'Préparation commencée',
  'reservation.ready': 'Prête — patient notifié',
  'reservation.collected': 'Retrait confirmé — commande clôturée',
  'reservation.refused': 'Réservation refusée',
  'reservation.cancelled': 'Réservation annulée',
  'reservation.expired': 'Réservation expirée',
  'coverage.approved': 'Couverture accordée par organisme',
  'coverage.partial': 'Couverture partielle accordée',
  'coverage.refused': 'Couverture refusée',
  'payment.confirmed': 'Paiement patient confirmé',
  'payment.organisme_received': 'Paiement organisme reçu',
  'payment.failed': 'Paiement échoué',
}

const ACTOR_LABELS: Record<string, string> = {
  patient: 'Patient', pharmacie: 'Pharmacie', couverture: 'Organisme',
  sante: 'Professionnel', admin: 'Admin', system: 'Système',
}

function EventIcon({ type, result }: { type: string; result: string | null }) {
  const failed = result === 'failure'
  if (failed) return <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
  if (type.startsWith('reservation')) {
    if (type.endsWith('.collected') || type.endsWith('.ready'))
      return <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
    if (type.endsWith('.refused') || type.endsWith('.cancelled') || type.endsWith('.expired'))
      return <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
    if (type.endsWith('.awaiting_coverage') || type.endsWith('.awaiting_payment'))
      return <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
    return <Package className="w-4 h-4 text-[var(--sw-primary)]" />
  }
  if (type.startsWith('coverage')) return <Shield className="w-4 h-4 text-[var(--sw-primary)]" />
  if (type.startsWith('payment')) return <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />
  return <AlertCircle className="w-4 h-4 text-[var(--sw-ink-3)]" />
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'pharmacie', label: 'Réservations' },
  { key: 'couverture', label: 'Couverture' },
  { key: 'paiements', label: 'Paiements' },
]

export default async function PharmacieEvenementsPage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string }> }) {
  const { cat, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const PAGE_SIZE = 30

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmData as unknown as { id: string } | null
  if (!pharmacy) redirect('/connexion')

  type Chain = {
    eq: (c: string, v: string) => Chain
    in: (c: string, v: string[]) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }

  let q = (supabase.from('system_events') as unknown as RawQuery)
    .select('id, event_type, actor_type, object_type, object_id, result, metadata, correlation_id, category, created_at', { count: 'exact' })
    .eq('actor_id', pharmacy.id)
    .in('event_type', Object.keys(PHARMACIE_EVENT_LABELS))
    .order('created_at', { ascending: false })

  if (cat) q = q.eq('category', cat)

  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const events = (data ?? []) as unknown as SysEvent[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Stats résumées
  const reservationsTotal = events.filter(e => e.event_type.startsWith('reservation')).length
  const paymentsTotal = events.filter(e => e.event_type.startsWith('payment') && e.result === 'success').length
  const coverageTotal = events.filter(e => ['coverage.approved', 'coverage.partial'].includes(e.event_type)).length

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Journal d'activité</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Événements de votre pharmacie (spec 18.2)</p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Réservations', value: reservationsTotal, icon: <Package className="w-4 h-4 text-[var(--sw-primary)]" /> },
          { label: 'Couvertures', value: coverageTotal, icon: <Shield className="w-4 h-4 text-[var(--sw-primary)]" /> },
          { label: 'Paiements', value: paymentsTotal, icon: <CreditCard className="w-4 h-4 text-[var(--sw-success)]" /> },
        ].map(s => (
          <div key={s.label} className="sw-card p-3 flex items-center gap-2">
            {s.icon}
            <div>
              <p className="text-base font-bold text-[var(--sw-ink)]">{s.value}</p>
              <p className="text-xs text-[var(--sw-ink-3)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs catégories */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?cat=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (cat ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      {/* Liste */}
      {events.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Clock className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun événement.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {events.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  <EventIcon type={e.event_type} result={e.result} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">
                    {PHARMACIE_EVENT_LABELS[e.event_type] ?? e.event_type}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--sw-ink-3)] flex-wrap">
                    <span>{fmtDate(e.created_at)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)]">
                      {ACTOR_LABELS[e.actor_type] ?? e.actor_type}
                    </span>
                    {/* Spec 18.5 — correlation_id pour relier les événements d'un même parcours */}
                    {e.correlation_id && (
                      <span className="font-mono opacity-60" title="ID de corrélation">#{e.correlation_id.slice(-6)}</span>
                    )}
                    {e.result === 'failure' && (
                      <span className="text-[var(--sw-danger)]">Échec</span>
                    )}
                  </div>
                  {/* Metadata contextuelle */}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.entries(e.metadata).slice(0, 3).map(([k, v]) => (
                        <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
