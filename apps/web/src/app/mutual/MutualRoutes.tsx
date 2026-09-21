import { lazy, useMemo } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MUTUAL_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { MutuelleProvider, useMutuelle } from '@/features/mutuelle/MutuelleContext'
import { MutuelleBadgesProvider, useMutuelleBadges } from '@/features/mutuelle/MutuelleBadgesContext'

// ── Pages lazy ───────────────────────────────────────────────────────────────
const MutuelleHomePage        = lazy(() => import('@/features/mutuelle/MutuelleHomePage'))
const MutuelleAdhérentsPage   = lazy(() => import('@/features/mutuelle/MutuelleAdhérentsPage'))
const MutuelleDemandesPage    = lazy(() => import('@/features/mutuelle/MutuelleDemandesPage'))
const MutuelleContratsPage    = lazy(() => import('@/features/mutuelle/MutuelleContratsPage'))
const MutuelleCotisationsPage = lazy(() => import('@/features/mutuelle/MutuelleCotisationsPage'))
const MutuelleTiersPayantPage = lazy(() => import('@/features/mutuelle/MutuelleTiersPayantPage'))
const MutuellePaiementsPage   = lazy(() => import('@/features/mutuelle/MutuellePaiementsPage'))
const MutuelleDocumentsPage   = lazy(() => import('@/features/mutuelle/MutuelleDocumentsPage'))
const MutuelleStatistiquesPage = lazy(() => import('@/features/mutuelle/MutuelleStatistiquesPage'))
const MutuelleNotificationsPage = lazy(() => import('@/features/mutuelle/MutuelleNotificationsPage'))
const MutuelleParametresPage  = lazy(() => import('@/features/mutuelle/MutuelleParametresPage'))

// ── Layout avec badges Realtime + banner suspension ──────────────────────────

function MutuelleAppLayout() {
  const { notifications, demandes, tiersPayant } = useMutuelleBadges()
  const { mutuelle } = useMutuelle()

  const nav = useMemo(() => ({
    ...MUTUAL_NAV,
    links: MUTUAL_NAV.links.map(l => {
      if (l.href === '/mutuelle/notifications') return { ...l, badge: notifications || undefined }
      if (l.href === '/mutuelle/demandes')      return { ...l, badge: demandes      || undefined }
      if (l.href === '/mutuelle/tiers-payant')  return { ...l, badge: tiersPayant   || undefined }
      return l
    }),
  }), [notifications, demandes, tiersPayant])

  return (
    <>
      {/* Banner suspension mutuelle */}
      {mutuelle?.statut === 'suspendue' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="flex items-center gap-s-3 bg-red-600 px-s-4 py-s-3 text-white"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-small font-medium">
            Mutuelle suspendue
            {mutuelle.suspension_raison && (
              <> — <span className="font-normal">{mutuelle.suspension_raison}</span></>
            )}
          </p>
        </motion.div>
      )}
      <AppLayout nav={nav} />
    </>
  )
}

// ── Routes ───────────────────────────────────────────────────────────────────

export default function MutualRoutes() {
  return (
    <MutuelleProvider>
      <MutuelleBadgesProvider>
        <Routes>
          <Route element={<MutuelleAppLayout />}>
            <Route index                       element={<MutuelleHomePage />} />
            <Route path="adherents/*"          element={<MutuelleAdhérentsPage />} />
            <Route path="demandes/*"           element={<MutuelleDemandesPage />} />
            <Route path="contrats/*"           element={<MutuelleContratsPage />} />
            <Route path="cotisations/*"        element={<MutuelleCotisationsPage />} />
            <Route path="tiers-payant/*"       element={<MutuelleTiersPayantPage />} />
            <Route path="paiements/*"          element={<MutuellePaiementsPage />} />
            <Route path="documents/*"          element={<MutuelleDocumentsPage />} />
            <Route path="statistiques/*"       element={<MutuelleStatistiquesPage />} />
            <Route path="notifications"        element={<MutuelleNotificationsPage />} />
            <Route path="parametres/*"         element={<MutuelleParametresPage />} />
            {/* Compat anciens chemins */}
            <Route path="prises-en-charge/*"   element={<MutuelleDemandesPage />} />
            <Route path="membres/*"            element={<MutuelleAdhérentsPage />} />
            <Route path="regles/*"             element={<ComingSoon title="Règles de couverture" />} />
            <Route path="*"                    element={<ComingSoon title="Page introuvable" />} />
          </Route>
        </Routes>
      </MutuelleBadgesProvider>
    </MutuelleProvider>
  )
}
