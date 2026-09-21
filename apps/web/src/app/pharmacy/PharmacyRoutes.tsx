import { lazy, useMemo } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PHARMACY_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { PharmacyProvider } from '@/features/pharmacy/PharmacyContext'
import { PharmacyBadgesProvider, usePharmacyBadges } from '@/features/pharmacy/PharmacyBadgesContext'

const PharmacyHomePage        = lazy(() => import('@/features/pharmacy/PharmacyHomePage'))
const PharmacyOrdonnancesPage = lazy(() => import('@/features/pharmacy/PharmacyOrdonnancesPage'))
const PharmacyDispensationsPage = lazy(() => import('@/features/pharmacy/PharmacyDispensationsPage'))
const PharmacyPatientsPage    = lazy(() => import('@/features/pharmacy/PharmacyPatientsPage'))
const PharmacyStockPage       = lazy(() => import('@/features/pharmacy/PharmacyStockPage'))
const PharmacyCommandesPage   = lazy(() => import('@/features/pharmacy/PharmacyCommandesPage'))
const PharmacyPaiementsPage   = lazy(() => import('@/features/pharmacy/PharmacyPaiementsPage'))
const PharmacyDocumentsPage   = lazy(() => import('@/features/pharmacy/PharmacyDocumentsPage'))
const PharmacyNotificationsPage = lazy(() => import('@/features/pharmacy/PharmacyNotificationsPage'))
const PharmacyProfilePage     = lazy(() => import('@/features/pharmacy/PharmacyProfilePage'))
const SubscriptionPage        = lazy(() => import('@/features/billing/SubscriptionPage'))

function PharmacyAppLayout() {
  const { ordonnances, notifications, stockAlertes, commandes } = usePharmacyBadges()

  const nav = useMemo(() => ({
    ...PHARMACY_NAV,
    links: PHARMACY_NAV.links.map(l => {
      if (l.href === '/pharmacie/notifications') return { ...l, badge: notifications || undefined }
      if (l.href === '/pharmacie/ordonnances')   return { ...l, badge: ordonnances  || undefined }
      if (l.href === '/pharmacie/stock')         return { ...l, badge: stockAlertes || undefined }
      if (l.href === '/pharmacie/commandes')     return { ...l, badge: commandes    || undefined }
      return l
    }),
  }), [ordonnances, notifications, stockAlertes, commandes])

  return <AppLayout nav={nav} />
}

export default function PharmacyRoutes() {
  return (
    <PharmacyProvider>
      <PharmacyBadgesProvider>
        <Routes>
          <Route element={<PharmacyAppLayout />}>
            <Route index                        element={<PharmacyHomePage />} />
            <Route path="ordonnances/*"         element={<PharmacyOrdonnancesPage />} />
            <Route path="dispensations/*"       element={<PharmacyDispensationsPage />} />
            <Route path="patients/*"            element={<PharmacyPatientsPage />} />
            <Route path="stock/*"               element={<PharmacyStockPage />} />
            <Route path="commandes/*"           element={<PharmacyCommandesPage />} />
            <Route path="paiements/*"           element={<PharmacyPaiementsPage />} />
            <Route path="documents/*"           element={<PharmacyDocumentsPage />} />
            <Route path="notifications"         element={<PharmacyNotificationsPage />} />
            <Route path="pharmacie/*"           element={<PharmacyProfilePage />} />
            <Route path="abonnement"            element={<SubscriptionPage />} />
            <Route path="*"                     element={<ComingSoon title="Page introuvable" />} />
          </Route>
        </Routes>
      </PharmacyBadgesProvider>
    </PharmacyProvider>
  )
}
