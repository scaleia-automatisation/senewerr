import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MoreHorizontal, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import type { NavLink } from './nav-types'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function BottomNav({ links }: { links: NavLink[] }) {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const primary = links.filter(l => l.primary).slice(0, 4)
  const rest = links.filter(l => !primary.includes(l))

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden">
        <ul className="flex items-stretch">
          {primary.map(link => {
            const active = isActive(pathname, link.href)
            return (
              <li key={link.href} className="flex-1">
                <Link
                  to={link.href}
                  className={cn(
                    'relative flex min-h-[56px] flex-col items-center justify-center gap-s-1 py-s-2 text-micro font-medium',
                    active ? 'text-primary' : 'text-ink-3',
                  )}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-pill bg-primary" aria-hidden="true" />}
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              </li>
            )
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[56px] w-full flex-col items-center justify-center gap-s-1 py-s-2 text-micro font-medium text-ink-3"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Plus</span>
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={moreOpen} onOpenChange={setMoreOpen} title="Menu" size="sm">
        <ul className="flex flex-col gap-s-1">
          {rest.map(link => {
            const active = isActive(pathname, link.href)
            return (
              <li key={link.href}>
                <Link
                  to={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-s-3 rounded-md px-s-3 py-s-3 text-body font-medium transition-colors',
                    active ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2',
                  )}
                >
                  <span className={active ? 'text-primary' : 'text-ink-3'}>{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-s-3 rounded-md px-s-3 py-s-3 text-body font-medium text-status-danger transition-colors hover:bg-surface-2"
            >
              <LogOut className="h-5 w-5" />
              Se déconnecter
            </button>
          </li>
        </ul>
      </Modal>
    </>
  )
}
