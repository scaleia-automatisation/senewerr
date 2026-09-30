'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Calendar, CalendarDays, Users, Stethoscope,
  FileText, FolderOpen, Building2, Wallet, BadgeCheck,
  Settings, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/sante/accueil',        icon: Home,         label: 'Tableau de bord' },
  { href: '/sante/agenda',         icon: Calendar,     label: 'Agenda' },
  { href: '/sante/rendez-vous',    icon: CalendarDays, label: 'Rendez-vous' },
  { href: '/sante/patients',       icon: Users,        label: 'Patients' },
  { href: '/sante/consultations',  icon: Stethoscope,  label: 'Consultations' },
  { href: '/sante/ordonnances',    icon: FileText,     label: 'Ordonnances' },
  { href: '/sante/documents',      icon: FolderOpen,   label: 'Documents' },
  { href: '/sante/etablissements', icon: Building2,    label: 'Mes établissements' },
  { href: '/sante/revenus',        icon: Wallet,       label: 'Revenus' },
  { href: '/sante/abonnement',     icon: BadgeCheck,   label: 'Abonnement' },
  { href: '/sante/profil',         icon: Settings,     label: 'Paramètres' },
]

const BOTTOM = [
  { href: '/sante/accueil',       icon: Home,        label: 'Accueil' },
  { href: '/sante/agenda',        icon: Calendar,    label: 'Agenda' },
  { href: '/sante/consultations', icon: Stethoscope, label: 'Consult.' },
  { href: '/sante/patients',      icon: Users,       label: 'Patients' },
  { href: '/sante/ordonnances',   icon: FileText,    label: 'Ordonnances' },
]

export function SanteNav() {
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
        <Link href="/sante/accueil" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-[var(--sw-ink)]">Séné Wérr</span>
        </Link>
      </div>

      <ul className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/sante/accueil' && pathname.startsWith(href))
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

export function SanteBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center justify-around border-t border-[var(--sw-line)] bg-[var(--sw-surface)] px-2 py-1">
      {BOTTOM.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== '/sante/accueil' && pathname.startsWith(href))
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
