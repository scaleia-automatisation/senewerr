import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { ETAB_HEALTH_NAV } from '@/config/navigation'
import { EtabHealthProvider } from '@/features/establishment/EtabHealthContext'

const EtabHealthDashboard = lazy(() => import('@/features/establishment/EtabHealthDashboard'))

export default function EtabHealthRoutes() {
  return (
    <EtabHealthProvider>
      <Routes>
        <Route element={<AppLayout nav={ETAB_HEALTH_NAV} />}>
          <Route index                       element={<EtabHealthDashboard />} />
          <Route path="patients/*"           element={<ComingSoon title="Patients" />} />
          <Route path="examens/*"            element={<ComingSoon title="Examens" />} />
          <Route path="dossiers/*"           element={<ComingSoon title="Dossiers" />} />
          <Route path="equipe/*"             element={<ComingSoon title="Équipe" />} />
          <Route path="pharmacie/*"          element={<ComingSoon title="Pharmacie interne" />} />
          <Route path="statistiques"         element={<ComingSoon title="Statistiques" />} />
          <Route path="notifications"        element={<ComingSoon title="Notifications" />} />
          <Route path="parametres/*"         element={<ComingSoon title="Paramètres" />} />
          <Route path="*"                    element={<ComingSoon title="Page introuvable" />} />
        </Route>
      </Routes>
    </EtabHealthProvider>
  )
}
