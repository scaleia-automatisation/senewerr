'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FileText, Shield, ClipboardCheck,
  CreditCard, RefreshCw, FolderOpen, BarChart3, BadgeCheck, Settings, LogOut,
} from 'lucide-react'

const NAV = [
  { href: '/couverture/accueil',   label: 'Tableau de bord',            icon: LayoutDashboard },
  { href: '/couverture/adherents', label: 'Adhérents',                  icon: Users },
  { href: '/couverture/contrats',  label: 'Contrats et formules',       icon: FileText },
  { href: '/couverture/garanties', label: 'Garanties',                  icon: Shield },
  { href: '/couverture/demandes',  label: 'Demandes de prise en charge', icon: ClipboardCheck },
  { href: '/couverture/paiements', label: 'Paiements',                  icon: CreditCard },
  { href: '/couverture/remboursements', label: 'Remboursements',        icon: RefreshCw },
  { href: '/couverture/documents', label: 'Documents',                  icon: FolderOpen },
  { href: '/couverture/rapports',  label: 'Rapports',                   icon: BarChart3 },
  { href: '/couverture/abonnement', label: 'Abonnement',                icon: BadgeCheck },
  { href: '/couverture/parametres', label: 'Paramètres',                icon: Settings },
]

const BOTTOM = [
  { href: '/couverture/accueil',   label: 'Accueil',   icon: LayoutDashboard },
  { href: '/couverture/adherents', label: 'Adhérents', icon: Users },
  { href: '/couverture/demandes',  label: 'Demandes',  icon: ClipboardCheck },
  { href: '/couverture/paiements', label: 'Paiements', icon: CreditCard },
  { href: '/couverture/parametres', label: 'Paramètres', icon: Settings },
]

export function CouvertureNav({ orgName }: { orgName?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--sw-line)]">
        <Link href="/couverture/accueil" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--sw-ink)] text-sm leading-tight truncate">
              {orgName ?? 'Espace Couverture'}
            </p>
            <p className="text-[10px] text-[var(--sw-ink-3)]">Séné Wérr</p>
          </div>
        </Link>
      </div>

      <ul className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/couverture/accueil' && pathname.startsWith(href))
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-2 transition-colors',
                  active
                    ? 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                    : 'text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] hover:text-[var(--sw-ink)]'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="p-3 border-t border-[var(--sw-line)]">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-[var(--sw-ink-2)] hover:text-[var(--sw-danger)] hover:bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </nav>
  )
}

export function CouvertureBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center justify-around border-t border-[var(--sw-line)] bg-[var(--sw-surface)] px-2 py-1">
      {BOTTOM.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/couverture/accueil' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors',
              active ? 'text-[var(--sw-primary)]' : 'text-[var(--sw-ink-3)]'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
