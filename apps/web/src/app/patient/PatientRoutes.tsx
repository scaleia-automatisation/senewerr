import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PATIENT_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'
import PatientHome from '@/features/patient/PatientHome'

export default function PatientRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={PATIENT_NAV} />}>
        <Route index                element={<PatientHome />} />
        <Route path="rendez-vous/*" element={<ComingSoon title="Mes rendez-vous" />} />
        <Route path="ordonnances/*" element={<ComingSoon title="Mes ordonnances" />} />
        <Route path="pharmacie/*"   element={<ComingSoon title="Réservations" />} />
        <Route path="mutuelle/*"    element={<ComingSoon title="Ma mutuelle" />} />
        <Route path="paiements/*"   element={<ComingSoon title="Paiements" />} />
        <Route path="documents/*"   element={<ComingSoon title="Documents" />} />
        <Route path="famille/*"     element={<ComingSoon title="Famille" />} />
        <Route path="notifications" element={<ComingSoon title="Notifications" />} />
        <Route path="profil/*"      element={<ComingSoon title="Mon profil" />} />
        <Route path="*"             element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
