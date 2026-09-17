import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ADMIN_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={ADMIN_NAV} />}>
        <Route index                    element={<ComingSoon title="À traiter" />} />
        <Route path="utilisateurs/*"    element={<ComingSoon title="Acteurs" />} />
        <Route path="etablissements/*"  element={<ComingSoon title="Rendez-vous" />} />
        <Route path="pharmacies/*"      element={<ComingSoon title="Commandes" />} />
        <Route path="abonnements/*"     element={<ComingSoon title="Paiements" />} />
        <Route path="verifications/*"   element={<ComingSoon title="Vérifications" />} />
        <Route path="litiges/*"         element={<ComingSoon title="Litiges" />} />
        <Route path="statistiques"      element={<ComingSoon title="Analytics" />} />
        <Route path="parametres/*"      element={<ComingSoon title="Paramètres" />} />
        <Route path="*"                 element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
