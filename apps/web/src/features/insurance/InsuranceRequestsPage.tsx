import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

const TABS = [
  { id: 'pending', label: 'En attente' },
  { id: 'treated', label: 'Traitées' },
]

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  pending: { label: 'En attente', variant: 'warning' },
  info_requested: { label: 'Info demandée', variant: 'warning' },
  approved: { label: 'Approuvée', variant: 'success' },
  partially_approved: { label: 'Partiellement approuvée', variant: 'info' },
  rejected: { label: 'Rejetée', variant: 'danger' },
}

const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')

export default function InsuranceRequestsPage() {
  useAuth()
  const [activeTab, setActiveTab] = useState('pending')
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [modalType, setModalType] = useState<'partial' | 'refuse' | 'info' | null>(null)
  const [partialAmount, setPartialAmount] = useState('')
  const [refuseReason, setRefuseReason] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const statuses = activeTab === 'pending' ? ['pending', 'info_requested'] : ['approved', 'partially_approved', 'rejected']
    const { data } = await supabase
      .from('coverage_requests')
      .select('*, pharmacy_reservations(reservation_number, total_amount, reservation_items(product_name, quantity, unit_price), pharmacy_id), insurance_members(profile_id, plan_name, ceiling_used, ceiling_total, profiles(first_name, last_name))')
      .in('status', statuses)
      .order('created_at', { ascending: false })
    setRequests(data ?? [])
    setLoading(false)
  }, [activeTab])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const decide = async (action: string, extra: object = {}) => {
    setActionLoading(true)
    await supabase.functions.invoke('decide-coverage', { body: { request_id: selected.id, action, ...extra } })
    setActionLoading(false)
    setModalType(null); setPartialAmount(''); setRefuseReason(''); setInfoMessage('')
    fetchRequests()
  }

  const openModal = (type: typeof modalType, r: any) => { setSelected(r); setModalType(type) }

  return (
    <div className="p-s-5 space-y-s-4">
      <h1 className="text-xl font-semibold text-ink">Demandes de prise en charge</h1>
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="space-y-s-3">
        {loading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)
          : requests.length === 0
            ? <p className="text-center text-ink-3 py-10">Aucune demande</p>
            : requests.map(req => {
                const member = req.insurance_members
                const profile = member?.profiles
                const res = req.pharmacy_reservations
                const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Patient inconnu'
                const st = STATUS_LABELS[req.status]
                return (
                  <Card key={req.id} className="p-s-4 space-y-s-3">
                    <div className="flex items-start justify-between gap-s-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-s-2 flex-wrap">
                          <span className="font-semibold text-ink">{name}</span>
                          <Badge>MED-{res?.reservation_number}</Badge>
                        </div>
                        <p className="text-sm text-ink-2 mt-1">
                          {member?.plan_name} · {fmt(member?.ceiling_used)} / {fmt(member?.ceiling_total)} utilisé
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-ink">{fmt(req.requested_amount)}</div>
                        <div className="text-xs text-ink-3">{fmtDate(req.created_at)}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {res?.reservation_items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm text-ink-2">
                          <span>{item.product_name} × {item.quantity}</span>
                          <span>{fmt(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    {activeTab === 'pending' ? (
                      <div className="flex flex-wrap gap-s-2 pt-s-2 border-t border-line">
                        <Button size="sm" variant="primary" onClick={() => decide('approved', { approvedAmount: req.requested_amount })}>Approuver</Button>
                        <Button size="sm" variant="secondary" onClick={() => openModal('partial', req)}>Approbation partielle</Button>
                        <Button size="sm" variant="danger" onClick={() => openModal('refuse', req)}>Refuser</Button>
                        <Button size="sm" variant="ghost" onClick={() => openModal('info', req)}>Demander info</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-s-2 pt-s-2 border-t border-line flex-wrap">
                        {st && <Badge variant={st.variant as any}>{st.label}</Badge>}
                        {req.approved_amount != null && (
                          <span className="text-sm text-ink-2">Montant approuvé : {fmt(req.approved_amount)}</span>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })
        }
      </div>

      <Modal open={modalType === 'partial'} onClose={() => setModalType(null)} title="Approbation partielle">
        <div className="space-y-s-2">
          <label className="text-sm font-medium text-ink-2">Montant approuvé (FCFA)</label>
          <input
            type="number"
            className="w-full border border-line rounded-md p-s-3 text-ink text-sm"
            value={partialAmount}
            max={selected?.requested_amount}
            onChange={e => setPartialAmount(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          <Button
            variant="primary" loading={actionLoading}
            disabled={!partialAmount || Number(partialAmount) <= 0 || Number(partialAmount) > selected?.requested_amount}
            onClick={() => decide('partially_approved', { approvedAmount: Number(partialAmount) })}
          >Confirmer</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'refuse'} onClose={() => setModalType(null)} title="Refuser la demande">
        <div className="space-y-s-2">
          <label className="text-sm font-medium text-ink-2">Raison du refus</label>
          <textarea
            className="w-full border border-line rounded-md p-s-3 text-ink text-sm resize-none h-24"
            value={refuseReason} onChange={e => setRefuseReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          <Button variant="danger" loading={actionLoading} disabled={!refuseReason}
            onClick={() => decide('rejected', { reason: refuseReason })}>Confirmer le refus</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'info'} onClose={() => setModalType(null)} title="Demander des informations">
        <div className="space-y-s-2">
          <label className="text-sm font-medium text-ink-2">Message à envoyer au patient</label>
          <textarea
            className="w-full border border-line rounded-md p-s-3 text-ink text-sm resize-none h-24"
            value={infoMessage} onChange={e => setInfoMessage(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          <Button variant="primary" loading={actionLoading} disabled={!infoMessage}
            onClick={() => decide('info_requested', { message: infoMessage })}>Envoyer la demande</Button>
        </div>
      </Modal>
    </div>
  )
}
