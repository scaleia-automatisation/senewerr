import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Bell, CheckCheck, Calendar, Package, Shield, FileText, CreditCard } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Notifications' }

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  appointment_confirmed:  <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />,
  appointment_modified:   <Calendar className="w-4 h-4 text-[var(--sw-warning)]" />,
  appointment_cancelled:  <Calendar className="w-4 h-4 text-[var(--sw-danger)]" />,
  appointment_reminder:   <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />,
  prescription_available: <FileText className="w-4 h-4 text-purple-600" />,
  reservation_confirmed:  <Package className="w-4 h-4 text-[var(--sw-success)]" />,
  reservation_ready:      <Package className="w-4 h-4 text-[var(--sw-success)]" />,
  reservation_refused:    <Package className="w-4 h-4 text-[var(--sw-danger)]" />,
  coverage_validated:     <Shield className="w-4 h-4 text-[var(--sw-success)]" />,
  coverage_refused:       <Shield className="w-4 h-4 text-[var(--sw-danger)]" />,
  payment_confirmed:      <CreditCard className="w-4 h-4 text-[var(--sw-success)]" />,
  account_validated:      <CheckCheck className="w-4 h-4 text-[var(--sw-success)]" />,
}

const REFERENCE_LINKS: Record<string, (id: string) => string> = {
  appointment:      (id) => `/patient/rendez-vous/${id}`,
  prescription:     (id) => `/patient/dossier/ordonnances/${id}`,
  reservation:      (id) => `/patient/pharmacie/reservations/${id}`,
  coverage_request: (id) => `/patient/couverture/demandes/${id}`,
  payment:          (id) => `/patient/paiements/${id}`,
}

type Notif = {
  id: string
  notification_type: string
  title: string
  body: string
  is_read: boolean
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

function fmtRelative(s: string) {
  const diff = Date.now() - new Date(s).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `Il y a ${days} j`
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data } = await supabase
    .from('notifications')
    .select('id, notification_type, title, body, is_read, reference_type, reference_id, created_at')
    .eq('recipient_id', user.id)
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (data ?? []) as unknown as Notif[]
  const unreadCount = notifications.filter(n => !n.is_read).length

  const unread = notifications.filter(n => !n.is_read)
  const read = notifications.filter(n => n.is_read)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Notifications</h1>
          {unreadCount > 0 && <p className="text-xs text-[var(--sw-ink-2)]">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>}
        </div>
        {unreadCount > 0 && (
          <form action={async () => {
            'use server'
            const sc = await createClient()
            await (sc.from('notifications') as unknown as { update: (v: unknown) => { eq: (...a: unknown[]) => unknown } })
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('recipient_id', user.id)
              .eq('channel', 'in_app')
              .eq('is_read', false)
          }}>
            <button type="submit" className="flex items-center gap-1.5 text-xs text-[var(--sw-primary)] font-medium px-3 py-1.5 rounded-xl border border-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)]">
              <CheckCheck className="w-3.5 h-3.5" /> Tout marquer lu
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="sw-card p-10 text-center">
          <Bell className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune notification pour le moment.</p>
        </div>
      )}

      {unread.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">Non lues ({unread.length})</h2>
          {unread.map(n => {
            const href = n.reference_type && n.reference_id ? (REFERENCE_LINKS[n.reference_type]?.(n.reference_id) ?? null) : null
            const icon = NOTIF_ICONS[n.notification_type] ?? <Bell className="w-4 h-4 text-[var(--sw-ink-3)]" />
            const Card = (
              <div className="sw-card p-4 flex items-start gap-3 border-l-4 border-l-[var(--sw-primary)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{n.title}</p>
                  {n.body && <p className="text-xs text-[var(--sw-ink-2)] mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-[var(--sw-ink-3)] mt-1">{fmtRelative(n.created_at)}</p>
                </div>
              </div>
            )
            return href ? (
              <Link key={n.id} href={href} className="block hover:opacity-90 transition-opacity">{Card}</Link>
            ) : (
              <div key={n.id}>{Card}</div>
            )
          })}
        </section>
      )}

      {read.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">Lues</h2>
          {read.map(n => {
            const href = n.reference_type && n.reference_id ? (REFERENCE_LINKS[n.reference_type]?.(n.reference_id) ?? null) : null
            const icon = NOTIF_ICONS[n.notification_type] ?? <Bell className="w-4 h-4 text-[var(--sw-ink-3)]" />
            const Card = (
              <div className="sw-card p-4 flex items-start gap-3 opacity-60">
                <div className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{n.title}</p>
                  {n.body && <p className="text-xs text-[var(--sw-ink-2)] mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-[var(--sw-ink-3)] mt-1">{fmtRelative(n.created_at)}</p>
                </div>
              </div>
            )
            return href ? (
              <Link key={n.id} href={href} className="block hover:opacity-70 transition-opacity">{Card}</Link>
            ) : (
              <div key={n.id}>{Card}</div>
            )
          })}
        </section>
      )}
    </div>
  )
}
