import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'

const EstablishmentDashboard = lazy(() => import('@/features/establishment/EstablishmentDashboard'))
import { AppLayout } from '@/components/layout/AppLayout'
import { ESTABLISHMENT_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

export default function EstablishmentRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={ESTABLISHMENT_NAV} />}>
        <Route index                    element={<EstablishmentDashboard />} />
        <Route path="agenda/*"          element={<ComingSoon title="Planning" />} />
        <Route path="professionnels/*"  element={<ComingSoon title="Médecins" />} />
        <Route path="chambres/*"        element={<ComingSoon title="Salles & Services" />} />
        <Route path="dossiers/*"        element={<ComingSoon title="Dossiers patients" />} />
        <Route path="statistiques"      element={<ComingSoon title="Statistiques" />} />
        <Route path="notifications"     element={<ComingSoon title="Notifications" />} />
        <Route path="parametres/*"      element={<ComingSoon title="Paramètres" />} />
        <Route path="*"                 element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
