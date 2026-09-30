import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Calendar, Stethoscope, FileText, Package, Shield, CreditCard,
  Share2, RefreshCw, UserCheck, CheckCircle2, XCircle, Clock
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Historique des actions — Admin' }

// Spec 20.3 — historique doit permettre de retrouver l'auteur, la date et le résultat
type AuditEntry = {
  id: string; event_type: string; actor_type: string; actor_id: string
  object_type: string; object_id: string; result: string | null
  metadata: Record<string, unknown> | null; correlation_id: string | null
  category: string | null; created_at: string
}

// Spec 20.3 — opérations importants à tracer
const AUDIT_EVENT_LABELS: Record<string, string> = {
  // Rendez-vous
  'appointment.created': 'Création d\'un rendez-vous',
  'appointment.confirmed': 'Confirmation de rendez-vous',
  'appointment.cancelled': 'Annulation de rendez-vous',
  // Ordonnances / documents
  'prescription.created': 'Création d\'ordonnance',
  'prescription.shared': 'Partage de document',
  'prescription.revoked': 'Révocation d\'ordonnance',
  // Réservations
  'reservation.created': 'Création de réservation',
  'reservation.confirmed': 'Confirmation de réservation',
  'reservation.refused': 'Refus de réservation',
  'reservation.collected': 'Retrait confirmé',
  'reservation.cancelled': 'Annulation de réservation',
  'reservation.expired': 'Expiration de réservation',
  // Couverture
  'coverage.approved': 'Couverture accordée',
  'coverage.partial': 'Couverture partielle accordée',
  'coverage.refused': 'Couverture refusée',
  // Paiements
  'payment.confirmed': 'Paiement confirmé',
  'payment.failed': 'Paiement échoué',
  'payment.refunded': 'Remboursement effectué',
  'payment.organisme_received': 'Paiement organisme reçu',
  // Compte
  'account_validated': 'Compte validé',
  // Idempotence
  'system.idempotency_block': 'Doublon bloqué par idempotence',
}

// Spec 20.3 — l'auteur (actor_type)
const ACTOR_LABELS: Record<string, string> = {
  patient: 'Patient', sante: 'Professionnel de santé', etablissement: 'Établissement',
  pharmacie: 'Pharmacie', couverture: 'Organisme de couverture', admin: 'Administrateur', system: 'Système',
}
const ACTOR_CLASSES: Record<string, string> = {
  patient: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  sante: 'bg-purple-50 text-purple-600',
  etablissement: 'bg-blue-50 text-blue-600',
  pharmacie: 'bg-orange-50 text-orange-600',
  couverture: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  admin: 'bg-red-50 text-[var(--sw-danger)]',
  system: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

function AuditIcon({ type, result }: { type: string; result: string | null }) {
  if (result === 'failure') return <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
  if (type.startsWith('appointment')) return <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />
  if (type.startsWith('consultation')) return <Stethoscope className="w-4 h-4 text-purple-600" />
  if (type.startsWith('prescription')) {
    if (type.endsWith('.shared')) return <Share2 className="w-4 h-4 text-orange-600" />
    return <FileText className="w-4 h-4 text-orange-600" />
  }
  if (type.startsWith('reservation')) {
    if (type.endsWith('.collected')) return <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
    if (type.endsWith('.refused') || type.endsWith('.cancelled') || type.endsWith('.expired'))
      return <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
    return <Package className="w-4 h-4 text-[var(--sw-primary)]" />
  }
  if (type.startsWith('coverage')) return <Shield className="w-4 h-4 text-[var(--sw-success)]" />
  if (type.startsWith('payment')) return <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />
  if (type === 'system.idempotency_block') return <RefreshCw className="w-4 h-4 text-[var(--sw-warning)]" />
  if (type.includes('account')) return <UserCheck className="w-4 h-4 text-[var(--sw-primary)]" />
  return <Clock className="w-4 h-4 text-[var(--sw-ink-3)]" />
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const CATEGORY_TABS = [
  { key: '', label: 'Toutes' },
  { key: 'rdv', label: 'Rendez-vous' },
  { key: 'consultations', label: 'Consultations' },
  { key: 'pharmacie', label: 'Pharmacie' },
  { key: 'couverture', label: 'Couverture' },
  { key: 'paiements', label: 'Paiements' },
  { key: 'system', label: 'Système' },
]

export default async function AdminHistoriquePage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string }> }) {
  const { cat, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const PAGE_SIZE = 30

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  type Chain = {
    eq: (c: string, v: string) => Chain
    in: (c: string, v: string[]) => Chain
    neq: (c: string, v: string) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }

  let q = (supabase.from('system_events') as unknown as RawQuery)
    .select('id, event_type, actor_type, actor_id, object_type, object_id, result, metadata, correlation_id, category, created_at', { count: 'exact' })
    .in('event_type', Object.keys(AUDIT_EVENT_LABELS))
    .order('created_at', { ascending: false })

  if (cat) q = q.eq('category', cat)

  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const entries = (data ?? []) as unknown as AuditEntry[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Stats spec 20.3
  const successCount = entries.filter(e => e.result !== 'failure').length
  const failureCount = entries.filter(e => e.result === 'failure').length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Historique des actions</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">
          Spec 20.3 — auteur, date et résultat de chaque opération importante
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-ink)]">{total}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Opérations</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-success)]">{successCount}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Réussies</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-danger)]">{failureCount}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Échouées</p>
        </div>
      </div>

      {/* Filtres catégorie */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {CATEGORY_TABS.map(t => (
          <a key={t.key} href={t.key ? `?cat=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (cat ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Clock className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune opération enregistrée.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {entries.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  <AuditIcon type={e.event_type} result={e.result} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Spec 20.3 : auteur + action + résultat */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[var(--sw-ink)] flex-1">
                      {AUDIT_EVENT_LABELS[e.event_type] ?? e.event_type}
                    </p>
                    {e.result === 'failure' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-[var(--sw-danger)]">Échec</span>
                    )}
                    {e.result === 'pending' && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]">En cours</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--sw-ink-3)]">
                    {/* Auteur (spec 20.3) */}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${ACTOR_CLASSES[e.actor_type] ?? ''}`}>
                      {ACTOR_LABELS[e.actor_type] ?? e.actor_type}
                    </span>
                    {/* Date (spec 20.3) */}
                    <span>{fmtDateTime(e.created_at)}</span>
                    {/* Objet concerné */}
                    <span className="opacity-60 font-mono">
                      {e.object_type}#{e.object_id.slice(-6)}
                    </span>
                    {/* Spec 18.5 — correlation_id pour chaîner les événements d'un parcours */}
                    {e.correlation_id && (
                      <span className="opacity-50 font-mono" title="ID de corrélation">
                        corr#{e.correlation_id.slice(-6)}
                      </span>
                    )}
                  </div>

                  {/* Metadata contextuelle (spec 20.2 : lien avec le dossier) */}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(e.metadata).slice(0, 4).map(([k, v]) => (
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
          <span className="text-xs text-[var(--sw-ink-3)]">Page {page} / {totalPages} · {total} entrées</span>
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
