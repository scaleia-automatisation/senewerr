import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Banner } from '@/components/ui/Banner'
import { StatusPill } from '@/components/ui/StatusPill'
import { Skeleton } from '@/components/ui/Skeleton'
import { OTPInput } from '@/components/ui/OTPInput'
import { KpiTile } from '@/components/ui/KpiTile'

const TABS = [
  { id: 'pending', label: 'Nouvelles' },
  { id: 'preparing', label: 'À préparer' },
  { id: 'ready', label: 'Prêtes' },
  { id: 'done', label: 'Complétées' },
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
const thisMonthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

interface Todos {
  prescriptions_to_verify: number
  reservations_to_accept: number
  patient_payments_pending: number
  mutual_payments_pending: number
  orders_to_prepare: number
  orders_ready: number
}

export default function PharmacyDashboard() {
  const { profile } = useAuth()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string>('Dashboard Pharmacie')
  const isAdmin = profile?.role === 'pharmacy_admin'

  const [activeTab, setActiveTab] = useState('pending')
  const [reservations, setReservations] = useState<any[]>([])
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
  const [todos, setTodos] = useState<Todos>({ prescriptions_to_verify: 0, reservations_to_accept: 0, patient_payments_pending: 0, mutual_payments_pending: 0, orders_to_prepare: 0, orders_ready: 0 })
  const [todosLoading, setTodosLoading] = useState(true)
  const [finances, setFinances] = useState({ commissions: 0, net: 0, next_due: '-' })

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('organization_members').select('organization_id, organizations(id, name)').eq('profile_id', profile.id).in('role', ['pharmacy_admin', 'pharmacy_staff']).limit(1).maybeSingle()
      .then(({ data }) => {
        const o = (data as any)?.organizations
        if (o?.id) { setOrgId(o.id); setOrgName(o.name ?? 'Pharmacie') }
      })
  }, [profile?.id])

  const fetchTodos = useCallback(async () => {
    if (!orgId) return
    setTodosLoading(true)
    const { data: view } = await (supabase as any).from('v_pharmacy_todo').select('*').eq('pharmacy_id', orgId).maybeSingle()
    if (view) {
      setTodos(view as Todos)
    } else {
      const db = supabase as any
      const [{ count: prescriptions }, { count: to_accept }, { count: patient_pay }, { count: mutual_pay }, { count: preparing }, { count: ready }] = await Promise.all([
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('prescription_status', 'pending'),
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('pharmacy_status', 'pending'),
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('patient_payment_status', 'pending'),
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('mutual_payment_status', 'pending'),
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('preparation_status', 'preparing'),
        db.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', orgId).eq('preparation_status', 'ready'),
      ])
      setTodos({ prescriptions_to_verify: prescriptions ?? 0, reservations_to_accept: to_accept ?? 0, patient_payments_pending: patient_pay ?? 0, mutual_payments_pending: mutual_pay ?? 0, orders_to_prepare: preparing ?? 0, orders_ready: ready ?? 0 })
    }
    setTodosLoading(false)
  }, [orgId])

  const fetchFinances = useCallback(async () => {
    if (!orgId || !isAdmin) return
    const { data } = await (supabase as any).from('commission_entries').select('amount, net_amount, due_date').eq('pharmacy_id', orgId).gte('created_at', thisMonthStart())
    const rows: any[] = data ?? []
    const total = rows.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
    const net = rows.reduce((s: number, e: any) => s + (e.net_amount ?? 0), 0)
    const next = rows.filter((e: any) => e.due_date).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))[0]?.due_date
    setFinances({ commissions: total, net, next_due: next ? new Date(next).toLocaleDateString('fr-FR') : '-' })
  }, [orgId, isAdmin])

  const fetchReservations = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const db = supabase as any
    let q = db.from('pharmacy_reservations').select('*, reservation_items(*), patients(profiles(first_name, last_name))').eq('pharmacy_id', orgId).order('created_at', { ascending: false })
    if (activeTab === 'pending') q = q.eq('pharmacy_status', 'pending')
    else if (activeTab === 'preparing') q = q.eq('preparation_status', 'preparing')
    else if (activeTab === 'ready') q = q.eq('preparation_status', 'ready')
    else q = q.not('withdrawn_at', 'is', null)
    const { data } = await q
    setReservations(data ?? [])
    setLoading(false)
  }, [orgId, activeTab])

  useEffect(() => { fetchTodos(); fetchFinances() }, [fetchTodos, fetchFinances])
  useEffect(() => { fetchReservations() }, [fetchReservations])

  useEffect(() => {
    if (!orgId) return
    const channel = supabase.channel(`pharmacy-rt-${orgId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'pharmacy_reservations', filter: `pharmacy_id=eq.${orgId}` }, () => { fetchTodos(); fetchReservations() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, fetchTodos, fetchReservations])

  const openModal = (type: typeof modalType, r: any) => { setSelected(r); setModalType(type); setWithdrawError(null); setWithdrawLocked(false); setWithdrawAttempts(0); setWithdrawCode('') }
  const refresh = () => { fetchReservations(); fetchTodos() }

  const handleAccept = async () => { setActionLoading(true); await supabase.functions.invoke('confirm-pharmacy-reservation', { body: { reservation_id: selected.id } }); setActionLoading(false); setModalType(null); refresh() }
  const handleRefuse = async () => { setActionLoading(true); await supabase.functions.invoke('refuse-pharmacy-reservation', { body: { reservation_id: selected.id, reason: refuseReason, comment: refuseComment } }); setActionLoading(false); setModalType(null); setRefuseReason(''); setRefuseComment(''); refresh() }
  const handleWithdraw = async () => {
    setActionLoading(true)
    const { error } = await supabase.functions.invoke('confirm-withdrawal', { body: { reservation_id: selected.id, code: withdrawCode } })
    setActionLoading(false)
    if (!error) { setModalType(null); refresh(); return }
    const msg = (error as any)?.message
    if (msg === 'WITHDRAWAL_LOCKED') { setWithdrawLocked(true) }
    else { const n = withdrawAttempts + 1; setWithdrawAttempts(n); setWithdrawCode(''); setWithdrawError(`Code incorrect (${n}/5)`) }
  }

  const kpiTiles = [
    { label: 'Ordonnances à vérifier', value: todos.prescriptions_to_verify, tab: 'pending', variant: todos.prescriptions_to_verify > 0 ? 'warning' : 'default' },
    { label: 'Réservations à accepter', value: todos.reservations_to_accept, tab: 'pending', variant: todos.reservations_to_accept > 0 ? 'warning' : 'default' },
    { label: 'Paiements patients', value: todos.patient_payments_pending, tab: 'preparing', variant: todos.patient_payments_pending > 0 ? 'warning' : 'default' },
    { label: 'Paiements mutuelles', value: todos.mutual_payments_pending, tab: 'preparing', variant: todos.mutual_payments_pending > 0 ? 'warning' : 'default' },
    { label: 'À préparer', value: todos.orders_to_prepare, tab: 'preparing', variant: todos.orders_to_prepare > 0 ? 'warning' : 'default' },
    { label: 'Commandes prêtes', value: todos.orders_ready, tab: 'ready', variant: todos.orders_ready > 0 ? 'success' : 'default' },
  ] as const

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">{orgName}</h1>
        <p className="text-sm text-ink-3">Tableau de bord — vue en temps réel</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">À faire</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-s-3">
          {todosLoading
            ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)
            : kpiTiles.map(t => (
                <KpiTile key={t.label} label={t.label} value={t.value} variant={t.variant} onClick={() => setActiveTab(t.tab)} />
              ))
          }
        </div>
      </section>

      <section>
        <div className="flex gap-s-1 border-b border-line">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={['pb-s-2 px-1 text-sm font-medium border-b-2 transition-colors', activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'].join(' ')}>{t.label}</button>
          ))}
        </div>
        <div className="space-y-s-2 mt-s-3">
          {loading
            ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
            : reservations.length === 0
              ? <p className="text-center text-ink-3 py-10">Aucune réservation dans cet onglet</p>
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
                            <StatusPill status={r.pharmacy_status ?? 'pending'} label={r.pharmacy_status ?? 'pending'} />
                            <span className="text-xs text-ink-3">{timeAgo(r.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex gap-s-2 shrink-0" onClick={e => e.stopPropagation()}>
                          {activeTab === 'pending' && <><Button size="sm" variant="primary" onClick={() => openModal('accept', r)}>Accepter</Button><Button size="sm" variant="danger" onClick={() => openModal('refuse', r)}>Refuser</Button></>}
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
      </section>

      {isAdmin && (
        <section>
          <div className="border-t border-line pt-s-4">
            <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Finances — ce mois</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-3">
              <KpiTile label="Commissions ce mois" value={fmt(finances.commissions)} variant="default" />
              <KpiTile label="Net ce mois" value={fmt(finances.net)} variant="success" />
              <KpiTile label="Prochaine échéance" value={finances.next_due} variant="default" />
            </div>
          </div>
        </section>
      )}

      <Modal open={modalType === 'accept'} onOpenChange={open => !open && setModalType(null)} title="Confirmer l'acceptation">
        <p className="text-ink-2">Accepter la réservation MED-{selected?.reservation_number} ?</p>
        <div className="flex justify-end gap-s-2 mt-s-4"><Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button><Button variant="primary" loading={actionLoading} onClick={handleAccept}>Confirmer</Button></div>
      </Modal>

      <Modal open={modalType === 'refuse'} onOpenChange={open => !open && setModalType(null)} title="Refuser la réservation">
        <div className="space-y-s-3"><Select label="Raison" value={refuseReason} onValueChange={setRefuseReason} options={REFUSE_REASONS} /><Input label="Commentaire (optionnel)" value={refuseComment} onChange={e => setRefuseComment(e.target.value)} /></div>
        <div className="flex justify-end gap-s-2 mt-s-4"><Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button><Button variant="danger" loading={actionLoading} disabled={!refuseReason} onClick={handleRefuse}>Confirmer le refus</Button></div>
      </Modal>

      <Modal open={modalType === 'withdraw'} onOpenChange={open => !open && setModalType(null)} title="Saisir le code de retrait">
        <div className="space-y-s-3">
          {withdrawLocked ? <Banner kind="warning">Trop de tentatives — réessayez plus tard</Banner> : <><OTPInput length={4} value={withdrawCode} onChange={setWithdrawCode} />{withdrawError && <p className="text-sm text-red-600">{withdrawError}</p>}</>}
        </div>
        <div className="flex justify-end gap-s-2 mt-s-4"><Button variant="ghost" onClick={() => setModalType(null)}>Annuler</Button>{!withdrawLocked && <Button variant="primary" loading={actionLoading} disabled={withdrawCode.length < 4} onClick={handleWithdraw}>Confirmer</Button>}</div>
      </Modal>
    </div>
  )
}
