import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Settings, Check, CheckCheck, Trash2, ChevronDown,
  FileText, AlertTriangle, CreditCard, Clock, Package,
  Truck, ShieldAlert, MessageSquare, AlertCircle, Loader2,
  BellOff, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacyBadges } from './PharmacyBadgesContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ─────────────────────────────────────────────────────────────────────

type NotifType =
  | 'nouvelle_ordonnance_soumise' | 'ordonnance_urgente'
  | 'paiement_recu' | 'paiement_en_attente'
  | 'stock_alerte' | 'stock_rupture'
  | 'livraison_proche' | 'livraison_recue' | 'ecart_reception'
  | 'document_admin_depose' | 'interaction_signalee' | 'patient_signalement'
  | 'litige_ouvert' | 'message_admin' | 'systeme'

interface Notif {
  id: string
  user_id: string
  type: NotifType
  titre: string
  corps: string | null
  read_at: string | null
  deleted_at: string | null
  data: Record<string, any> | null
  created_at: string
}

interface NotifPref {
  user_id: string
  type: NotifType
  canal_push: boolean
  canal_email: boolean
  silence_debut: string | null
  silence_fin: string | null
}

// ─── Config types ───────────────────────────────────────────────────────────────

interface TypeConfig {
  label: string
  icon: React.ReactNode
  urgence: 'critical' | 'warning' | 'normal'
}

const TYPE_CONFIGS: Record<NotifType, TypeConfig> = {
  nouvelle_ordonnance_soumise: { label: 'Nouvelle ordonnance', icon: <FileText className="h-4 w-4" />, urgence: 'normal' },
  ordonnance_urgente:          { label: 'Ordonnance urgente', icon: <AlertTriangle className="h-4 w-4" />, urgence: 'warning' },
  paiement_recu:               { label: 'Paiement reçu', icon: <CreditCard className="h-4 w-4" />, urgence: 'normal' },
  paiement_en_attente:         { label: 'Paiement en attente', icon: <Clock className="h-4 w-4" />, urgence: 'normal' },
  stock_alerte:                { label: 'Alerte stock', icon: <Package className="h-4 w-4" />, urgence: 'warning' },
  stock_rupture:               { label: 'Rupture de stock', icon: <AlertCircle className="h-4 w-4" />, urgence: 'critical' },
  livraison_proche:            { label: 'Livraison proche', icon: <Truck className="h-4 w-4" />, urgence: 'normal' },
  livraison_recue:             { label: 'Livraison reçue', icon: <Truck className="h-4 w-4" />, urgence: 'normal' },
  ecart_reception:             { label: 'Écart de réception', icon: <AlertTriangle className="h-4 w-4" />, urgence: 'warning' },
  document_admin_depose:       { label: 'Document déposé', icon: <FileText className="h-4 w-4" />, urgence: 'normal' },
  interaction_signalee:        { label: 'Interaction signalée', icon: <ShieldAlert className="h-4 w-4" />, urgence: 'critical' },
  patient_signalement:         { label: 'Signalement patient', icon: <AlertCircle className="h-4 w-4" />, urgence: 'critical' },
  litige_ouvert:               { label: 'Litige ouvert', icon: <AlertCircle className="h-4 w-4" />, urgence: 'critical' },
  message_admin:               { label: 'Message admin', icon: <MessageSquare className="h-4 w-4" />, urgence: 'normal' },
  systeme:                     { label: 'Système', icon: <Zap className="h-4 w-4" />, urgence: 'normal' },
}

const ALL_TYPES = Object.keys(TYPE_CONFIGS) as NotifType[]

const URGENT_TYPES: NotifType[] = ['stock_rupture', 'ordonnance_urgente', 'litige_ouvert', 'interaction_signalee']

function urgenceBg(type: NotifType, read: boolean): string {
  const cfg = TYPE_CONFIGS[type]
  if (!read) {
    if (cfg.urgence === 'critical') return 'bg-red-50 border-red-200'
    if (cfg.urgence === 'warning') return 'bg-orange-50 border-orange-200'
    return 'bg-emerald-50 border-emerald-200'
  }
  return 'bg-surface border-line'
}

function urgenceIcon(type: NotifType): string {
  const cfg = TYPE_CONFIGS[type]
  if (cfg.urgence === 'critical') return 'text-red-500'
  if (cfg.urgence === 'warning') return 'text-orange-500'
  return 'text-primary'
}

const PAGE_SIZE = 20

// ─── Main component ─────────────────────────────────────────────────────────────

export default function PharmacyNotificationsPage() {
  const { profile } = useAuth()
  const { refreshAll } = usePharmacyBadges()
  const navigate = useNavigate()
  const db = supabase as any

  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const [filter, setFilter] = useState<'all' | 'unread' | NotifType>('all')
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<NotifPref[]>([])
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [silenceDebut, setSilenceDebut] = useState('22:00')
  const [silenceFin, setSilenceFin] = useState('06:00')
  const [silenceActive, setSilenceActive] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  // ─── Load initial ──────────────────────────────────────────────────────────
  const loadNotifs = useCallback(async (reset = false) => {
    if (!profile?.id) return
    const off = reset ? 0 : offset
    if (!reset) setLoadingMore(true)
    else setLoading(true)

    let q = db
      .from('notifications')
      .select('id, user_id, type, titre, corps, read_at, deleted_at, data, created_at')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(off, off + PAGE_SIZE - 1)

    if (filter === 'unread') q = q.is('read_at', null)
    else if (filter !== 'all') q = q.eq('type', filter)

    const { data, error } = await q
    if (error) { toast.error('Erreur de chargement.'); setLoading(false); setLoadingMore(false); return }

    const items: Notif[] = data ?? []
    setHasMore(items.length === PAGE_SIZE)
    if (reset) {
      setNotifs(items)
      setOffset(items.length)
    } else {
      setNotifs(prev => [...prev, ...items])
      setOffset(prev => prev + items.length)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [profile?.id, filter, offset])

  useEffect(() => { loadNotifs(true) }, [profile?.id, filter])

  // ─── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`notifs-pharmacien-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as Notif
          setNotifs(prev => [n, ...prev])
          refreshAll()
          // Toast avec action rapide
          const cfg = TYPE_CONFIGS[n.type] ?? {}
          if (n.type === 'nouvelle_ordonnance_soumise') {
            toast(n.titre, {
              description: n.corps ?? undefined,
              action: { label: 'Traiter', onClick: () => navigate('/pharmacie/ordonnances') },
            })
          } else if (n.type === 'stock_alerte' || n.type === 'stock_rupture') {
            toast.warning(n.titre, {
              description: n.corps ?? undefined,
              action: { label: 'Voir', onClick: () => navigate('/pharmacie/stock') },
            })
          } else if (n.type === 'ordonnance_urgente') {
            toast.warning(n.titre, { description: n.corps ?? undefined })
          } else {
            toast(n.titre, { description: n.corps ?? undefined })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const n = payload.new as Notif
          setNotifs(prev => prev.map(x => x.id === n.id ? n : x))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  // ─── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadNotifs(false) },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadNotifs])

  // ─── Load prefs ────────────────────────────────────────────────────────────
  const loadPrefs = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await db.from('preferences_notifications')
      .select('*').eq('user_id', profile.id)
    const rows: NotifPref[] = data ?? []
    // Fill missing types with defaults
    const merged: NotifPref[] = ALL_TYPES.map(type => {
      const found = rows.find(r => r.type === type)
      return found ?? { user_id: profile.id, type, canal_push: true, canal_email: false, silence_debut: null, silence_fin: null }
    })
    setPrefs(merged)
    if (rows[0]) {
      setSilenceDebut(rows[0].silence_debut ?? '22:00')
      setSilenceFin(rows[0].silence_fin ?? '06:00')
      setSilenceActive(!!rows[0].silence_debut)
    }
  }, [profile?.id])

  useEffect(() => { if (showPrefs) loadPrefs() }, [showPrefs])

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function markRead(id: string) {
    await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    refreshAll()
  }

  async function markAllRead() {
    if (!profile?.id) return
    const unreadIds = notifs.filter(n => !n.read_at).map(n => n.id)
    if (!unreadIds.length) return
    await db.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id).is('read_at', null)
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    refreshAll()
    toast.success(`${unreadIds.length} notification(s) marquée(s) comme lue(s).`)
  }

  async function deleteNotif(id: string) {
    await db.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
    refreshAll()
  }

  function handleClick(n: Notif) {
    if (!n.read_at) markRead(n.id)
    const url = n.data?.url as string | undefined
    if (url) navigate(url)
  }

  // ─── Save prefs ────────────────────────────────────────────────────────────
  async function savePrefs() {
    if (!profile?.id) return
    setSavingPrefs(true)
    const rows = prefs.map(p => ({
      ...p,
      silence_debut: silenceActive ? silenceDebut : null,
      silence_fin: silenceActive ? silenceFin : null,
    }))
    const { error } = await db.from('preferences_notifications').upsert(rows, { onConflict: 'user_id,type' })
    if (error) { toast.error('Erreur de sauvegarde.'); setSavingPrefs(false); return }
    toast.success('Préférences enregistrées.')
    setSavingPrefs(false); setShowPrefs(false)
  }

  function togglePref(type: NotifType, canal: 'canal_push' | 'canal_email') {
    setPrefs(prev => prev.map(p => p.type === type ? { ...p, [canal]: !p[canal] } : p))
  }

  // ─── Computed ──────────────────────────────────────────────────────────────
  const unreadCount = useMemo(() => notifs.filter(n => !n.read_at).length, [notifs])

  const filterLabel = useMemo(() => {
    if (filter === 'all') return 'Toutes'
    if (filter === 'unread') return 'Non lues'
    return TYPE_CONFIGS[filter as NotifType]?.label ?? filter
  }, [filter])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-s-4 pb-s-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-s-3">
          <h1 className="font-display text-h1 font-semibold text-ink">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-s-2 py-s-0.5 text-micro font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-s-2">
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead}>
              Tout marquer lu
            </Button>
          )}
          <Button size="sm" variant="secondary" leftIcon={<Settings className="h-4 w-4" />} onClick={() => setShowPrefs(true)}>
            Préférences
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-s-2">
        {/* Quick filters */}
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-s-3 py-s-1.5 text-small transition-colors ${
              filter === f ? 'bg-primary text-white' : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
            }`}>
            {f === 'all' ? 'Toutes' : 'Non lues'}
          </button>
        ))}

        {/* Type dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-s-1.5 rounded-full px-s-3 py-s-1.5 text-small transition-colors ${
              !['all', 'unread'].includes(filter)
                ? 'bg-primary text-white'
                : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
            }`}>
            {!['all', 'unread'].includes(filter) ? filterLabel : 'Par type'}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-20 mt-s-1 w-56 rounded-lg border border-line bg-surface shadow-lg py-s-1">
                {ALL_TYPES.map(type => {
                  const cfg = TYPE_CONFIGS[type]
                  return (
                    <button key={type} onClick={() => { setFilter(type); setFilterOpen(false) }}
                      className={`flex w-full items-center gap-s-2 px-s-3 py-s-2 text-small hover:bg-surface-2 ${
                        filter === type ? 'text-primary font-semibold' : 'text-ink'
                      }`}>
                      <span className={urgenceIcon(type)}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-s-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : notifs.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-s-16 text-ink-3">
          <BellOff className="h-10 w-10 opacity-30" />
          <p className="text-small">Aucune notification.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-2">
          <AnimatePresence initial={false}>
            {notifs.map(n => {
              const cfg = TYPE_CONFIGS[n.type]
              const isRead = !!n.read_at
              return (
                <motion.div key={n.id}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className={`group relative flex items-start gap-s-3 rounded-lg border p-s-3 cursor-pointer transition-colors ${urgenceBg(n.type, isRead)}`}
                  onClick={() => handleClick(n)}
                >
                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 rounded-full p-s-1.5 ${
                    !isRead ? (
                      TYPE_CONFIGS[n.type].urgence === 'critical' ? 'bg-red-100' :
                      TYPE_CONFIGS[n.type].urgence === 'warning' ? 'bg-orange-100' : 'bg-emerald-100'
                    ) : 'bg-surface-2'
                  }`}>
                    <span className={isRead ? 'text-ink-3' : urgenceIcon(n.type)}>{cfg?.icon ?? <Bell className="h-4 w-4" />}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-s-2">
                      <p className={`text-small ${isRead ? 'text-ink-2' : 'font-semibold text-ink'}`}>
                        {n.titre}
                      </p>
                      <span className="shrink-0 text-micro text-ink-3">
                        {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    {n.corps && <p className="mt-s-0.5 text-small text-ink-3 line-clamp-2">{n.corps}</p>}
                  </div>

                  {/* Unread dot */}
                  {!isRead && (
                    <div className="absolute right-s-3 top-s-3 h-2 w-2 rounded-full bg-primary" />
                  )}

                  {/* Hover actions */}
                  <div className="absolute right-s-3 top-s-3 hidden items-center gap-s-1 group-hover:flex"
                    onClick={e => e.stopPropagation()}>
                    {!isRead && (
                      <button title="Marquer lu" onClick={() => markRead(n.id)}
                        className="rounded p-s-1 text-ink-3 hover:text-primary hover:bg-surface-2">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button title="Supprimer" onClick={() => deleteNotif(n.id)}
                      className="rounded p-s-1 text-ink-3 hover:text-red-500 hover:bg-surface-2">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-s-4">
            {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-ink-3" />}
            {!hasMore && notifs.length > 0 && (
              <p className="text-micro text-ink-3">Toutes les notifications sont affichées.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Préférences ──────────────────────────────────────────────── */}
      <Modal open={showPrefs} onOpenChange={open => { if (!open) setShowPrefs(false) }}
        title="Préférences de notifications" size="xl">
        <div className="flex flex-col gap-s-5">
          {/* Plage de silence */}
          <div className="rounded-lg border border-line bg-surface-2 p-s-4">
            <div className="flex items-center justify-between mb-s-3">
              <div>
                <p className="font-semibold text-ink text-small">Plage de silence</p>
                <p className="text-micro text-ink-3">Les notifications seront silencieuses pendant cette période.</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={silenceActive} onChange={e => setSilenceActive(e.target.checked)} className="sr-only peer" />
                <div className="h-5 w-9 rounded-full bg-ink-3 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
            <AnimatePresence>
              {silenceActive && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="flex items-center gap-s-3 mt-s-2">
                    <div className="flex flex-col gap-s-1">
                      <label className="text-micro font-semibold text-ink">Début</label>
                      <input type="time" value={silenceDebut} onChange={e => setSilenceDebut(e.target.value)}
                        className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <span className="text-ink-3 mt-s-4">→</span>
                    <div className="flex flex-col gap-s-1">
                      <label className="text-micro font-semibold text-ink">Fin</label>
                      <input type="time" value={silenceFin} onChange={e => setSilenceFin(e.target.value)}
                        className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>
                  <div className="mt-s-2 flex items-center gap-s-2 rounded bg-amber-50 border border-amber-200 p-s-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-micro text-amber-800">
                      Urgences toujours notifiées (rupture stock, ordonnance urgente, litige, interaction).
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tableau préférences */}
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[400px] text-small">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">Type</th>
                  <th className="px-s-3 py-s-2 text-center text-micro font-semibold text-ink-3">Push</th>
                  <th className="px-s-3 py-s-2 text-center text-micro font-semibold text-ink-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prefs.map(p => {
                  const cfg = TYPE_CONFIGS[p.type]
                  const isUrgent = URGENT_TYPES.includes(p.type)
                  return (
                    <tr key={p.type} className={isUrgent ? 'bg-red-50/30' : ''}>
                      <td className="px-s-3 py-s-2">
                        <div className="flex items-center gap-s-2">
                          <span className={urgenceIcon(p.type)}>{cfg.icon}</span>
                          <span className={`text-ink ${isUrgent ? 'font-semibold' : ''}`}>{cfg.label}</span>
                          {isUrgent && <span className="text-micro text-red-500">toujours</span>}
                        </div>
                      </td>
                      <td className="px-s-3 py-s-2 text-center">
                        <Toggle value={p.canal_push} onChange={() => togglePref(p.type, 'canal_push')} disabled={isUrgent} />
                      </td>
                      <td className="px-s-3 py-s-2 text-center">
                        <Toggle value={p.canal_email} onChange={() => togglePref(p.type, 'canal_email')} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowPrefs(false)}>Annuler</Button>
            <Button variant="primary" onClick={savePrefs} loading={savingPrefs}
              leftIcon={<Check className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Toggle inline ──────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled = false }: { value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={value || disabled} onChange={disabled ? undefined : onChange}
        disabled={disabled} className="sr-only peer" />
      <div className="h-5 w-9 rounded-full bg-ink-3 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
    </label>
  )
}
