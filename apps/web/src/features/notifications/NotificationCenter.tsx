import { useState, useEffect, useCallback } from 'react'
import { Bell, Trash2, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

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
  return `${Math.floor(h / 24)} j`
}

function priorityBorderClass(priority: string) {
  if (priority === 'critical') return 'border-l-[3px] border-l-[color:var(--color-status-danger)]'
  if (priority === 'high') return 'border-l-[3px] border-l-[color:var(--color-status-warning)]'
  return 'border-l-[3px] border-l-transparent'
}

export function NotificationBell() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20)
    const list = data ?? []
    setNotifications(list)
    setUnreadCount(list.filter((n: Notification) => !n.read_at).length)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => { fetchNotifications() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, fetchNotifications])

  async function markAllRead() {
    if (!profile?.id) return
    await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('read_at', null)
    fetchNotifications()
  }

  async function markRead(id: string) {
    const now = new Date().toISOString()
    await supabase.from('notifications').update({ read_at: now }).eq('id', id)
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read_at: now } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const wasUnread = notifications.find(n => n.id === id && !n.read_at)
    await (supabase as any)
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1))
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
    setUnreadCount(0)
  }

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) fetchNotifications()
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
      >
        <Bell className="w-5 h-5 text-ink-2" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-80 rounded-md border border-line bg-surface shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-p-s-3 py-s-2 px-3 py-2">
              <p className="font-medium text-ink text-sm">
                Notifications{' '}
                {unreadCount > 0 && (
                  <span className="ml-1 text-primary">({unreadCount})</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-ink-3 hover:text-primary transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" /> Tout lire
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAll}
                    className="flex items-center gap-1 text-xs text-status-danger hover:opacity-80 transition-opacity ml-2"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer tout
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Bell className="w-8 h-8 text-ink-3" />
                  <p className="text-xs text-ink-3">Aucune notification</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => { if (!n.read_at) markRead(n.id) }}
                    onKeyDown={e => { if (e.key === 'Enter' && !n.read_at) markRead(n.id) }}
                    className={[
                      'relative flex gap-2 border-b border-line p-3 cursor-pointer transition-colors',
                      priorityBorderClass(n.priority),
                      !n.read_at ? 'bg-primary/5' : 'bg-surface hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <div className="mt-1.5 shrink-0">
                      {!n.read_at ? (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        <div className="h-2 w-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={[
                          'text-xs truncate',
                          !n.read_at ? 'font-semibold text-ink' : 'text-ink-2',
                        ].join(' ')}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-3 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-ink-3 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      onClick={e => deleteOne(n.id, e)}
                      className="shrink-0 text-ink-3 hover:text-status-danger transition-colors"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-line p-2 text-center">
              <Link
                to="/patient/notifications"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Voir toutes les notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
