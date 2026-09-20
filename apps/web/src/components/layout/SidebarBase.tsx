import { Link, useLocation } from 'react-router-dom'
import { LogOut, Sun, Moon, Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import type { NavLink } from './nav-types'

interface SidebarBaseProps {
  links: NavLink[]
  userFullName: string
  userRole: string
  userAvatar?: string | null
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function SidebarBase({ links, userFullName, userRole, userAvatar }: SidebarBaseProps) {
  const { pathname } = useLocation()
  const { toggle } = useTheme()
  const { isSupported, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-s-2 border-b border-line px-s-4 py-s-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <span className="font-display text-small font-bold text-primary-fg">SW</span>
        </div>
        <span className="font-display text-h3 font-semibold text-ink">Séne Wérr</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-s-3 py-s-4">
        <ul className="flex flex-col gap-s-1">
          {links.map(link => {
            const active = isActive(pathname, link.href)
            return (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className={cn(
                    'flex items-center gap-s-3 rounded-md px-s-3 py-s-2 text-small font-medium transition-colors',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <span className={cn('shrink-0', active ? 'text-primary' : 'text-ink-3')}>{link.icon}</span>
                  <span className="flex-1">{link.label}</span>
                  {link.badge ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-s-1 text-micro font-medium text-primary-fg">
                      {link.badge > 99 ? '99+' : link.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Utilisateur */}
      <div className="border-t border-line p-s-4">
        <div className="mb-s-3 flex items-center gap-s-3">
          <Avatar src={userAvatar} fallback={userFullName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-ink">{userFullName}</p>
            <p className="truncate text-micro text-ink-3">{userRole}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-s-2 rounded-md px-s-3 py-s-2 text-small text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
          <span className="dark:hidden">Mode sombre</span>
          <span className="hidden dark:block">Mode clair</span>
        </button>
        {isSupported && (
          <button
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={pushLoading}
            className="flex w-full items-center gap-s-2 rounded-md px-s-3 py-s-2 text-small text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            {subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            <span>{subscribed ? 'Désactiver les notifications' : 'Activer les notifications'}</span>
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-s-2 rounded-md px-s-3 py-s-2 text-small text-ink-2 transition-colors hover:bg-surface-2 hover:text-status-danger"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
