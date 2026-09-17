import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  CreditCard,
  FileSearch,
  FileText,
  LayoutDashboard,
  Lock,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'

// ─────────────────────────────────────────────────────────────
// Admin context (role, readOnly flag forwarded by SuperAdminLayout)
// ─────────────────────────────────────────────────────────────
interface AdminContextValue {
  role: string | null
  isSuperAdmin: boolean
}

const AdminCtx = createContext<AdminContextValue>({ role: null, isSuperAdmin: false })
export const useAdminContext = () => useContext(AdminCtx)

// ─────────────────────────────────────────────────────────────
// useAdminAudit — write audit_logs on every admin page view
// ─────────────────────────────────────────────────────────────
export function useAdminAudit(pageName: string) {
  const { profile } = useAuth()

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('audit_logs')
      .insert({
        action: 'admin.view.' + pageName,
        actor_id: profile.id,
        result: 'success',
      } as any)
      .then(({ error }) => {
        if (error) console.warn('[AdminAudit]', error.message)
      })
    // Run once per pageName + profile combination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageName, profile?.id])
}

// ─────────────────────────────────────────────────────────────
// Nav links definition
// ─────────────────────────────────────────────────────────────
const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes

const ic = 'h-4 w-4 shrink-0'

interface AdminNavLink {
  href: string
  label: string
  icon: ReactNode
  superAdminOnly?: boolean
}

const ADMIN_LINKS: AdminNavLink[] = [
  { href: '/admin',                       label: 'Dashboard',          icon: <LayoutDashboard className={ic} /> },
  { href: '/admin/acteurs',               label: 'Acteurs',            icon: <Users className={ic} /> },
  { href: '/admin/commandes',             label: 'Commandes',          icon: <ShoppingBag className={ic} /> },
  { href: '/admin/rendez-vous',           label: 'Rendez-vous',        icon: <BookOpen className={ic} /> },
  { href: '/admin/paiements',             label: 'Paiements',          icon: <CreditCard className={ic} /> },
  { href: '/admin/litiges',               label: 'Litiges',            icon: <AlertTriangle className={ic} /> },
  { href: '/admin/ordonnances-signalees', label: 'Ordonnances',        icon: <FileText className={ic} /> },
  { href: '/admin/contenu',               label: 'Contenu',            icon: <FileSearch className={ic} /> },
  { href: '/admin/ia',                    label: 'Coût IA',            icon: <BarChart2 className={ic} /> },
  { href: '/admin/audit',                 label: 'Audit',              icon: <Shield className={ic} /> },
  { href: '/admin/securite',              label: 'Sécurité',           icon: <Lock className={ic} /> },
  { href: '/admin/recherche',             label: 'Recherche',          icon: <Search className={ic} /> },
  { href: '/super-admin',                 label: 'Super Admin',        icon: <Settings className={ic} />, superAdminOnly: true },
]

// ─────────────────────────────────────────────────────────────
// AdminLayout
// ─────────────────────────────────────────────────────────────
interface AdminLayoutProps {
  /** Override role check (used by SuperAdminLayout) */
  allowedRoles?: string[]
  /** Render extra banners above content */
  headerBanner?: ReactNode
}

export function AdminLayout({
  allowedRoles = ['platform_admin', 'super_admin'],
  headerBanner,
}: AdminLayoutProps) {
  const { profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [aal2Checked, setAal2Checked] = useState(false)
  const [aal2Ok, setAal2Ok] = useState(false)

  // ── AAL2 check ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (cancelled) return
      if (!data || data.currentLevel !== 'aal2') {
        navigate('/2fa', { replace: true })
      } else {
        setAal2Ok(true)
      }
      setAal2Checked(true)
    })
    return () => { cancelled = true }
  }, [navigate])

  // ── Role check ───────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !aal2Checked || !profile) return
    if (!allowedRoles.includes(profile.role as string)) {
      navigate('/', { replace: true })
    }
  }, [authLoading, aal2Checked, profile, allowedRoles, navigate])

  // ── 30-minute inactivity timeout ─────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/connexion?reason=timeout', { replace: true })
    }, INACTIVITY_MS)
  }, [navigate])

  useEffect(() => {
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer))
    }
  }, [resetInactivityTimer])

  // ── Loading / guard states ────────────────────────────────────
  if (authLoading || !aal2Checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Spinner />
      </div>
    )
  }
  if (!aal2Ok || !profile || !allowedRoles.includes(profile.role as string)) {
    return null
  }

  const isSuperAdmin = profile.role === 'super_admin'

  // ── Sidebar active link check ────────────────────────────────
  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/connexion', { replace: true })
  }

  return (
    <AdminCtx.Provider value={{ role: profile.role as string, isSuperAdmin }}>
      <div className="flex h-screen overflow-hidden bg-bg">
        {/* ── Desktop Sidebar ───────────────────────────────── */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
          {/* Logo */}
          <div className="flex items-center gap-s-2 border-b border-line px-s-4 py-s-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <span className="font-display text-sm font-semibold text-primary-fg">M</span>
            </div>
            <span className="font-display text-h3 font-semibold text-ink">Medikool</span>
            <span className="ml-auto rounded-sm bg-surface-2 px-s-1 py-px text-micro font-medium text-ink-3">
              Admin
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-s-2 py-s-3">
            <ul className="flex flex-col gap-y-px">
              {ADMIN_LINKS.filter(link => !link.superAdminOnly || isSuperAdmin).map(link => {
                const active = isActive(link.href)
                return (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className={cn(
                        'flex items-center gap-s-3 rounded-md px-s-3 py-s-2 text-small font-medium transition-colors',
                        active
                          ? 'bg-primary-soft text-primary'
                          : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                        link.superAdminOnly && 'mt-s-2 border-t border-line pt-s-2',
                      )}
                    >
                      <span className={cn('shrink-0', active ? 'text-primary' : 'text-ink-3')}>
                        {link.icon}
                      </span>
                      <span className="flex-1">{link.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User footer */}
          <div className="border-t border-line p-s-3">
            <div className="mb-s-2 flex items-center gap-s-3">
              <Avatar
                src={profile.avatar_url}
                fallback={profile.full_name ?? '?'}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-ink">{profile.full_name}</p>
                <p className="truncate text-micro text-ink-3">
                  {isSuperAdmin ? 'Super Admin' : 'Administrateur'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-s-2 rounded-md px-s-3 py-s-2 text-small text-ink-2 transition-colors hover:bg-surface-2 hover:text-status-danger"
            >
              <span className="text-xs">Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-auto">
          {headerBanner}
          <main className="mx-auto w-full max-w-container flex-1 px-s-4 py-s-4 sm:px-s-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  )
}
