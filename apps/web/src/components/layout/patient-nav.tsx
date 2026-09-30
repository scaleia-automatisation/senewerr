'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Calendar, FileText, Pill, ShoppingBag,
  Shield, FolderOpen, Users, CreditCard, User, LogOut, Search, ClipboardList,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/patient/accueil',    icon: Home,        label: 'Accueil' },
  { href: '/patient/trouver',    icon: Search,      label: 'Trouver' },
  { href: '/patient/rendez-vous', icon: Calendar,   label: 'Rendez-vous' },
  { href: '/patient/dossier',    icon: ClipboardList, label: 'Mon dossier' },
  { href: '/patient/ordonnances', icon: FileText,   label: 'Ordonnances' },
  { href: '/patient/medicaments', icon: Pill,       label: 'Médicaments' },
  { href: '/patient/reservations', icon: ShoppingBag, label: 'Réservations' },
  { href: '/patient/couverture',  icon: Shield,     label: 'Couverture' },
  { href: '/patient/documents',   icon: FolderOpen, label: 'Documents' },
  { href: '/patient/famille',     icon: Users,      label: 'Ma famille' },
  { href: '/patient/paiements',   icon: CreditCard, label: 'Paiements' },
  { href: '/patient/profil',      icon: User,       label: 'Profil' },
]

export function PatientNav() {
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
        <Link href="/patient/accueil" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-[var(--sw-ink)]">Séné Wérr</span>
        </Link>
      </div>

      <ul className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
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
          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-[var(--sw-ink-2)] hover:text-[var(--sw-danger)] hover:bg-[var(--sw-danger-bg)] rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </nav>
  )
}

export function PatientBottomNav() {
  const pathname = usePathname()
  const BOTTOM = NAV.slice(0, 5)

  return (
    <nav className="flex items-center justify-around border-t border-[var(--sw-line)] bg-[var(--sw-surface)] px-2 py-1">
      {BOTTOM.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
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
