import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PROFESSIONAL_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

export default function ProfessionalRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={PROFESSIONAL_NAV} />}>
        <Route index                     element={<ComingSoon title="Aujourd'hui" />} />
        <Route path="agenda/*"           element={<ComingSoon title="Agenda" />} />
        <Route path="patients/*"         element={<ComingSoon title="Mes patients" />} />
        <Route path="ordonnances/*"      element={<ComingSoon title="Ordonnances" />} />
        <Route path="consultations/*"    element={<ComingSoon title="Consultations" />} />
        <Route path="teleconsultation/*" element={<ComingSoon title="Téléconsultation" />} />
        <Route path="revenus/*"          element={<ComingSoon title="Revenus" />} />
        <Route path="notifications"      element={<ComingSoon title="Notifications" />} />
        <Route path="parametres/*"       element={<ComingSoon title="Paramètres" />} />
        <Route path="*"                  element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
