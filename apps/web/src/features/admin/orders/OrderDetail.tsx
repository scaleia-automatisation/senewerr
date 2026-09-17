import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Package, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useJustification } from '@/features/admin/JustificationSheet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-s-4 flex flex-col gap-s-3">
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">{title}</h2>
      {children}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-s-3 text-sm">
      <span className="text-ink-3 min-w-[160px] shrink-0">{label}</span>
      <span className="text-ink text-right flex-1">{value ?? '—'}</span>
    </div>
  )
}

function statusVariant(s?: string): 'success' | 'danger' | 'pending' | 'neutral' {
  if (s === 'completed' || s === 'paid' || s === 'success') return 'success'
  if (s === 'cancelled' || s === 'expired' || s === 'failed') return 'danger'
  if (s === 'pending' || s === 'accepted' || s === 'preparing' || s === 'ready') return 'pending'
  return 'neutral'
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function RelancerModal({
  open, onOpenChange, onConfirm, loading, orderRef, amount, lastReminder,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (message: string, channel: string) => void
  loading?: boolean
  orderRef?: string
  amount?: number
  lastReminder?: string | null
}) {
  const defaultMsg = `La commande ${orderRef ?? ''} attend toujours votre paiement de ${amount?.toLocaleString('fr-FR') ?? ''} FCFA.`
  const [message, setMessage] = useState(defaultMsg)
  const [channel, setChannel] = useState('app_email')

  const reminderTooRecent = lastReminder
    ? Date.now() - new Date(lastReminder).getTime() < 24 * 60 * 60 * 1000
    : false

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Relancer le patient">
      <div className="flex flex-col gap-s-4">
        {reminderTooRecent && (
          <Banner kind="warning">Une relance a déjà été envoyée il y a moins de 24h.</Banner>
        )}
        <Textarea
          label="Message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
        />
        <Select
          label="Canal"
          value={channel}
          onValueChange={setChannel}
          options={[
            { value: 'app_email', label: 'App + Email' },
            { value: 'app', label: 'App uniquement' },
            { value: 'email', label: 'Email uniquement' },
          ]}
        />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!message.trim() || reminderTooRecent || loading}
            loading={loading}
            onClick={() => onConfirm(message, channel)}
          >
            Envoyer la relance
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RemboursementModal({
  open, onOpenChange, onConfirm, loading, maxAmount, isSuperAdmin,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (amount: number, reason: string) => void
  loading?: boolean
  maxAmount: number
  isSuperAdmin: boolean
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const amountNum = parseFloat(amount) || 0
  const requiresSuperAdmin = amountNum > 50000 && !isSuperAdmin

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Rembourser">
      <div className="flex flex-col gap-s-4">
        <div className="flex flex-col gap-s-2">
          <label className="text-small font-medium text-ink-2">Montant (max {maxAmount.toLocaleString('fr-FR')} FCFA)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            max={maxAmount}
            min={0}
            className="h-12 w-full rounded-sm border border-line bg-surface px-s-3 text-body text-ink focus:outline-none focus:border-primary"
            placeholder="Montant en FCFA"
          />
        </div>
        <Textarea label="Motif" value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison du remboursement…" rows={3} />
        {requiresSuperAdmin && (
          <Banner kind="warning">
            Remboursement &gt; 50 000 FCFA — à soumettre au super admin
          </Banner>
        )}
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button
            variant="primary"
            disabled={amountNum <= 0 || amountNum > maxAmount || !reason.trim() || requiresSuperAdmin || loading}
            loading={loading}
            onClick={() => onConfirm(amountNum, reason)}
          >
            Confirmer le remboursement
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function LitigeModal({
  open, onOpenChange, onConfirm, loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (category: string, description: string) => void
  loading?: boolean
}) {
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ouvrir un litige">
      <div className="flex flex-col gap-s-4">
        <Select
          label="Catégorie"
          value={category}
          onValueChange={setCategory}
          options={[
            { value: 'payment_issue', label: 'Problème de paiement' },
            { value: 'delivery_issue', label: 'Problème de retrait' },
            { value: 'prescription_issue', label: 'Problème d\'ordonnance' },
            { value: 'fraud', label: 'Fraude suspectée' },
            { value: 'other', label: 'Autre' },
          ]}
        />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez le litige…" rows={4} />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="danger" disabled={!category || !description.trim() || loading} loading={loading} onClick={() => onConfirm(category, description)}>
            Ouvrir le litige
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function NoteModal({
  open, onOpenChange, onConfirm, loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (note: string) => void
  loading?: boolean
}) {
  const [note, setNote] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Ajouter une note interne">
      <div className="flex flex-col gap-s-4">
        <Textarea label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="Note interne…" rows={4} />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="primary" disabled={!note.trim() || loading} loading={loading} onClick={() => onConfirm(note)}>
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CancelModal({
  open, onOpenChange, onConfirm, loading, title,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (motif: string) => void
  loading?: boolean
  title: string
}) {
  const [motif, setMotif] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <div className="flex flex-col gap-s-4">
        <Textarea label="Motif" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif…" rows={3} />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="danger" disabled={!motif.trim() || loading} loading={loading} onClick={() => onConfirm(motif)}>
            Confirmer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile: adminProfile } = useAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'

  useAdminAudit('commande-detail')

  // Justification hooks for sensitive data
  const prescJustif = useJustification({
    entityType: 'prescription_items',
    entityId: id ?? '',
    action: 'view.prescription.items',
  })
  const codeJustif = useJustification({
    entityType: 'withdrawal_code',
    entityId: id ?? '',
    action: 'view.withdrawal.code',
  })

  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[] | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [lastReminder, setLastReminder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Code retrait visibility
  const [codeVisible, setCodeVisible] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  // Modal states
  const [relancerOpen, setRelancerOpen] = useState(false)
  const [remboursOpen, setRemboursOpen] = useState(false)
  const [litigeOpen, setLitigeOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [forceExpireOpen, setForceExpireOpen] = useState(false)

  const loadOrder = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [orderRes, paysRes, timelineRes, notifRes, notesRes, reminderRes] = await Promise.all([
      (supabase as any)
        .from('pharmacy_reservations')
        .select(`
          *,
          patient:profiles!patient_id(id, full_name, phone, reference),
          beneficiary:profiles!beneficiary_id(full_name, phone),
          pharmacy:organizations!pharmacy_id(name, city, phone, email),
          prescription:prescriptions!prescription_id(reference, prescriber_name),
          mutual:organizations!mutual_id(name),
          coverage:coverage_requests!coverage_request_id(amount, status)
        `)
        .eq('id', id)
        .single(),
      (supabase as any)
        .from('payments')
        .select('id, reference, amount, status, psp, failure_reason, created_at')
        .eq('reservation_id', id)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('reservation_status_history')
        .select('id, status, created_at, actor_id, metadata')
        .eq('reservation_id', id)
        .order('created_at', { ascending: true }),
      (supabase as any)
        .from('notification_deliveries')
        .select('id, channel, status, created_at, template_id')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      (supabase as any)
        .from('admin_notes')
        .select('id, content, created_at, author_id')
        .eq('entity_id', id)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('reminders')
        .select('sent_at')
        .eq('reservation_id', id)
        .order('sent_at', { ascending: false })
        .limit(1),
    ])

    setOrder(orderRes.data)
    setPayments(paysRes.data ?? [])
    setTimeline(timelineRes.data ?? [])
    setNotifications(notifRes.data ?? [])
    setNotes(notesRes.data ?? [])
    setLastReminder(reminderRes.data?.[0]?.sent_at ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => { loadOrder() }, [loadOrder])

  const callEdgeFunction = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setActionLoading(true)
    setActionError(null)
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action, targetId: id, targetType: 'reservation', ...extra },
    })
    if (error) setActionError(error.message)
    else await loadOrder()
    setActionLoading(false)
    return !error
  }, [id, loadOrder])

  const viewItems = useCallback(async () => {
    const cause = await prescJustif.requestJustification()
    if (!cause) return
    const { data } = await (supabase as any)
      .from('reservation_items')
      .select('id, medication_name, quantity, unit_price, total_price')
      .eq('reservation_id', id)
    setItems(data ?? [])
  }, [id, prescJustif])

  const revealCode = useCallback(async () => {
    setCodeLoading(true)
    const cause = await codeJustif.requestJustification()
    setCodeLoading(false)
    if (!cause) return
    setCodeVisible(true)
  }, [codeJustif])

  const addNote = useCallback(async (note: string) => {
    await (supabase as any).from('admin_notes').insert({
      entity_id: id,
      entity_type: 'reservation',
      content: note.trim(),
      author_id: adminProfile?.id,
    })
    await loadOrder()
    setNoteOpen(false)
  }, [id, adminProfile?.id, loadOrder])

  if (loading) {
    return (
      <div className="p-s-4 flex flex-col gap-s-4 max-w-4xl mx-auto">
        {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)}
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-s-4 max-w-4xl mx-auto">
        <Banner kind="warning">Commande introuvable.</Banner>
      </div>
    )
  }

  const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)
  const canCancel = isSuperAdmin || (order.litige_status != null)

  return (
    <div className="flex flex-col gap-s-4 p-s-4 max-w-4xl mx-auto">
      {/* Justification nodes */}
      {prescJustif.JustificationSheetNode}
      {codeJustif.JustificationSheetNode}

      <div className="flex items-center gap-s-3">
        <Link to="/admin/commandes">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>Commandes</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-h2 font-display text-ink">{order.reference ?? id}</h1>
          <p className="text-sm text-ink-3">{fmt(order.created_at)}</p>
        </div>
        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
      </div>

      {actionError && <Banner kind="warning">{actionError}</Banner>}

      {/* Action buttons */}
      <Card className="p-s-4">
        <div className="flex flex-wrap gap-s-2">
          <Button variant="secondary" size="sm" disabled={actionLoading} onClick={() => setRelancerOpen(true)}>
            Relancer
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/admin/paiements?commande=${id}`}>Voir paiement</Link>
          </Button>
          <Button variant="secondary" size="sm" disabled={actionLoading || paidAmount === 0} onClick={() => setRemboursOpen(true)}>
            Rembourser
          </Button>
          <Button variant="secondary" size="sm" disabled={actionLoading} onClick={() => setLitigeOpen(true)}>
            Ouvrir litige
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />} onClick={() => setNoteOpen(true)}>
            Ajouter une note
          </Button>
          {canCancel && (
            <Button variant="danger" size="sm" disabled={actionLoading} onClick={() => setCancelOpen(true)}>
              Annuler la commande
            </Button>
          )}
          <Button variant="danger" size="sm" disabled={actionLoading} onClick={() => setForceExpireOpen(true)}>
            Forcer l'expiration
          </Button>
        </div>
      </Card>

      {/* Section 1 — Patient & Bénéficiaire */}
      <Section title="Patient">
        <Row label="Nom" value={order.patient?.full_name} />
        <Row label="N° patient" value={order.patient?.reference} />
        <Row label="Téléphone" value={order.patient?.phone} />
        {order.beneficiary_id && order.beneficiary_id !== order.patient_id && (
          <>
            <hr className="border-line" />
            <p className="text-xs text-ink-3 uppercase tracking-wide">Bénéficiaire</p>
            <Row label="Nom" value={order.beneficiary?.full_name} />
            <Row label="Téléphone" value={order.beneficiary?.phone} />
          </>
        )}
      </Section>

      {/* Section 2 — Pharmacie */}
      <Section title="Pharmacie">
        <Row label="Nom" value={order.pharmacy?.name} />
        <Row label="Ville" value={order.pharmacy?.city} />
        <Row label="Téléphone" value={order.pharmacy?.phone} />
        <Row label="Email" value={order.pharmacy?.email} />
      </Section>

      {/* Section 3 — Ordonnance */}
      <Section title="Ordonnance">
        <Row label="N° ordonnance" value={order.prescription?.reference} />
        <Row label="Prescripteur" value={order.prescription?.prescriber_name} />
        <div className="mt-s-2">
          {items === null ? (
            <Button variant="secondary" size="sm" leftIcon={<Package className="h-4 w-4" />} onClick={viewItems}>
              Voir les articles (justification requise)
            </Button>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                    <th className="text-left py-s-2 pr-s-3">Médicament</th>
                    <th className="text-right py-s-2 pr-s-3">Qté</th>
                    <th className="text-right py-s-2 pr-s-3">PU</th>
                    <th className="text-right py-s-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="py-s-2 pr-s-3">{it.medication_name}</td>
                      <td className="py-s-2 pr-s-3 text-right">{it.quantity}</td>
                      <td className="py-s-2 pr-s-3 text-right">{it.unit_price?.toLocaleString('fr-FR')} FCFA</td>
                      <td className="py-s-2 text-right">{it.total_price?.toLocaleString('fr-FR')} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Section 4 — Mutuelle & PEC */}
      <Section title="Mutuelle & Prise en charge">
        <Row label="Mutuelle" value={order.mutual?.name} />
        <Row label="Montant PEC" value={order.coverage?.amount != null ? `${order.coverage.amount.toLocaleString('fr-FR')} FCFA` : '—'} />
        <Row label="Statut PEC" value={
          order.coverage?.status
            ? <Badge variant={statusVariant(order.coverage.status)}>{order.coverage.status}</Badge>
            : '—'
        } />
      </Section>

      {/* Section 5 — Montants */}
      <Section title="Montants">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                <th className="text-left py-s-2">Poste</th>
                <th className="text-right py-s-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Total', value: order.total_amount },
                { label: 'Part mutuelle', value: order.mutual_amount },
                { label: 'Part patient', value: order.patient_amount },
                { label: 'Commission', value: order.commission_amount },
              ].map(r => (
                <tr key={r.label} className="border-b border-line last:border-0">
                  <td className="py-s-2 text-ink-2">{r.label}</td>
                  <td className="py-s-2 text-right font-medium">
                    {r.value != null ? `${r.value.toLocaleString('fr-FR')} FCFA` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Section 6 — Paiements */}
      <Section title="Paiements">
        {payments.length === 0 ? (
          <p className="text-sm text-ink-3">Aucun paiement</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                  <th className="text-left py-s-2 pr-s-3">Référence</th>
                  <th className="text-right py-s-2 pr-s-3">Montant</th>
                  <th className="text-left py-s-2 pr-s-3">PSP</th>
                  <th className="text-left py-s-2 pr-s-3">Statut</th>
                  <th className="text-left py-s-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-s-2 pr-s-3 font-mono text-xs">{p.reference ?? p.id}</td>
                    <td className="py-s-2 pr-s-3 text-right">{p.amount?.toLocaleString('fr-FR')} FCFA</td>
                    <td className="py-s-2 pr-s-3 text-ink-2">{p.psp ?? '—'}</td>
                    <td className="py-s-2 pr-s-3">
                      <div>
                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                        {p.failure_reason && (
                          <p className="text-xs text-status-danger mt-s-1">{p.failure_reason}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-s-2 text-ink-3">{fmt(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Section 7 — Code de retrait */}
      <Section title="Code de retrait">
        <div className="flex items-center gap-s-3">
          <span className="font-mono text-lg tracking-widest text-ink">
            {codeVisible ? (order.withdrawal_code ?? '—') : '••••'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            loading={codeLoading}
            leftIcon={codeVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            onClick={codeVisible ? () => setCodeVisible(false) : revealCode}
          >
            {codeVisible ? 'Masquer' : 'Révéler'}
          </Button>
        </div>
        {!codeVisible && (
          <p className="text-xs text-ink-3">Justification requise pour afficher le code</p>
        )}
      </Section>

      {/* Section 8 — Timeline */}
      <Section title="Chronologie">
        {timeline.length === 0 ? (
          <p className="text-sm text-ink-3">Aucun historique</p>
        ) : (
          <ol className="relative border-l border-line ml-s-2">
            {timeline.map((t, i) => (
              <li key={t.id ?? i} className="mb-s-4 ml-s-4">
                <span className="absolute -left-[5px] flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-2 ring-surface" />
                <div className="flex items-start justify-between gap-s-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.status}</p>
                    {t.metadata?.note && <p className="text-xs text-ink-3">{t.metadata.note}</p>}
                  </div>
                  <span className="text-xs text-ink-3 shrink-0">{fmt(t.created_at)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Section 9 — Notifications */}
      <Section title="Notifications envoyées">
        {notifications.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune notification</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                  <th className="text-left py-s-2 pr-s-3">Template</th>
                  <th className="text-left py-s-2 pr-s-3">Canal</th>
                  <th className="text-left py-s-2 pr-s-3">Statut</th>
                  <th className="text-left py-s-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id} className="border-b border-line last:border-0">
                    <td className="py-s-2 pr-s-3 text-ink-2">{n.template_id ?? '—'}</td>
                    <td className="py-s-2 pr-s-3 text-ink-2">{n.channel ?? '—'}</td>
                    <td className="py-s-2 pr-s-3">
                      <Badge variant={n.status === 'delivered' ? 'success' : n.status === 'failed' ? 'danger' : 'neutral'}>
                        {n.status}
                      </Badge>
                    </td>
                    <td className="py-s-2 text-ink-3">{fmt(n.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Section 10 — Notes internes */}
      <Section title="Notes internes">
        {notes.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune note</p>
        ) : (
          <div className="flex flex-col gap-s-2">
            {notes.map(n => (
              <div key={n.id} className="border border-line rounded-md p-s-3 text-sm">
                <p className="text-ink">{n.content}</p>
                <p className="text-ink-3 text-xs mt-s-1">{fmt(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" leftIcon={<MessageSquare className="h-4 w-4" />} onClick={() => setNoteOpen(true)} className="mt-s-2 self-start">
          Ajouter une note
        </Button>
      </Section>

      {/* Modals */}
      <RelancerModal
        open={relancerOpen}
        onOpenChange={setRelancerOpen}
        loading={actionLoading}
        orderRef={order.reference}
        amount={order.patient_amount}
        lastReminder={lastReminder}
        onConfirm={async (message, channel) => {
          const ok = await callEdgeFunction('send_reminder', { message, channel })
          if (ok) setRelancerOpen(false)
        }}
      />

      <RemboursementModal
        open={remboursOpen}
        onOpenChange={setRemboursOpen}
        loading={actionLoading}
        maxAmount={paidAmount}
        isSuperAdmin={isSuperAdmin}
        onConfirm={async (amount, reason) => {
          const ok = await callEdgeFunction('refund', { amount, reason })
          if (ok) setRemboursOpen(false)
        }}
      />

      <LitigeModal
        open={litigeOpen}
        onOpenChange={setLitigeOpen}
        loading={actionLoading}
        onConfirm={async (category, description) => {
          const ok = await callEdgeFunction('open_litige', { category, description })
          if (ok) setLitigeOpen(false)
        }}
      />

      <NoteModal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        loading={actionLoading}
        onConfirm={addNote}
      />

      <CancelModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        loading={actionLoading}
        title="Annuler la commande"
        onConfirm={async motif => {
          const ok = await callEdgeFunction('cancel_order', { motif })
          if (ok) setCancelOpen(false)
        }}
      />

      <CancelModal
        open={forceExpireOpen}
        onOpenChange={setForceExpireOpen}
        loading={actionLoading}
        title="Forcer l'expiration"
        onConfirm={async motif => {
          const ok = await callEdgeFunction('force_expire', { motif })
          if (ok) setForceExpireOpen(false)
        }}
      />
    </div>
  )
}
