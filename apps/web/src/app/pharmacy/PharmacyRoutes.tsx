import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PHARMACY_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

export default function PharmacyRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={PHARMACY_NAV} />}>
        <Route index                  element={<ComingSoon title="À faire" />} />
        <Route path="reservations/*"  element={<ComingSoon title="Commandes" />} />
        <Route path="ordonnances/*"   element={<ComingSoon title="Ordonnances" />} />
        <Route path="stock/*"         element={<ComingSoon title="Catalogue" />} />
        <Route path="finances/*"      element={<ComingSoon title="Finances" />} />
        <Route path="statistiques"    element={<ComingSoon title="Statistiques" />} />
        <Route path="notifications"   element={<ComingSoon title="Notifications" />} />
        <Route path="parametres/*"    element={<ComingSoon title="Paramètres" />} />
        <Route path="*"               element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
