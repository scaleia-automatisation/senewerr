import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Calendar, FileText, ShieldCheck, CreditCard,
  UserCheck, AlertTriangle, CheckCircle2, XCircle, Loader2,
  Trash2, ExternalLink, CheckCheck,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePraticienBadges } from './PraticienBadgesContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Notif {
  id:          string
  event_type:  string
  title?:      string | null
  message:     string
  data?:       Record<string, any> | null
  read_at:     string | null
  created_at:  string
}

type TabId = 'all' | 'agenda' | 'ordonnances' | 'tiers_payant' | 'paiements'

// ── Mappings ───────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ReactNode> = {
  APPOINTMENT_BOOKED:                <Calendar className="h-5 w-5 text-secondary" />,
  APPOINTMENT_CANCELED:              <Calendar className="h-5 w-5 text-danger" />,
  PATIENT_ARRIVED:                   <UserCheck className="h-5 w-5 text-success" />,
  PRESCRIPTION_CREATED:              <FileText className="h-5 w-5 text-primary" />,
  PRESCRIPTION_DRAFT_PENDING:        <FileText className="h-5 w-5 text-amber-500" />,
  PRESCRIPTION_PROBLEM_REPORTED:     <AlertTriangle className="h-5 w-5 text-danger" />,
  PRESCRIPTION_CLARIFICATION_REQUESTED: <FileText className="h-5 w-5 text-accent" />,
  COVERAGE_VALIDATED:                <CheckCircle2 className="h-5 w-5 text-success" />,
  COVERAGE_REJECTED:                 <XCircle className="h-5 w-5 text-danger" />,
  PAYMENT_RECEIVED:                  <CreditCard className="h-5 w-5 text-success" />,
  PAYMENT_FAILED:                    <CreditCard className="h-5 w-5 text-danger" />,
}

const EVENT_BADGE: Record<string, 'success' | 'danger' | 'pending' | 'accent' | 'neutral'> = {
  APPOINTMENT_BOOKED:                    'success',
  APPOINTMENT_CANCELED:                  'danger',
  PATIENT_ARRIVED:                       'success',
  PRESCRIPTION_CREATED:                  'neutral',
  PRESCRIPTION_DRAFT_PENDING:            'pending',
  PRESCRIPTION_PROBLEM_REPORTED:         'danger',
  PRESCRIPTION_CLARIFICATION_REQUESTED:  'accent',
  COVERAGE_VALIDATED:                    'success',
  COVERAGE_REJECTED:                     'danger',
  PAYMENT_RECEIVED:                      'success',
  PAYMENT_FAILED:                        'danger',
}

const EVENT_LABEL: Record<string, string> = {
  APPOINTMENT_BOOKED:                    'Nouveau RDV',
  APPOINTMENT_CANCELED:                  'RDV annulé',
  PATIENT_ARRIVED:                       'Patient arrivé',
  PRESCRIPTION_CREATED:                  'Ordonnance',
  PRESCRIPTION_DRAFT_PENDING:            'Brouillons en attente',
  PRESCRIPTION_PROBLEM_REPORTED:         'Problème ordonnance',
  PRESCRIPTION_CLARIFICATION_REQUESTED:  'Clarification demandée',
  COVERAGE_VALIDATED:                    'Tiers payant validé',
  COVERAGE_REJECTED:                     'Tiers payant refusé',
  PAYMENT_RECEIVED:                      'Paiement reçu',
  PAYMENT_FAILED:                        'Échec paiement',
}

// Map event_type → tab
const EVENT_TAB: Record<string, TabId> = {
  APPOINTMENT_BOOKED:                    'agenda',
  APPOINTMENT_CANCELED:                  'agenda',
  PATIENT_ARRIVED:                       'agenda',
  PRESCRIPTION_CREATED:                  'ordonnances',
  PRESCRIPTION_DRAFT_PENDING:            'ordonnances',
  PRESCRIPTION_PROBLEM_REPORTED:         'ordonnances',
  PRESCRIPTION_CLARIFICATION_REQUESTED:  'ordonnances',
  COVERAGE_VALIDATED:                    'tiers_payant',
  COVERAGE_REJECTED:                     'tiers_payant',
  PAYMENT_RECEIVED:                      'paiements',
  PAYMENT_FAILED:                        'paiements',
}

// Map event_type → navigation cible
function getNavTarget(n: Notif): string | null {
  const d = n.data ?? {}
  switch (n.event_type) {
    case 'APPOINTMENT_BOOKED':
    case 'APPOINTMENT_CANCELED':
      return d.appointment_id ? `/pro/agenda` : '/pro/agenda'
    case 'PATIENT_ARRIVED':
      return d.appointment_id ? `/pro/consultation/${d.appointment_id}` : '/pro/agenda'
    case 'PRESCRIPTION_CREATED':
    case 'PRESCRIPTION_PROBLEM_REPORTED':
    case 'PRESCRIPTION_CLARIFICATION_REQUESTED':
      return d.ordonnance_id ? `/pro/ordonnances/${d.ordonnance_id}` : '/pro/ordonnances'
    case 'PRESCRIPTION_DRAFT_PENDING':
      return '/pro/ordonnances?tab=brouillon'
    case 'COVERAGE_VALIDATED':
    case 'COVERAGE_REJECTED':
      return '/pro/tiers-payant'
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_FAILED':
      return '/pro/paiements'
    default:
      return null
  }
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'all',          label: 'Tout' },
  { id: 'agenda',       label: 'Agenda' },
  { id: 'ordonnances',  label: 'Ordonnances' },
  { id: 'tiers_payant', label: 'Tiers Payant' },
  { id: 'paiements',    label: 'Paiements' },
]

// ── Composant ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { profile } = useAuth()
  const { refreshAll } = usePraticienBadges()
  const navigate = useNavigate()
  const db = supabase as any

  const [notifs, setNotifs]         = useState<Notif[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<TabId>('all')
  const [markingAll, setMarkingAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await db
      .from('notifications')
      .select('id, event_type, title, message, data, read_at, created_at')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifs(data ?? [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  // Realtime — nouvelles notifs
  useEffect(() => {
    if (!profile?.id) return
    // Événements critiques : toast persistant (durée Infinie) + email géré côté EF
    const CRITICAL_EVENTS = new Set([
      'PAYMENT_FAILED',
      'COVERAGE_REJECTED',
      'PRESCRIPTION_PROBLEM_REPORTED',
    ])

    const ch = supabase
      .channel(`notifs-pro-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => {
        const n = payload.new as Notif
        const msg = n.message || (EVENT_LABEL[n.event_type] ?? 'Notification')
        if (CRITICAL_EVENTS.has(n.event_type)) {
          // Persistant — le praticien doit explicitement fermer
          toast.error(msg, { duration: Infinity, icon: '⚠️' })
        } else {
          toast(msg, { duration: 5000, icon: '🔔' })
        }
        load()
        refreshAll()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, load, refreshAll])

  // Mark single as read
  async function markRead(id: string) {
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', profile!.id)
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    refreshAll()
  }

  // Mark all as read
  async function markAllRead() {
    setMarkingAll(true)
    await db
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profile!.id)
      .is('read_at', null)
    await load()
    refreshAll()
    setMarkingAll(false)
    toast.success('Toutes les notifications marquées comme lues')
  }

  // Delete notification (soft)
  async function deleteNotif(id: string) {
    setDeletingId(id)
    await db
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', profile!.id)
    setNotifs(ns => ns.filter(n => n.id !== id))
    refreshAll()
    setDeletingId(null)
  }

  // Navigate + mark read
  async function handleNavigate(n: Notif) {
    if (!n.read_at) await markRead(n.id)
    const target = getNavTarget(n)
    if (target) navigate(target)
  }

  // Filtered list
  const filtered = activeTab === 'all'
    ? notifs
    : notifs.filter(n => EVENT_TAB[n.event_type] === activeTab)

  const unreadCount = notifs.filter(n => !n.read_at).length

  // Per-tab unread counts
  const tabCounts: Record<TabId, number> = {
    all:          unreadCount,
    agenda:       notifs.filter(n => !n.read_at && EVENT_TAB[n.event_type] === 'agenda').length,
    ordonnances:  notifs.filter(n => !n.read_at && EVENT_TAB[n.event_type] === 'ordonnances').length,
    tiers_payant: notifs.filter(n => !n.read_at && EVENT_TAB[n.event_type] === 'tiers_payant').length,
    paiements:    notifs.filter(n => !n.read_at && EVENT_TAB[n.event_type] === 'paiements').length,
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6 max-w-2xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-s-2">
        <div className="flex items-center gap-s-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-h4 font-semibold text-ink">Notifications</h1>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-s-1.5 text-micro font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            onClick={markAllRead}
            disabled={markingAll}
          >
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-s-1 border-b border-line pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-s-1.5 shrink-0 px-s-3 py-s-2 text-small font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {tab.label}
            {tabCounts[tab.id] > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-s-1 text-[10px] font-bold text-white">
                {tabCounts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-s-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-s-16 text-center">
          <Bell className="h-10 w-10 text-ink-3 opacity-20 mb-s-3" />
          <p className="text-small text-ink-3">Aucune notification</p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-1">
          {filtered.map(n => {
            const isUnread = !n.read_at
            const navTarget = getNavTarget(n)
            const icon = EVENT_ICON[n.event_type] ?? <Bell className="h-5 w-5 text-ink-3" />
            const label = EVENT_LABEL[n.event_type]

            return (
              <div
                key={n.id}
                className={cn(
                  'group flex items-start gap-s-3 rounded-xl px-s-3 py-s-3 transition-colors',
                  isUnread ? 'bg-primary/5 border border-primary/15' : 'border border-transparent hover:bg-surface-2',
                )}
              >
                {/* Dot non-lu */}
                <div className="relative mt-0.5 shrink-0">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full',
                    isUnread ? 'bg-primary/10' : 'bg-surface-2',
                  )}>
                    {icon}
                  </div>
                  {isUnread && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-surface" />
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-s-2 flex-wrap">
                    {label && (
                      <Badge variant={EVENT_BADGE[n.event_type] ?? 'neutral'} className="text-[10px]">
                        {label}
                      </Badge>
                    )}
                    <span className="text-micro text-ink-3 ml-auto">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className={cn(
                    'mt-s-0.5 text-small leading-snug',
                    isUnread ? 'font-medium text-ink' : 'text-ink-3',
                  )}>
                    {n.message}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-s-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {navTarget && (
                    <button
                      onClick={() => handleNavigate(n)}
                      className="rounded p-s-1.5 text-ink-3 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Accéder"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isUnread && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="rounded p-s-1.5 text-ink-3 hover:text-success hover:bg-success/10 transition-colors"
                      title="Marquer comme lu"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotif(n.id)}
                    disabled={deletingId === n.id}
                    className="rounded p-s-1.5 text-ink-3 hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-40"
                    title="Supprimer"
                  >
                    {deletingId === n.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
