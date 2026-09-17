import { Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/useAuth'
import { SidebarBase } from './SidebarBase'
import { BottomNav } from './BottomNav'
import type { SpaceNav } from './nav-types'

interface AppLayoutProps {
  nav: SpaceNav
  className?: string
}

export function AppLayout({ nav, className }: AppLayoutProps) {
  const { profile } = useAuth()
  const name = profile?.full_name ?? nav.roleLabel

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <SidebarBase
          links={nav.links}
          userFullName={name}
          userRole={nav.roleLabel}
          userAvatar={profile?.avatar_url}
        />
      </aside>

      {/* Contenu */}
      <div className={cn('flex flex-1 flex-col overflow-auto', className)}>
        <main className="mx-auto w-full max-w-container flex-1 px-s-4 py-s-4 pb-[76px] sm:px-s-6 md:pb-s-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <BottomNav links={nav.links} />
    </div>
  )
}
