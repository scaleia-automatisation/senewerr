import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { Banner } from '@/components/ui/Banner'

const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

type DisputeStatus = 'open' | 'assigned' | 'resolved' | 'rejected' | string

function statusBadge(s: DisputeStatus): 'danger' | 'pending' | 'success' | 'neutral' {
  if (s === 'open') return 'danger'
  if (s === 'assigned') return 'pending'
  if (s === 'resolved') return 'success'
  return 'neutral'
}

interface Dispute {
  id: string
  status: DisputeStatus
  category?: string
  description?: string
  assigned_to?: string
  reservation_id?: string
  appointment_id?: string
  created_at: string
  patient?: { full_name?: string }
  pharmacy?: { name?: string }
  assignee?: { full_name?: string }
}

interface DisputeMessage {
  id: string
  content: string
  created_at: string
  author?: { full_name?: string }
}

interface AdminUser {
  id: string
  full_name?: string
}

interface DetailProps {
  dispute: Dispute
  onClose: () => void
  onUpdated: () => void
}

function DisputeDetail({ dispute, onClose, onUpdated }: DetailProps) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [assignTo, setAssignTo] = useState(dispute.assigned_to ?? '')
  const [replyText, setReplyText] = useState('')
  const [resolveText, setResolveText] = useState('')
  const [resolveAction, setResolveAction] = useState('none')
  const [rejectMotif, setRejectMotif] = useState('')
  const [view, setView] = useState<'main' | 'reply' | 'resolve' | 'reject'>('main')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Load messages
    ;(supabase as any)
      .from('dispute_messages')
      .select('id, content, created_at, author:profiles(full_name)')
      .eq('dispute_id', dispute.id)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => setMessages(data ?? []))
      .catch(() => {})

    // Load admin users for assign
    ;(supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'super_admin'])
      .limit(50)
      .then(({ data }: any) => setAdmins(data ?? []))
      .catch(() => {})
  }, [dispute.id])

  const assign = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await (supabase as any).from('disputes').update({ assigned_to: assignTo, status: 'assigned' }).eq('id', dispute.id)
      setSuccess('Assigné.')
      onUpdated()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dispute.id, assignTo, onUpdated])

  const reply = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await (supabase as any).from('dispute_messages').insert({
        dispute_id: dispute.id,
        author_id: profile?.id,
        content: replyText,
      })
      setMessages((prev) => [...prev, { id: Date.now().toString(), content: replyText, created_at: new Date().toISOString(), author: { full_name: 'Vous' } }])
      setReplyText('')
      setView('main')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dispute.id, profile?.id, replyText])

  const resolve = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { error: err } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'resolve_dispute', dispute_id: dispute.id, resolution: resolveText, action_type: resolveAction },
      })
      if (err) throw err
      setSuccess('Litige résolu.')
      onUpdated()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dispute.id, resolveText, resolveAction, onUpdated])

  const reject = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { error: err } = await (supabase as any).functions.invoke('admin-action', {
        body: { action: 'reject_dispute', dispute_id: dispute.id, motif: rejectMotif },
      })
      if (err) throw err
      setSuccess('Litige rejeté.')
      onUpdated()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [dispute.id, rejectMotif, onUpdated])

  return (
    <div className="flex flex-col gap-s-4">
      {success && <Banner kind="info">{success}</Banner>}
      {error && <Banner kind="warning">{error}</Banner>}

      <div className="grid grid-cols-2 gap-s-3 text-sm">
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Statut</p>
          <Badge variant={statusBadge(dispute.status)}>{dispute.status}</Badge>
        </div>
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Catégorie</p>
          <p className="text-ink">{dispute.category ?? '—'}</p>
        </div>
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Patient</p>
          <p className="text-ink">{dispute.patient?.full_name ?? '—'}</p>
        </div>
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Pharmacie</p>
          <p className="text-ink">{dispute.pharmacy?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Assigné à</p>
          <p className="text-ink">{dispute.assignee?.full_name ?? '—'}</p>
        </div>
        <div>
          <p className="text-ink-3 text-xs mb-s-1">Date</p>
          <p className="text-ink">{fmt(dispute.created_at)}</p>
        </div>
        {dispute.description && (
          <div className="col-span-2">
            <p className="text-ink-3 text-xs mb-s-1">Description</p>
            <p className="text-ink bg-surface-2 rounded p-s-2">{dispute.description}</p>
          </div>
        )}
        {(dispute.reservation_id || dispute.appointment_id) && (
          <div className="col-span-2 text-xs text-ink-3">
            {dispute.reservation_id && <span>Réservation: {dispute.reservation_id.slice(0, 8)} </span>}
            {dispute.appointment_id && <span>RDV: {dispute.appointment_id.slice(0, 8)}</span>}
          </div>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-s-2">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">Messages</p>
          {messages.map((m) => (
            <div key={m.id} className="bg-surface-2 rounded p-s-2 text-sm">
              <div className="flex justify-between mb-s-1">
                <span className="font-medium text-ink">{m.author?.full_name ?? 'Inconnu'}</span>
                <span className="text-xs text-ink-3">{fmt(m.created_at)}</span>
              </div>
              <p className="text-ink-2">{m.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Views */}
      {view === 'main' && (
        <div className="flex flex-wrap gap-s-2 pt-s-2 border-t border-line">
          <Select
            value={assignTo}
            onValueChange={setAssignTo}
            placeholder="Assigner à…"
            options={admins.map((a) => ({ value: a.id, label: a.full_name ?? a.id.slice(0, 8) }))}
            className="flex-1 min-w-40"
          />
          <Button variant="secondary" size="sm" loading={loading} onClick={assign} disabled={!assignTo}>Assigner</Button>
          <Button variant="secondary" size="sm" onClick={() => setView('reply')}>Répondre</Button>
          <Button variant="primary" size="sm" onClick={() => setView('resolve')} disabled={['resolved', 'rejected'].includes(dispute.status)}>Résoudre</Button>
          <Button variant="danger" size="sm" onClick={() => setView('reject')} disabled={['resolved', 'rejected'].includes(dispute.status)}>Rejeter</Button>
        </div>
      )}

      {view === 'reply' && (
        <div className="flex flex-col gap-s-3 border-t border-line pt-s-3">
          <Textarea label="Message" value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} />
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" size="sm" onClick={() => setView('main')}>Annuler</Button>
            <Button variant="primary" size="sm" loading={loading} onClick={reply} disabled={!replyText.trim()}>Envoyer</Button>
          </div>
        </div>
      )}

      {view === 'resolve' && (
        <div className="flex flex-col gap-s-3 border-t border-line pt-s-3">
          <Textarea label="Résolution" value={resolveText} onChange={(e) => setResolveText(e.target.value)} rows={3} />
          <Select
            label="Action"
            value={resolveAction}
            onValueChange={setResolveAction}
            options={[
              { value: 'none', label: 'Aucune' },
              { value: 'refund', label: 'Remboursement' },
              { value: 'cancel', label: 'Annulation' },
            ]}
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" size="sm" onClick={() => setView('main')}>Annuler</Button>
            <Button variant="primary" size="sm" loading={loading} onClick={resolve} disabled={!resolveText.trim()}>Résoudre</Button>
          </div>
        </div>
      )}

      {view === 'reject' && (
        <div className="flex flex-col gap-s-3 border-t border-line pt-s-3">
          <Textarea label="Motif de rejet" value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} />
          <div className="flex justify-end gap-s-2">
            <Button variant="secondary" size="sm" onClick={() => setView('main')}>Annuler</Button>
            <Button variant="danger" size="sm" loading={loading} onClick={reject} disabled={!rejectMotif.trim()}>Rejeter</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DisputesPage() {
  useAdminAudit('litiges')

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Dispute | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('disputes')
      .select(`id, status, category, description, assigned_to, reservation_id, appointment_id, created_at,
               patient:profiles!disputes_patient_id_fkey(full_name),
               pharmacy:organizations(name),
               assignee:profiles!disputes_assigned_to_fkey(full_name)`)
      .order('created_at', { ascending: false })
      .limit(200)
    setDisputes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Litiges</h1>
        <p className="text-sm text-ink-3">{disputes.length} litige{disputes.length !== 1 ? 's' : ''}</p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['N° LIT', 'Statut', 'Catégorie', 'Patient', 'Pharmacie', 'Assigné à', 'Date', ''].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : disputes.length === 0
                ? <tr><td colSpan={8} className="px-s-3 py-s-6 text-center text-ink-3">Aucun litige</td></tr>
                : disputes.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">LIT-{d.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-s-3 py-s-3"><Badge variant={statusBadge(d.status)}>{d.status}</Badge></td>
                    <td className="px-s-3 py-s-3 text-ink-2">{d.category ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{d.patient?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3">{d.pharmacy?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{d.assignee?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(d.created_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(d)}>Voir</Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null) }}
        title={selected ? `Litige LIT-${selected.id.slice(0, 8).toUpperCase()}` : ''}
        size="xl"
      >
        {selected && (
          <DisputeDetail
            dispute={selected}
            onClose={() => setSelected(null)}
            onUpdated={() => { load(); setSelected(null) }}
          />
        )}
      </Modal>
    </div>
  )
}
