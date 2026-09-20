import { useState, useEffect, useCallback } from 'react'
import { Bell, Trash2, CheckCheck, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel'

interface Notification {
  id: string
  title: string
  message: string
  event_type: string
  badge_category: string | null
  priority: string
  read_at: string | null
  created_at: string
  data: Record<string, unknown>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} jour${d > 1 ? 's' : ''}`
}

type Filter = 'all' | 'unread'
type Tab = 'notifications' | 'preferences'

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<Tab>('notifications')

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    let q = (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (filter === 'unread') q = q.is('read_at', null)
    const { data } = await q
    setNotifications(data ?? [])
    setLoading(false)
  }, [profile?.id, filter])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function markAllRead() {
    if (!profile?.id) return
    await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('read_at', null)
    const now = new Date().toISOString()
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: n.read_at ?? now }))
    )
  }

  async function markRead(id: string) {
    const now = new Date().toISOString()
    await (supabase as any).from('notifications').update({ read_at: now }).eq('id', id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: now } : n))
    )
  }

  async function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await (supabase as any)
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    if (!confirm(`Supprimer définitivement les ${notifications.length} notifications ?`)) return
    if (!profile?.id) return
    await (supabase as any)
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('deleted_at', null)
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  if (loading) {
    return (
      <div className="flex flex-col gap-s-3 p-s-4 max-w-2xl mx-auto">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-s-2">
        <h1 className="flex items-center gap-s-2 text-h2 font-semibold text-ink">
          <Bell className="w-6 h-6" />
          Notifications
          {unreadCount > 0 && tab === 'notifications' && (
            <Badge variant="primary">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </h1>
        {tab === 'notifications' && (
          <div className="flex gap-s-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4 mr-1" /> Tout marquer lu
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-status-danger hover:text-status-danger"
                onClick={deleteAll}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Tout supprimer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs principaux */}
      <div className="flex gap-s-4 border-b border-line">
        <button
          onClick={() => setTab('notifications')}
          className={[
            'pb-s-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-s-1',
            tab === 'notifications'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-3 hover:text-ink',
          ].join(' ')}
        >
          <Bell className="w-4 h-4" /> Mes notifications
        </button>
        <button
          onClick={() => setTab('preferences')}
          className={[
            'pb-s-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-s-1',
            tab === 'preferences'
              ? 'border-primary text-primary'
              : 'border-transparent text-ink-3 hover:text-ink',
          ].join(' ')}
        >
          <Settings2 className="w-4 h-4" /> Préférences
        </button>
      </div>

      {/* Onglet Préférences */}
      {tab === 'preferences' && <NotificationPreferencesPanel />}

      {/* Onglet Notifications — sous-filtres */}
      {tab === 'notifications' && (
        <div className="flex gap-s-2 border-b border-line">
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'pb-s-2 px-1 text-sm font-medium border-b-2 transition-colors',
                filter === f
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-3 hover:text-ink',
              ].join(' ')}
            >
              {f === 'all' ? 'Toutes' : 'Non lues'}
            </button>
          ))}
        </div>
      )}

      {/* List — visible uniquement dans l'onglet notifications */}
      {tab === 'notifications' && (notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-16">
          <Bell className="w-12 h-12 text-ink-3" />
          <p className="text-body text-ink-3">
            {filter === 'unread'
              ? 'Aucune notification non lue'
              : 'Aucune notification'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-2">
          {notifications.map(n => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => { if (!n.read_at) markRead(n.id) }}
              onKeyDown={e => { if (e.key === 'Enter' && !n.read_at) markRead(n.id) }}
              className={[
                'flex gap-s-3 rounded-md border p-s-3 cursor-pointer transition-colors',
                !n.read_at
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-line bg-surface hover:bg-surface-2',
              ].join(' ')}
            >
              {/* Unread dot */}
              <div className="mt-1.5 shrink-0">
                {!n.read_at ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <div className="h-2 w-2" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-s-2">
                  <p
                    className={[
                      'text-sm',
                      !n.read_at
                        ? 'font-semibold text-ink'
                        : 'font-medium text-ink-2',
                    ].join(' ')}
                  >
                    {n.title}
                  </p>
                  <div className="flex items-center gap-s-2 shrink-0">
                    <span className="text-xs text-ink-3 whitespace-nowrap">
                      {timeAgo(n.created_at)}
                    </span>
                    <button
                      onClick={e => deleteOne(n.id, e)}
                      className="text-ink-3 hover:text-status-danger transition-colors"
                      aria-label="Supprimer la notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-ink-3 mt-1">{n.message}</p>
                {n.badge_category && (
                  <span className="mt-1 inline-block text-xs font-medium text-primary">
                    {n.badge_category}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
