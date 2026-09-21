import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Play, ChevronDown } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PROFESSIONAL_NAV } from '@/config/navigation'
import { Button } from '@/components/ui/Button'
import { usePraticien, type PraticienStatus } from './PraticienContext'
import { usePraticienBadges } from './PraticienBadgesContext'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PraticienStatus, { label: string; color: string; pulse: boolean }> = {
  DISPONIBLE:       { label: 'Disponible',        color: 'bg-emerald-500', pulse: false },
  EN_CONSULTATION:  { label: 'En consultation',   color: 'bg-primary',     pulse: true  },
  PAUSE:            { label: 'En pause',           color: 'bg-amber-400',   pulse: false },
  HORS_LIGNE:       { label: 'Hors ligne',         color: 'bg-ink-3',       pulse: false },
}

const STATUS_CYCLE: PraticienStatus[] = ['DISPONIBLE', 'EN_CONSULTATION', 'PAUSE', 'HORS_LIGNE']

// ── Breadcrumb labels ─────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  '':             "Aujourd'hui",
  'agenda':       'Agenda',
  'patients':     'Patients',
  'consultations':'Consultations',
  'ordonnances':  'Ordonnances',
  'tiers-payant': 'Tiers Payant',
  'paiements':    'Paiements',
  'documents':    'Documents',
  'statistiques': 'Statistiques',
  'notifications':'Notifications',
  'parametres':   'Paramètres',
}

function useBreadcrumb() {
  const { pathname } = useLocation()
  const parts = pathname.replace(/^\/pro\/?/, '').split('/').filter(Boolean)
  return parts.map((slug, i) => ({
    label: ROUTE_LABELS[slug] ?? slug,
    href:  '/pro/' + parts.slice(0, i + 1).join('/'),
  }))
}

// ── Status indicator + toggle ─────────────────────────────────────────────────

function StatusToggle() {
  const { status, setStatus } = usePraticien()
  const cfg = STATUS_CONFIG[status]

  function next() {
    const idx = STATUS_CYCLE.indexOf(status)
    setStatus(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length])
  }

  return (
    <button
      onClick={next}
      className="flex items-center gap-s-2 rounded-pill border border-line bg-surface px-s-3 py-1.5 text-small font-medium text-ink transition-colors hover:bg-surface-2"
      title="Changer de statut"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {cfg.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.color}`} />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.color}`} />
      </span>
      <span>{cfg.label}</span>
      <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
    </button>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────

export function PraticienLayout() {
  const { praticien } = usePraticien()
  const { notifications, agenda, tiersPayant } = usePraticienBadges()
  const navigate = useNavigate()
  const breadcrumbs = useBreadcrumb()

  const nav = useMemo(() => ({
    ...PROFESSIONAL_NAV,
    links: PROFESSIONAL_NAV.links.map(l => {
      if (l.href === '/pro/notifications') return { ...l, badge: notifications || undefined }
      if (l.href === '/pro/agenda')        return { ...l, badge: agenda        || undefined }
      if (l.href === '/pro/tiers-payant')  return { ...l, badge: tiersPayant   || undefined }
      return l
    }),
  }), [notifications, agenda, tiersPayant])

  return (
    <>
      {/* Banner praticien non vérifié */}
      <AnimatePresence>
        {praticien && !praticien.is_verified && (
          <motion.div
            key="unverified-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-s-3 bg-amber-500 px-s-4 py-s-3 text-white"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-small font-medium">
              Compte en cours de vérification — certaines fonctionnalités sont limitées jusqu'à validation de votre RPPS.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre contextuelle desktop (breadcrumb + status + CTA) */}
      <div className="hidden md:flex items-center gap-s-4 border-b border-line bg-surface px-s-6 py-s-3">
        {/* Breadcrumb */}
        <nav className="flex flex-1 items-center gap-s-1 text-small text-ink-3">
          <span
            className="cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate('/pro')}
          >
            Accueil
          </span>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-s-1">
              <span>/</span>
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-ink'
                    : 'cursor-pointer hover:text-primary transition-colors'
                }
                onClick={() => i < breadcrumbs.length - 1 && navigate(crumb.href)}
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>

        {/* Status */}
        <StatusToggle />

        {/* CTA */}
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Play className="h-3.5 w-3.5" />}
          onClick={() => navigate('/pro/consultations/nouvelle')}
        >
          Démarrer consultation
        </Button>
      </div>

      <AppLayout nav={nav} />
    </>
  )
}
