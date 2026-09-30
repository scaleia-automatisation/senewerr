'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, Package, ClipboardList, FileText,
  Shield, CreditCard, ShoppingBag, History, BadgeCheck, Settings, LogOut,
} from 'lucide-react'

const NAV = [
  { href: '/pharmacie/accueil',           label: 'Tableau de bord',    icon: LayoutDashboard },
  { href: '/pharmacie/catalogue',         label: 'Catalogue',          icon: BookOpen },
  { href: '/pharmacie/stock',             label: 'Stock',              icon: Package },
  { href: '/pharmacie/reservations',      label: 'Réservations',       icon: ClipboardList },
  { href: '/pharmacie/ordonnances',       label: 'Ordonnances',        icon: FileText },
  { href: '/pharmacie/prises-en-charge',  label: 'Prises en charge',   icon: Shield },
  { href: '/pharmacie/paiements',         label: 'Paiements',          icon: CreditCard },
  { href: '/pharmacie/retraits',          label: 'Retraits',           icon: ShoppingBag },
  { href: '/pharmacie/historique',        label: 'Historique',         icon: History },
  { href: '/pharmacie/abonnement',        label: 'Abonnement',         icon: BadgeCheck },
  { href: '/pharmacie/parametres',        label: 'Paramètres',         icon: Settings },
]

const BOTTOM = [
  { href: '/pharmacie/accueil',      label: 'Accueil',      icon: LayoutDashboard },
  { href: '/pharmacie/reservations', label: 'Réservations', icon: ClipboardList },
  { href: '/pharmacie/retraits',     label: 'Retraits',     icon: ShoppingBag },
  { href: '/pharmacie/stock',        label: 'Stock',        icon: Package },
  { href: '/pharmacie/catalogue',    label: 'Catalogue',    icon: BookOpen },
]

export function PharmacieNav({ pharmacyName }: { pharmacyName?: string }) {
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
        <Link href="/pharmacie/accueil" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--sw-ink)] text-sm leading-tight truncate">
              {pharmacyName ?? 'Espace Pharmacie'}
            </p>
            <p className="text-[10px] text-[var(--sw-ink-3)]">Séné Wérr</p>
          </div>
        </Link>
      </div>

      <ul className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/pharmacie/accueil' && pathname.startsWith(href))
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

export function PharmacieBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center justify-around border-t border-[var(--sw-line)] bg-[var(--sw-surface)] px-2 py-1">
      {BOTTOM.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/pharmacie/accueil' && pathname.startsWith(href))
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
