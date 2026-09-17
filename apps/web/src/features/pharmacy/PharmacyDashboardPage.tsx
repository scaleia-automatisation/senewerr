import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Banner } from '@/components/ui/Banner'
import { StatusPill } from '@/components/ui/StatusPill'
import { Skeleton } from '@/components/ui/Skeleton'
import { OTPInput } from '@/components/ui/OTPInput'

const TABS = [
  { id: 'pending', label: 'En attente' },
  { id: 'preparing', label: 'En préparation' },
  { id: 'ready', label: 'Prêtes' },
  { id: 'done', label: 'Terminées' },
]

const REFUSE_REASONS = [
  'Rupture de stock', 'Problème ordonnance', 'Produit indisponible', 'Tarif', 'Autre',
].map(r => ({ label: r, value: r }))

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (h < 1) return `Il y a ${Math.floor((Date.now() - new Date(d).getTime()) / 60000)}min`
  return h < 24 ? `Il y a ${h}h` : `Il y a ${Math.floor(h / 24)}j`
}
const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`
const today = () => new Date().toISOString().split('T')[0]

export default function PharmacyDashboardPage() {
  const { org } = useAuth()
  const orgId = org?.id

  const [activeTab, setActiveTab] = useState('pending')
  const [reservations, setReservations] = useState<any[]>([])
  const [counts, setCounts] = useState({ pending: 0, preparing: 0, ready: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [modalType, setModalType] = useState<'accept' | 'refuse' | 'withdraw' | null>(null)
  const [refuseReason, setRefuseReason] = useState('')
  const [refuseComment, setRefuseComment] = useState('')
  const [withdrawCode, setWithdrawCode] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawAttempts, setWithdrawAttempts] = useState(0)
  const [withdrawLocked, setWithdrawLocked] = useState(false)

  const fetchCounts = useCallback(async () => {
    if (!orgId) return
    const [{ count: p }, { count: pr }, { count: r }, { count: t }] = await Promise.all([
      supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('pharmacy_status', 'pending'),
      supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('preparation_status', 'preparing'),
      supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('preparation_status', 'ready'),
      supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).gte('withdrawn_at', today()),
    ])
    setCounts({ pending: p ?? 0, preparing: pr ?? 0, ready: r ?? 0, today: t ?? 0 })
  }, [orgId])

  const fetchReservations = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    let q = supabase.from('pharmacy_reservations')
      .select('*, reservation_items(*), patients(profiles(first_name, last_name))')
      .eq('pharmacy_id', orgId).order('created_at', { ascending: false })
    if (activeTab === 'pending') q = q.eq('pharmacy_status', 'pending')
    else if (activeTab === 'preparing') q = q.eq('preparation_status', 'preparing')
    else if (activeTab === 'ready') q = q.eq('preparation_status', 'ready')
    else q = q.not('withdrawn_at', 'is', null)
    const { data } = await q
    setReservations(data ?? [])
    setLoading(false)
  }, [orgId, activeTab])

  useEffect(() => { fetchCounts(); fetchReservations() }, [fetchCounts, fetchReservations])

  const openModal = (type: typeof modalType, r: any) => {
    setSelected(r); setModalType(type)
    setWithdrawError(null); setWithdrawLocked(false); setWithdrawAttempts(0); setWithdrawCode('')
  }

  const refresh = () => { fetchReservations(); fetchCounts() }

  const handleAccept = async () => {
    setActionLoading(true)
    await supabase.functions.invoke('confirm-pharmacy-reservation', { body: { reservation_id: selected.id } })
    setActionLoading(false); setModalType(null); refresh()
  }

  const handleRefuse = async () => {
    setActionLoading(true)
    await supabase.functions.invoke('refuse-pharmacy-reservation', { body: { reservation_id: selected.id, reason: refuseReason, comment: refuseComment } })
    setActionLoading(false); setModalType(null); setRefuseReason(''); setRefuseComment(''); refresh()
  }

  const handleWithdraw = async () => {
    setActionLoading(true)
    const { error } = await supabase.functions.invoke('confirm-withdrawal', { body: { reservation_id: selected.id, code: withdrawCode } })
    setActionLoading(false)
    if (!error) { setModalType(null); refresh(); return }
    const msg = (error as any)?.message
    if (msg === 'WITHDRAWAL_LOCKED') { setWithdrawLocked(true) }
    else { const n = withdrawAttempts + 1; setWithdrawAttempts(n); setWithdrawCode(''); setWithdrawError(`Code incorrect (${n}/5)`) }
  }

  const statCards = [
    { label: 'En attente', v: counts.pending, cls: 'text-yellow-700 bg-yellow-100' },
    { label: 'En préparation', v: counts.preparing, cls: 'text-blue-700 bg-blue-100' },
    { label: 'Prêtes', v: counts.ready, cls: 'text-green-700 bg-green-100' },
    { label: "Aujourd'hui", v: counts.today, cls: 'text-ink-2 bg-surface-2' },
  ]

  return (
    <div className="p-s-5 space-y-s-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{org?.name}</h1>
        <p className="text-sm text-ink-3">Tableau de bord</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-s-3">
        {statCards.map(s => (
          <Card key={s.label} className="p-s-4 flex items-center gap-s-3">
            <span className={`text-2xl font-bold px-3 py-1 rounded-md ${s.cls}`}>{s.v}</span>
            <span className="text-ink-2 text-sm">{s.label}</span>
          </Card>
        ))}
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <div className="space-y-s-2">
        {loading
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
          : reservations.length === 0
            ? <p className="text-center text-ink-3 py-10">Aucune réservation</p>
            : reservations.map(r => {
                const p = r.patients?.profiles
                const name = p ? `${p.first_name} ${p.last_name}` : 'Patient inconnu'
                const open = expanded === r.id
                return (
                  <Card key={r.id} className="p-s-4 cursor-pointer" onClick={() => setExpanded(open ? null : r.id)}>
                    <div className="flex items-center justify-between gap-s-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-s-2">
                          <span className="font-medium text-ink">MED-{r.reservation_number}</span>
                          <span className="text-ink-2 text-sm">{name}</span>
                          <span className="text-ink-3 text-sm">{r.reservation_items?.length ?? 0} articles</span>
                          <span className="font-medium text-ink">{fmt(r.total_amount)}</span>
                        </div>
                        <div className="flex items-center gap-s-2">
                          <StatusPill status={r.pharmacy_status} />
                          <span className="text-xs text-ink-3">{timeAgo(r.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-s-2 shrink-0" onClick={e => e.stopPropagation()}>
                        {activeTab === 'pending' && <>
                          <Button size="sm" variant="success" onClick={() => openModal('accept', r)}>Accepter</Button>
                          <Button size="sm" variant="danger" onClick={() => openModal('refuse', r)}>Refuser</Button>
                        </>}
                        {activeTab === 'preparing' && <Button size="sm" onClick={() => openModal('accept', r)}>Marquer prêt</Button>}
                        {activeTab === 'ready' && <Button size="sm" variant="primary" onClick={() => openModal('withdraw', r)}>Confirmer retrait</Button>}
                      </div>
                    </div>
                    {open && (
                      <div className="mt-s-3 pt-s-3 border-t border-line space-y-1">
                        {r.reservation_items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm text-ink-2">
                            <span>{item.product_name} × {item.quantity}</span>
                            <span>{fmt(item.unit_price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })
        }
      </div>

      <Modal open={modalType === 'accept'} onClose={() => setModalType(null)} title="Confirmer l'acceptation">
        <p className="text-ink-2">Accepter la réservation MED-{selected?.reservation_number} ?</p>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          <Button variant="primary" loading={actionLoading} onClick={handleAccept}>Confirmer</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'refuse'} onClose={() => setModalType(null)} title="Refuser la réservation">
        <div className="space-y-s-3">
          <Select label="Raison" value={refuseReason} onChange={setRefuseReason} options={REFUSE_REASONS} />
          <Input label="Commentaire (optionnel)" value={refuseComment} onChange={e => setRefuseComment(e.target.value)} />
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          <Button variant="danger" loading={actionLoading} disabled={!refuseReason} onClick={handleRefuse}>Confirmer le refus</Button>
        </div>
      </Modal>

      <Modal open={modalType === 'withdraw'} onClose={() => setModalType(null)} title="Saisir le code de retrait">
        <div className="space-y-s-3">
          {withdrawLocked
            ? <Banner kind="warning">Trop de tentatives — réessayez plus tard</Banner>
            : <>
                <OTPInput length={4} value={withdrawCode} onChange={setWithdrawCode} />
                {withdrawError && <p className="text-sm text-red-600">{withdrawError}</p>}
              </>
          }
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>
          {!withdrawLocked && (
            <Button variant="primary" loading={actionLoading} disabled={withdrawCode.length < 4} onClick={handleWithdraw}>Confirmer</Button>
          )}
        </div>
      </Modal>
    </div>
  )
}
