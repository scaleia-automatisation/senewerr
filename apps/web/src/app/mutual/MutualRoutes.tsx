import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { MUTUAL_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

const InsuranceDashboard    = lazy(() => import('@/features/insurance/InsuranceDashboard'))
const InsuranceRequestsPage = lazy(() => import('@/features/insurance/InsuranceRequestsPage'))
const InsuranceMembersPage  = lazy(() => import('@/features/insurance/InsuranceMembersPage'))

export default function MutualRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={MUTUAL_NAV} />}>
        <Route index                      element={<InsuranceDashboard />} />
        <Route path="prises-en-charge"    element={<InsuranceRequestsPage />} />
        <Route path="membres"             element={<InsuranceMembersPage />} />
        <Route path="paiements/*"         element={<ComingSoon title="Paiements" />} />
        <Route path="regles/*"            element={<ComingSoon title="Règles de couverture" />} />
        <Route path="statistiques"        element={<ComingSoon title="Statistiques" />} />
        <Route path="notifications"       element={<ComingSoon title="Notifications" />} />
        <Route path="parametres/*"        element={<ComingSoon title="Paramètres" />} />
        <Route path="*"                   element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
