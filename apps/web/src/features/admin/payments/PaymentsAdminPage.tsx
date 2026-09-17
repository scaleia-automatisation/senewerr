import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Banner } from '@/components/ui/Banner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const fmtAmount = (n: number) =>
  n.toLocaleString('fr-FR') + ' FCFA'

type PayStatus = 'pending' | 'paid' | 'failed' | 'refunded' | string

function payStatusBadge(s: PayStatus): 'success' | 'pending' | 'danger' | 'neutral' {
  if (s === 'paid') return 'success'
  if (s === 'pending') return 'pending'
  if (s === 'failed') return 'danger'
  if (s === 'refunded') return 'neutral'
  return 'neutral'
}

interface Payment {
  id: string
  payment_number?: string
  amount: number
  status: PayStatus
  psp?: string
  payment_method?: string
  failure_reason?: string
  created_at: string
  last_reminder_at?: string
  patient?: { full_name?: string }
  reservation?: { reservation_code?: string }
}

// ─────────────────────────────────────────────
// Relancer modal
// ─────────────────────────────────────────────
function RelancerModal({ payment, open, onClose }: { payment: Payment | null; open: boolean; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState('sms')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const tooSoon = payment?.last_reminder_at
    ? Date.now() - new Date(payment.last_reminder_at).getTime() < 86400000
    : false

  const send = useCallback(async () => {
    if (!payment) return
    setLoading(true)
    setError('')
    try {
      await (supabase as any).from('reminders').insert({
        payment_id: payment.id,
        channel,
        message,
        sent_at: new Date().toISOString(),
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [payment, channel, message])

  useEffect(() => {
    if (!open) { setSuccess(false); setError(''); setMessage(''); setChannel('sms') }
  }, [open])

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose() }} title="Relancer le patient" size="md">
      {success
        ? <Banner kind="info">Relance envoyée.</Banner>
        : tooSoon
          ? <Banner kind="warning">Une relance a déjà été envoyée il y a moins de 24h.</Banner>
          : (
            <div className="flex flex-col gap-s-4">
              <Select label="Canal" value={channel} onValueChange={setChannel}
                options={[{ value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }, { value: 'push', label: 'Push' }]} />
              <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder="Votre paiement de … est en attente…" />
              {error && <p className="text-sm text-status-danger">{error}</p>}
              <div className="flex justify-end gap-s-2">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" loading={loading} onClick={send} disabled={!message.trim()}>Envoyer</Button>
              </div>
            </div>
          )
      }
    </Modal>
  )
}

// ─────────────────────────────────────────────
// Rembourser modal
// ─────────────────────────────────────────────
function RembourserModal({ payment, open, onClose }: { payment: Payment | null; open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const isSuperAdmin = (profile as any)?.role === 'super_admin'
  const needsEscalation = Number(amount) > 50000 && !isSuperAdmin

  const refund = useCallback(async () => {
    if (!payment) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'refund_payment', payment_id: payment.id, amount: Number(amount), reason },
      })
      if (err) throw err
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [payment, amount, reason])

  useEffect(() => {
    if (!open) { setSuccess(false); setError(''); setAmount(''); setReason('') }
  }, [open])

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose() }} title="Rembourser" size="md">
      {success
        ? <Banner kind="info">Remboursement initié.</Banner>
        : (
          <div className="flex flex-col gap-s-4">
            <Input label="Montant (FCFA)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={payment ? String(payment.amount) : ''} />
            <Textarea label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            {needsEscalation && (
              <Banner kind="warning">Remboursement {'>'} 50 000 FCFA : seul un super-admin peut valider. Escaladez au support.</Banner>
            )}
            {error && <p className="text-sm text-status-danger">{error}</p>}
            <div className="flex justify-end gap-s-2">
              <Button variant="secondary" onClick={onClose}>Annuler</Button>
              <Button variant="primary" loading={loading} onClick={refund}
                disabled={!amount || !reason || needsEscalation}>
                Rembourser
              </Button>
            </div>
          </div>
        )
      }
    </Modal>
  )
}

// ─────────────────────────────────────────────
// Patients sub-tab
// ─────────────────────────────────────────────
const PAT_SUBTABS = [
  { value: 'all', label: 'Tous' },
  { value: 'paid', label: 'Reçus' },
  { value: 'pending', label: 'En attente' },
  { value: 'failed', label: 'Échoués' },
  { value: 'retry', label: 'À relancer' },
  { value: 'refunded', label: 'Remboursés' },
]

function PatientsTab() {
  const [subTab, setSubTab] = useState('all')
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [relancerTarget, setRelancerTarget] = useState<Payment | null>(null)
  const [rembourserTarget, setRembourserTarget] = useState<Payment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('payments')
      .select(`id, payment_number, amount, status, psp, payment_method, failure_reason, created_at, last_reminder_at,
               patient:profiles!payments_patient_id_fkey(full_name),
               reservation:pharmacy_reservations(reservation_code)`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (subTab !== 'all' && subTab !== 'retry') q = q.eq('status', subTab)
    if (subTab === 'retry') {
      const cutoff = new Date(Date.now() - 86400000).toISOString()
      q = q.eq('status', 'pending').lt('created_at', cutoff)
    }
    const { data } = await q
    setPayments(data ?? [])
    setLoading(false)
  }, [subTab])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-s-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          {PAT_SUBTABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['N° Pmt', 'Commande', 'Patient', 'Montant', 'Moyen', 'Statut', 'Cause d\'échec', 'Date', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(9).fill(0).map((__, j) => (
                  <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                ))}</tr>
              ))
              : payments.length === 0
                ? <tr><td colSpan={9} className="px-s-3 py-s-6 text-center text-ink-3">Aucun paiement</td></tr>
                : payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{p.payment_number ?? p.id.slice(0, 8)}</td>
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{p.reservation?.reservation_code ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{p.patient?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 font-semibold">{fmtAmount(p.amount)}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{p.payment_method ?? p.psp ?? '—'}</td>
                    <td className="px-s-3 py-s-3"><Badge variant={payStatusBadge(p.status)}>{p.status}</Badge></td>
                    <td className="px-s-3 py-s-3 text-ink-2 max-w-32 truncate">{p.failure_reason ?? '—'}</td>
                    <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(p.created_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <div className="flex gap-s-1">
                        <Button variant="ghost" size="sm" onClick={() => setRelancerTarget(p)}>Relancer</Button>
                        <Button variant="ghost" size="sm" onClick={() => setRembourserTarget(p)}>Rembourser</Button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <RelancerModal payment={relancerTarget} open={!!relancerTarget} onClose={() => setRelancerTarget(null)} />
      <RembourserModal payment={rembourserTarget} open={!!rembourserTarget} onClose={() => setRembourserTarget(null)} />
    </div>
  )
}

// ─────────────────────────────────────────────
// Mutuelles sub-tab
// ─────────────────────────────────────────────
const MUT_SUBTABS = [
  { value: 'all', label: 'Tous' },
  { value: 'paid', label: 'Reçus' },
  { value: 'pending', label: 'En attente' },
  { value: 'overdue', label: 'En retard' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'refunded', label: 'Remboursés' },
]

interface MutualPayment {
  id: string
  amount: number
  status: string
  due_date?: string
  created_at: string
  patient?: { full_name?: string }
  mutual?: { name?: string }
  reservation?: { reservation_code?: string }
}

function RapproModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const [ref, setRef] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const isSuperAdmin = (profile as any)?.role === 'super_admin'
  const isAdmin = (profile as any)?.role === 'admin'
  const canDo = isSuperAdmin || (isAdmin && Number(amount) <= 500000)

  const execute = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await (supabase as any).from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'manual_reconciliation',
        metadata: { reference: ref, amount: Number(amount) },
      })
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [ref, amount, profile?.id])

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose() }} title="Rapprochement manuel" size="md">
      {success
        ? <Banner kind="info">Rapprochement enregistré.</Banner>
        : (
          <div className="flex flex-col gap-s-4">
            <Input label="Référence" value={ref} onChange={(e) => setRef(e.target.value)} />
            <Input label="Montant (FCFA)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {!canDo && amount && (
              <Banner kind="warning">Montant {'>'} 500 000 FCFA : droits insuffisants.</Banner>
            )}
            {error && <p className="text-sm text-status-danger">{error}</p>}
            <div className="flex justify-end gap-s-2">
              <Button variant="secondary" onClick={onClose}>Annuler</Button>
              <Button variant="primary" loading={loading} onClick={execute} disabled={!ref || !amount || !canDo}>
                Valider
              </Button>
            </div>
          </div>
        )
      }
    </Modal>
  )
}

function MutuellesTab() {
  const [subTab, setSubTab] = useState('all')
  const [payments, setPayments] = useState<MutualPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [rapproOpen, setRapproOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('coverage_requests')
      .select(`id, amount, status, due_date, created_at,
               patient:profiles!coverage_requests_patient_id_fkey(full_name),
               mutual:organizations(name),
               reservation:pharmacy_reservations(reservation_code)`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (subTab !== 'all') q = q.eq('status', subTab)
    const { data } = await q
    setPayments(data ?? [])
    setLoading(false)
  }, [subTab])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <Tabs value={subTab} onValueChange={setSubTab}>
          <TabsList>
            {MUT_SUBTABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Button variant="secondary" size="sm" onClick={() => setRapproOpen(true)}>Rapprocher</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Commande', 'Patient', 'Mutuelle', 'Montant', 'Statut', 'Échéance', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(7).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : payments.length === 0
                ? <tr><td colSpan={7} className="px-s-3 py-s-6 text-center text-ink-3">Aucun paiement mutuelle</td></tr>
                : payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{p.reservation?.reservation_code ?? p.id.slice(0, 8)}</td>
                    <td className="px-s-3 py-s-3">{p.patient?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{p.mutual?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 font-semibold">{fmtAmount(p.amount)}</td>
                    <td className="px-s-3 py-s-3"><Badge variant={payStatusBadge(p.status)}>{p.status}</Badge></td>
                    <td className="px-s-3 py-s-3 text-ink-2">{p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-s-3 py-s-3"><Button variant="ghost" size="sm">Relancer</Button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <RapproModal open={rapproOpen} onClose={() => setRapproOpen(false)} />
    </div>
  )
}

// ─────────────────────────────────────────────
// Abonnements sub-tab
// ─────────────────────────────────────────────
interface Subscription {
  id: string
  status: string
  plan?: string
  current_period_end?: string
  unpaid_count?: number
  stripe_subscription_id?: string
  actor?: { full_name?: string }
}

function AbonnementsTab() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(supabase as any)
      .from('subscriptions')
      .select(`id, status, plan, current_period_end, unpaid_count, stripe_subscription_id,
               actor:profiles(full_name)`)
      .order('current_period_end', { ascending: true })
      .limit(100)
      .then(({ data }: any) => { setSubs(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line">
          <tr>
            {['Acteur', 'Plan', 'Statut', 'Prochaine facture', 'Impayés', 'Stripe'].map((h) => (
              <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(6).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
            ))
            : subs.length === 0
              ? <tr><td colSpan={6} className="px-s-3 py-s-6 text-center text-ink-3">Aucun abonnement</td></tr>
              : subs.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-s-3 py-s-3">{s.actor?.full_name ?? s.id.slice(0, 8)}</td>
                  <td className="px-s-3 py-s-3 text-ink-2">{s.plan ?? '—'}</td>
                  <td className="px-s-3 py-s-3"><Badge variant={payStatusBadge(s.status)}>{s.status}</Badge></td>
                  <td className="px-s-3 py-s-3 text-ink-2">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-s-3 py-s-3">{s.unpaid_count ?? 0}</td>
                  <td className="px-s-3 py-s-3">
                    {s.stripe_subscription_id
                      ? <a href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">Voir Stripe ↗</a>
                      : '—'}
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Reversements sub-tab
// ─────────────────────────────────────────────
interface Reversement {
  id: string
  pharmacy_id?: string
  period?: string
  commission_amount?: number
  net_amount?: number
  status: string
  reference?: string
  pharmacy?: { name?: string }
}

function ReversementsTab() {
  const { profile } = useAuth()
  const [revs, setRevs] = useState<Reversement[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<Reversement | null>(null)
  const [refInput, setRefInput] = useState('')
  const [marking, setMarking] = useState(false)
  const [success, setSuccess] = useState('')

  const isSuperAdmin = (profile as any)?.role === 'super_admin'

  useEffect(() => {
    ;(supabase as any)
      .from('reversements')
      .select(`id, pharmacy_id, period, commission_amount, net_amount, status, reference,
               pharmacy:organizations(name)`)
      .order('period', { ascending: false })
      .limit(100)
      .then(({ data }: any) => { setRevs(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const markPaid = useCallback(async () => {
    if (!target || !refInput.trim()) return
    setMarking(true)
    try {
      await (supabase as any)
        .from('reversements')
        .update({ status: 'reversed', reference: refInput })
        .eq('id', target.id)
      setRevs((prev) => prev.map((r) => r.id === target.id ? { ...r, status: 'reversed', reference: refInput } : r))
      setSuccess(target.id)
      setTarget(null)
    } finally {
      setMarking(false)
    }
  }, [target, refInput])

  return (
    <div className="flex flex-col gap-s-4">
      {success && <Banner kind="info">Reversement marqué comme effectué.</Banner>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Pharmacie', 'Période', 'Commission', 'Net', 'Statut', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : revs.length === 0
                ? <tr><td colSpan={6} className="px-s-3 py-s-6 text-center text-ink-3">Aucun reversement</td></tr>
                : revs.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3">{r.pharmacy?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{r.period ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{r.commission_amount != null ? fmtAmount(r.commission_amount) : '—'}</td>
                    <td className="px-s-3 py-s-3 font-semibold">{r.net_amount != null ? fmtAmount(r.net_amount) : '—'}</td>
                    <td className="px-s-3 py-s-3"><Badge variant={r.status === 'reversed' ? 'success' : 'pending'}>{r.status}</Badge></td>
                    <td className="px-s-3 py-s-3">
                      {isSuperAdmin && r.status !== 'reversed' && (
                        <Button variant="ghost" size="sm" onClick={() => { setTarget(r); setRefInput('') }}>
                          Marquer reversé
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <Modal open={!!target} onOpenChange={(v) => { if (!v) setTarget(null) }} title="Confirmer le reversement" size="md">
        <div className="flex flex-col gap-s-4">
          <Input label="Référence (obligatoire)" value={refInput} onChange={(e) => setRefInput(e.target.value)} />
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" onClick={() => setTarget(null)}>Annuler</Button>
            <Button variant="primary" loading={marking} onClick={markPaid} disabled={!refInput.trim()}>Confirmer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function PaymentsAdminPage() {
  useAdminAudit('paiements')
  const [mainTab, setMainTab] = useState('patients')

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Paiements</h1>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="mutuelles">Mutuelles</TabsTrigger>
          <TabsTrigger value="abonnements">Abonnements</TabsTrigger>
          <TabsTrigger value="reversements">Reversements</TabsTrigger>
        </TabsList>

        <TabsContent value="patients"><PatientsTab /></TabsContent>
        <TabsContent value="mutuelles"><MutuellesTab /></TabsContent>
        <TabsContent value="abonnements"><AbonnementsTab /></TabsContent>
        <TabsContent value="reversements"><ReversementsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
