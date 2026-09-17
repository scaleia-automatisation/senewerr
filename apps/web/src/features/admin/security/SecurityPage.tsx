import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'

const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

type Severity = 'critical' | 'high' | 'medium' | 'low' | string

function severityBadge(s: Severity): 'danger' | 'pending' | 'neutral' {
  if (s === 'critical' || s === 'high') return 'danger'
  if (s === 'medium') return 'pending'
  return 'neutral'
}

interface SecurityEvent {
  id: string
  created_at: string
  event_type?: string
  severity?: Severity
  description?: string
  metadata?: Record<string, unknown>
}

interface LockedProfile {
  id: string
  full_name?: string
  email?: string
  lock_reason?: string
  locked_at?: string
}

interface WebhookFailed {
  id: string
  created_at: string
  psp?: string
  event_type?: string
  attempts?: number
  cause?: string
  status?: string
}

interface PaymentEcart {
  id: string
  payment_number?: string
  amount: number
  reservation_total?: number
  status: string
  created_at: string
}

// ─────────────────────────────────────────────
// Security Events
// ─────────────────────────────────────────────
function SecurityEventsSection() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SecurityEvent | null>(null)

  useEffect(() => {
    ;(supabase as any)
      .from('security_events')
      .select('id, created_at, event_type, severity, description, metadata')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }: any) => { setEvents(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Événements sécurité récents</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Date', 'Type', 'Sévérité', 'Description', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : events.length === 0
                ? <tr><td colSpan={5} className="px-s-3 py-s-6 text-center text-ink-3">Aucun événement</td></tr>
                : events.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(e.created_at)}</td>
                    <td className="px-s-3 py-s-3 font-mono text-xs">{e.event_type ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{e.severity ? <Badge variant={severityBadge(e.severity)}>{e.severity}</Badge> : '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 max-w-48 truncate">{e.description ?? '—'}</td>
                    <td className="px-s-3 py-s-3">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(e)}>Voir</Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <Modal open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }} title="Détail événement sécurité" size="lg">
        {detail && (
          <div className="flex flex-col gap-s-3 text-sm">
            <div className="grid grid-cols-2 gap-s-3">
              <div><p className="text-ink-3 text-xs mb-s-1">Date</p><p>{fmt(detail.created_at)}</p></div>
              <div><p className="text-ink-3 text-xs mb-s-1">Type</p><p className="font-mono text-xs">{detail.event_type ?? '—'}</p></div>
              <div><p className="text-ink-3 text-xs mb-s-1">Sévérité</p>{detail.severity ? <Badge variant={severityBadge(detail.severity)}>{detail.severity}</Badge> : '—'}</div>
            </div>
            {detail.description && (
              <div><p className="text-ink-3 text-xs mb-s-1">Description</p><p className="bg-surface-2 rounded p-s-2">{detail.description}</p></div>
            )}
            {detail.metadata && (
              <div>
                <p className="text-ink-3 text-xs mb-s-1">Métadonnées</p>
                <pre className="bg-surface-2 rounded p-s-2 text-xs overflow-auto">{JSON.stringify(detail.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}

// ─────────────────────────────────────────────
// Locked accounts
// ─────────────────────────────────────────────
function LockedAccountsSection() {
  const [profiles, setProfiles] = useState<LockedProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, email, lock_reason, locked_at')
      .not('lock_reason', 'is', null)
      .order('locked_at', { ascending: false })
      .limit(50)
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const unlock = useCallback(async (id: string) => {
    setUnlocking(id)
    setError('')
    try {
      const { error: err } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'unlock_account', profile_id: id },
      })
      if (err) throw err
      setSuccess(`Compte débloqué.`)
      load()
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setUnlocking(null)
    }
  }, [load])

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Comptes verrouillés</h2>
      {success && <Banner kind="info" className="mb-s-3">{success}</Banner>}
      {error && <Banner kind="warning" className="mb-s-3">{error}</Banner>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Utilisateur', 'Email', 'Motif', 'Verrouillé le', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(3).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : profiles.length === 0
                ? <tr><td colSpan={5} className="px-s-3 py-s-6 text-center text-ink-3">Aucun compte verrouillé</td></tr>
                : profiles.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-s-3 py-s-3 font-medium text-ink">{p.full_name ?? p.id.slice(0, 8)}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{p.email ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 max-w-40 truncate">{p.lock_reason ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{p.locked_at ? fmt(p.locked_at) : '—'}</td>
                    <td className="px-s-3 py-s-3">
                      <Button variant="secondary" size="sm" loading={unlocking === p.id} onClick={() => unlock(p.id)}>Débloquer</Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>
    </section>
  )
}

// ─────────────────────────────────────────────
// Webhooks rejetés
// ─────────────────────────────────────────────
function WebhooksSection() {
  const [hooks, setHooks] = useState<WebhookFailed[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(supabase as any)
      .from('webhook_events')
      .select('id, created_at, psp, event_type, attempts, cause, status')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }: any) => { setHooks(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Webhooks rejetés</h2>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['PSP', 'Type', 'Date', 'Tentatives', 'Cause'].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(3).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : hooks.length === 0
                ? <tr><td colSpan={5} className="px-s-3 py-s-6 text-center text-ink-3">Aucun webhook rejeté</td></tr>
                : hooks.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0">
                    <td className="px-s-3 py-s-3 font-mono text-xs">{h.psp ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{h.event_type ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 whitespace-nowrap">{fmt(h.created_at)}</td>
                    <td className="px-s-3 py-s-3 text-center">{h.attempts ?? 1}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 max-w-40 truncate">{h.cause ?? '—'}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>
    </section>
  )
}

// ─────────────────────────────────────────────
// Écarts de rapprochement
// ─────────────────────────────────────────────
function EcartsSection() {
  const [ecarts, setEcarts] = useState<PaymentEcart[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Payments where status=paid but we can check against expected amount
    ;(supabase as any)
      .from('payments')
      .select('id, payment_number, amount, status, created_at, reservation:pharmacy_reservations(total_amount)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }: any) => {
        const mismatches = (data ?? []).filter((p: any) => {
          const resTotal = p.reservation?.total_amount
          return resTotal != null && Math.abs(p.amount - resTotal) > 1
        })
        setEcarts(mismatches.map((p: any) => ({
          id: p.id,
          payment_number: p.payment_number,
          amount: p.amount,
          reservation_total: p.reservation?.total_amount,
          status: p.status,
          created_at: p.created_at,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Écarts de rapprochement</h2>
      {!loading && ecarts.length === 0 && (
        <Banner kind="info">Aucun écart détecté.</Banner>
      )}
      {ecarts.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                {['N° Pmt', 'Montant payé', 'Total réservation', 'Écart', 'Date'].map((h) => (
                  <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(3).fill(0).map((_, i) => (
                  <tr key={i}>{Array(5).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
                : ecarts.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{e.payment_number ?? e.id.slice(0, 8)}</td>
                    <td className="px-s-3 py-s-3">{e.amount.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-s-3 py-s-3">{e.reservation_total != null ? e.reservation_total.toLocaleString('fr-FR') + ' FCFA' : '—'}</td>
                    <td className="px-s-3 py-s-3 text-status-danger font-semibold">
                      {e.reservation_total != null ? `${(e.amount - e.reservation_total).toLocaleString('fr-FR')} FCFA` : '—'}
                    </td>
                    <td className="px-s-3 py-s-3 text-ink-2 whitespace-nowrap">{fmt(e.created_at)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </Card>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function SecurityPage() {
  useAdminAudit('securite')

  return (
    <div className="flex flex-col gap-s-6 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Sécurité</h1>
      </div>

      <SecurityEventsSection />

      <LockedAccountsSection />

      {/* Admin sessions placeholder */}
      <section>
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Sessions admin actives</h2>
        <Card className="p-s-4">
          <p className="text-sm text-ink-3">
            Table <code className="font-mono text-xs bg-surface-2 px-1 py-0.5 rounded">admin_sessions</code> non disponible — fonctionnalité à implémenter.
          </p>
        </Card>
      </section>

      <WebhooksSection />

      <EcartsSection />
    </div>
  )
}
