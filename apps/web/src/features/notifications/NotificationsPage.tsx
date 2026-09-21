import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Trash2, CheckCheck, Settings2, Calendar, Pill, FileText,
  CreditCard, MessageCircle, Users, RefreshCw, ShieldAlert, Clock,
  Megaphone, X, Smartphone, Mail, MessageSquare, MoonStar,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePatientBadges } from '@/features/patient/PatientBadgesContext'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  event_type: string
  badge_category: string | null
  priority: string
  read_at: string | null
  created_at: string
  data: Record<string, unknown>
}

interface NotifPref {
  type: string
  canal_push: boolean
  canal_email: boolean
  canal_sms: boolean
}

interface SilenceRange {
  actif: boolean
  debut: string
  fin: string
}

interface RappelPush {
  id: string
  medicament_id: string | null
  heure_envoi: string
  actif: boolean
  medicament_nom?: string
}

type FilterType = 'all' | 'unread' | string // event_type string

// ─── Config types de notifications ───────────────────────────────────────────
const NOTIF_TYPES: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'rdv_confirme',          label: 'RDV confirmé',           icon: <Calendar className="h-4 w-4" />,       color: 'text-status-success' },
  { key: 'rdv_rappel',            label: 'Rappel RDV',             icon: <Clock className="h-4 w-4" />,          color: 'text-primary' },
  { key: 'rdv_annule',            label: 'RDV annulé',             icon: <X className="h-4 w-4" />,              color: 'text-status-danger' },
  { key: 'ordonnance_expiration', label: 'Expiration ordonnance',  icon: <Pill className="h-4 w-4" />,           color: 'text-status-pending' },
  { key: 'nouvelle_ordonnance',   label: 'Nouvelle ordonnance',    icon: <Pill className="h-4 w-4" />,           color: 'text-status-success' },
  { key: 'document_nouveau',      label: 'Nouveau document',       icon: <FileText className="h-4 w-4" />,       color: 'text-ink-2' },
  { key: 'remboursement',         label: 'Remboursement',          icon: <RefreshCw className="h-4 w-4" />,      color: 'text-status-success' },
  { key: 'nouvelle_facture',      label: 'Nouvelle facture',       icon: <CreditCard className="h-4 w-4" />,     color: 'text-status-pending' },
  { key: 'paiement_confirme',     label: 'Paiement confirmé',      icon: <CreditCard className="h-4 w-4" />,     color: 'text-status-success' },
  { key: 'message_praticien',     label: 'Message praticien',      icon: <MessageCircle className="h-4 w-4" />,  color: 'text-primary' },
  { key: 'famille',               label: 'Famille',                icon: <Users className="h-4 w-4" />,          color: 'text-primary' },
  { key: 'rappel_medicament',     label: 'Rappel médicament',      icon: <Pill className="h-4 w-4" />,           color: 'text-ink-2' },
  { key: 'mutuelle_expiration',   label: 'Mutuelle expirant',      icon: <ShieldAlert className="h-4 w-4" />,    color: 'text-status-danger' },
  { key: 'systeme',               label: 'Système',                icon: <Megaphone className="h-4 w-4" />,      color: 'text-ink-3' },
]

function getTypeConfig(eventType: string) {
  return NOTIF_TYPES.find(t => t.key === eventType) ?? {
    key: eventType,
    label: eventType,
    icon: <Bell className="h-4 w-4" />,
    color: 'text-ink-3',
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'À l\'instant'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} jour${d > 1 ? 's' : ''}`
}

// ─── PAGE SIZE ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

// ─── NotifCard ────────────────────────────────────────────────────────────────
function NotifCard({ notif, onRead, onDelete }: {
  notif: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const cfg = getTypeConfig(notif.event_type)
  const isUnread = !notif.read_at
  const url = (notif.data?.url as string) ?? null

  function handleClick() {
    if (isUnread) onRead(notif.id)
    if (url) navigate(url)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      className={cn(
        'group flex gap-s-3 rounded-md border p-s-3 cursor-pointer transition-colors',
        isUnread ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface hover:bg-surface-2',
      )}
    >
      {/* Icône type */}
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2', cfg.color)}>
        {cfg.icon}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-s-2">
          <p className={cn('text-small', isUnread ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>
            {notif.title}
          </p>
          <div className="flex items-center gap-s-1.5 shrink-0">
            <span className="text-micro text-ink-3 whitespace-nowrap">{timeAgo(notif.created_at)}</span>
            <button
              onClick={e => { e.stopPropagation(); onDelete(notif.id) }}
              className="rounded p-0.5 text-ink-3 opacity-0 group-hover:opacity-100 hover:text-status-danger transition-all"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-micro text-ink-3 mt-s-0.5 line-clamp-2">{notif.message}</p>
        {isUnread && <span className="mt-s-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
      </div>
    </div>
  )
}

// ─── PreferencesPanel ─────────────────────────────────────────────────────────
function PreferencesPanel({ userId }: { userId: string }) {
  const db = supabase as any
  const [prefs, setPrefs]         = useState<Record<string, NotifPref>>({})
  const [silence, setSilence]     = useState<SilenceRange>({ actif: false, debut: '22:00', fin: '07:00' })
  const [rappels, setRappels]     = useState<RappelPush[]>([])
  const [loadingP, setLoadingP]   = useState(true)
  const [loadingR, setLoadingR]   = useState(true)

  useEffect(() => {
    // Charger préférences existantes
    db.from('preferences_notifications')
      .select('type, canal_push, canal_email, canal_sms')
      .eq('user_id', userId)
      .then(({ data }: any) => {
        const map: Record<string, NotifPref> = {}
        for (const t of NOTIF_TYPES) {
          const row = (data ?? []).find((r: any) => r.type === t.key)
          map[t.key] = row ?? { type: t.key, canal_push: true, canal_email: true, canal_sms: false }
        }
        setPrefs(map)
        setLoadingP(false)
      })
    // Charger plage silence (stockée en jsonb dans user_settings ou preferences_notifications type='silence')
    db.from('preferences_notifications')
      .select('canal_push, canal_email, canal_sms')
      .eq('user_id', userId)
      .eq('type', '__silence__')
      .maybeSingle()
      .then(({ data: sd }: any) => {
        if (sd) setSilence({ actif: sd.canal_push, debut: sd.canal_email || '22:00', fin: sd.canal_sms || '07:00' })
      })
    // Charger rappels push
    db.from('rappels_push')
      .select('id, medicament_id, heure_envoi, actif, medicament:medicaments(nom)')
      .eq('user_id', userId)
      .eq('actif', true)
      .then(({ data }: any) => {
        setRappels((data ?? []).map((r: any) => ({
          ...r,
          medicament_nom: r.medicament?.nom,
        })))
        setLoadingR(false)
      })
  }, [userId])

  async function toggleCanal(type: string, canal: keyof Omit<NotifPref, 'type'>) {
    const prev = prefs[type]
    if (!prev) return
    const updated = { ...prev, [canal]: !prev[canal] }
    setPrefs(p => ({ ...p, [type]: updated }))
    await db.from('preferences_notifications').upsert(
      { user_id: userId, type, canal_push: updated.canal_push, canal_email: updated.canal_email, canal_sms: updated.canal_sms },
      { onConflict: 'user_id,type' },
    )
  }

  async function saveSilence(updated: SilenceRange) {
    setSilence(updated)
    // On stocke la plage dans une ligne spéciale type='__silence__'
    // canal_push = actif, canal_email = debut, canal_sms = fin (hack via string fields)
    await db.from('preferences_notifications').upsert(
      { user_id: userId, type: '__silence__', canal_push: updated.actif, canal_email: updated.debut, canal_sms: updated.fin },
      { onConflict: 'user_id,type' },
    )
  }

  async function disableRappel(id: string) {
    await db.from('rappels_push').update({ actif: false }).eq('id', id)
    setRappels(prev => prev.filter(r => r.id !== id))
    toast.success('Rappel désactivé.')
  }

  if (loadingP) return <div className="flex flex-col gap-s-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 rounded-md"/>)}</div>

  return (
    <div className="flex flex-col gap-s-6">
      {/* Tableau canaux par type */}
      <div>
        <h3 className="mb-s-3 font-semibold text-ink">Canaux par type de notification</h3>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[480px] text-small">
            <thead>
              <tr className="bg-surface-2 border-b border-line">
                <th className="px-s-3 py-s-2 text-left font-semibold text-ink">Type</th>
                <th className="px-s-3 py-s-2 text-center font-semibold text-ink">
                  <div className="flex items-center justify-center gap-s-1"><Smartphone className="h-3.5 w-3.5" />Push</div>
                </th>
                <th className="px-s-3 py-s-2 text-center font-semibold text-ink">
                  <div className="flex items-center justify-center gap-s-1"><Mail className="h-3.5 w-3.5" />Email</div>
                </th>
                <th className="px-s-3 py-s-2 text-center font-semibold text-ink">
                  <div className="flex items-center justify-center gap-s-1"><MessageSquare className="h-3.5 w-3.5" />SMS</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {NOTIF_TYPES.map(t => {
                const p = prefs[t.key]
                if (!p) return null
                return (
                  <tr key={t.key} className="hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-2">
                        <span className={cn('shrink-0', t.color)}>{t.icon}</span>
                        <span className="text-ink">{t.label}</span>
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2 text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={p.canal_push} onChange={() => toggleCanal(t.key, 'canal_push')}
                          className="h-4 w-4 cursor-pointer accent-primary" />
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2 text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={p.canal_email} onChange={() => toggleCanal(t.key, 'canal_email')}
                          className="h-4 w-4 cursor-pointer accent-primary" />
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2 text-center">
                      <div className="flex justify-center">
                        <input type="checkbox" checked={p.canal_sms} onChange={() => toggleCanal(t.key, 'canal_sms')}
                          className="h-4 w-4 cursor-pointer accent-primary" />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plage de silence */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <div className="flex items-center gap-s-3 mb-s-3">
          <MoonStar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-ink">Plage de silence</h3>
        </div>
        <Switch
          checked={silence.actif}
          onCheckedChange={v => saveSilence({ ...silence, actif: v })}
          label="Activer la plage de silence"
          description="Aucune notification push ne sera envoyée pendant cette plage."
        />
        {silence.actif && (
          <div className="mt-s-3 grid grid-cols-2 gap-s-3">
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Début</label>
              <input
                type="time"
                value={silence.debut}
                onChange={e => saveSilence({ ...silence, debut: e.target.value })}
                className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus"
              />
            </div>
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Fin</label>
              <input
                type="time"
                value={silence.fin}
                onChange={e => saveSilence({ ...silence, fin: e.target.value })}
                className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus"
              />
            </div>
          </div>
        )}
        <p className="mt-s-2 text-micro text-ink-3">
          La vérification est effectuée côté serveur (Edge Function send-push-notification).
        </p>
      </div>

      {/* Rappels médicaments */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <div className="flex items-center gap-s-2 mb-s-3">
          <Pill className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-ink">Rappels médicaments</h3>
        </div>
        {loadingR ? (
          <Skeleton className="h-10 rounded-md" />
        ) : rappels.length === 0 ? (
          <p className="text-small text-ink-3">Aucun rappel actif. Activez-les depuis vos ordonnances.</p>
        ) : (
          <div className="flex flex-col gap-s-2">
            {rappels.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2">
                <div>
                  <p className="text-small font-medium text-ink">{r.medicament_nom ?? 'Médicament'}</p>
                  <p className="text-micro text-ink-3">{r.heure_envoi}</p>
                </div>
                <Button size="sm" variant="ghost" leftIcon={<X className="h-4 w-4" />}
                  onClick={() => disableRappel(r.id)} className="text-status-danger hover:bg-status-danger/5">
                  Désactiver
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── NotificationsPage ────────────────────────────────────────────────────────
type Tab = 'notifications' | 'preferences'

export default function NotificationsPage() {
  const db = supabase as any
  const { profile }   = useAuth()
  const { refreshAll }  = usePatientBadges()
  const navigate = useNavigate()

  const [tab, setTab]               = useState<Tab>('notifications')
  const [filter, setFilter]         = useState<FilterType>('all')
  const [notifs, setNotifs]         = useState<Notification[]>([])
  const [loading, setLoading]       = useState(true)
  const [hasMore, setHasMore]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (reset = false) => {
    if (!profile?.id) return
    const offset = reset ? 0 : offsetRef.current
    if (reset) { setLoading(true) } else { setLoadingMore(true) }

    let q = db
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filter === 'unread') q = q.is('read_at', null)
    else if (filter !== 'all') q = q.eq('event_type', filter)

    const { data } = await q
    const rows: Notification[] = data ?? []

    if (reset) {
      setNotifs(rows)
      offsetRef.current = rows.length
    } else {
      setNotifs(prev => [...prev, ...rows])
      offsetRef.current += rows.length
    }
    setHasMore(rows.length === PAGE_SIZE)
    if (reset) setLoading(false)
    else setLoadingMore(false)
  }, [profile?.id, filter])

  useEffect(() => { fetchPage(true) }, [fetchPage])

  // ── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) fetchPage(false) },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, fetchPage])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`notifs-rt-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => {
        const n = payload.new as Notification
        setNotifs(prev => [n, ...prev])
        refreshAll()

        // Toast cliquable
        const url = (n.data?.url as string) ?? null
        const cfg = getTypeConfig(n.event_type)
        toast(n.title, {
          description: n.message,
          icon: <span className={cfg.color}>{cfg.icon}</span>,
          action: url ? {
            label: 'Voir',
            onClick: () => navigate(url),
          } : undefined,
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => { refreshAll() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, navigate, refreshAll])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function markRead(id: string) {
    const now = new Date().toISOString()
    await db.from('notifications').update({ read_at: now }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n))
    refreshAll()
  }

  async function markAllRead() {
    if (!profile?.id) return
    const now = new Date().toISOString()
    await db.from('notifications').update({ read_at: now }).eq('user_id', profile.id).is('read_at', null)
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })))
    refreshAll()
  }

  async function deleteOne(id: string) {
    await db.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
    refreshAll()
  }

  async function deleteAll() {
    if (!profile?.id) return
    if (!window.confirm(`Supprimer les ${notifs.length} notifications affichées ?`)) return
    await db.from('notifications').update({ deleted_at: new Date().toISOString() })
      .eq('user_id', profile.id).is('deleted_at', null)
    setNotifs([])
    refreshAll()
  }

  const unreadCount = notifs.filter(n => !n.read_at).length

  // ── Filter chips ──────────────────────────────────────────────────────────
  const ALL_FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',    label: 'Toutes' },
    { key: 'unread', label: `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    ...NOTIF_TYPES.map(t => ({ key: t.key, label: t.label })),
  ]

  return (
    <div className="flex flex-col gap-s-4 pb-s-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-s-2">
        <div className="flex items-center gap-s-2">
          <h1 className="font-display text-h1 font-semibold text-ink">Notifications</h1>
          {unreadCount > 0 && tab === 'notifications' && (
            <span className="rounded-full bg-status-danger px-s-2 py-0.5 text-micro font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-s-2">
          {tab === 'notifications' && unreadCount > 0 && (
            <Button variant="ghost" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead}>
              Tout marquer lu
            </Button>
          )}
          {tab === 'notifications' && notifs.length > 0 && (
            <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={deleteAll} className="text-status-danger hover:text-status-danger">
              Tout supprimer
            </Button>
          )}
          <Button
            variant={tab === 'preferences' ? 'secondary' : 'ghost'}
            size="sm"
            leftIcon={<Settings2 className="h-4 w-4" />}
            onClick={() => setTab(t => t === 'preferences' ? 'notifications' : 'preferences')}
          >
            Préférences
          </Button>
        </div>
      </div>

      {/* Onglets principaux */}
      <div className="flex gap-s-4 border-b border-line">
        {(['notifications', 'preferences'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'pb-s-2 px-s-1 text-small font-medium border-b-2 transition-colors flex items-center gap-s-1',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t === 'notifications' ? <><Bell className="h-4 w-4" /> Mes notifications</> : <><Settings2 className="h-4 w-4" /> Préférences</>}
          </button>
        ))}
      </div>

      {/* Préférences */}
      {tab === 'preferences' && profile?.id && <PreferencesPanel userId={profile.id} />}

      {/* Notifications */}
      {tab === 'notifications' && (
        <>
          {/* Filter chips — scroll horizontal */}
          <div className="flex gap-s-2 overflow-x-auto scrollbar-none pb-s-1">
            {ALL_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-pill border px-s-3 py-s-1 text-micro font-medium transition-colors whitespace-nowrap',
                  filter === f.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="flex flex-col gap-s-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-md" />)}
            </div>
          ) : notifs.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-10 w-10" />}
              title={filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
              description={filter !== 'all' && filter !== 'unread'
                ? `Aucune notification de type «${getTypeConfig(filter).label}».`
                : 'Vous êtes à jour !'}
            />
          ) : (
            <div className="flex flex-col gap-s-2">
              {notifs.map(n => (
                <NotifCard key={n.id} notif={n} onRead={markRead} onDelete={deleteOne} />
              ))}

              {/* Sentinel pagination infinie */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-s-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {!hasMore && notifs.length > PAGE_SIZE && (
                <p className="text-center text-micro text-ink-3 py-s-2">Toutes les notifications sont chargées.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
