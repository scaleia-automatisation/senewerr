import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PATIENT_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'
import PatientHome from '@/features/patient/PatientHome'

const SearchPage             = lazy(() => import('@/features/patient/SearchPage'))
const ProfessionalProfilePage = lazy(() => import('@/features/patient/ProfessionalProfilePage'))
const BookAppointmentPage    = lazy(() => import('@/features/patient/BookAppointmentPage'))
const AppointmentsPage       = lazy(() => import('@/features/patient/AppointmentsPage'))
const PrescriptionPage       = lazy(() => import('@/features/patient/PrescriptionPage'))
const ReservationPage        = lazy(() => import('@/features/patient/ReservationPage'))
const MedicinesPage          = lazy(() => import('@/features/patient/MedicinesPage'))
const FamilyPage             = lazy(() => import('@/features/patient/FamilyPage'))
const DocumentsPage          = lazy(() => import('@/features/patient/DocumentsPage'))
const HistoryPage            = lazy(() => import('@/features/patient/HistoryPage'))

export default function PatientRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={PATIENT_NAV} />}>
        <Route index                        element={<PatientHome />} />
        <Route path="recherche"             element={<SearchPage />} />
        <Route path="pro/:professionalId"   element={<ProfessionalProfilePage />} />
        <Route path="rdv/nouveau"           element={<BookAppointmentPage />} />
        <Route path="rendez-vous"           element={<AppointmentsPage />} />
        <Route path="ordonnances/:prescriptionId" element={<PrescriptionPage />} />
        <Route path="ordonnances"           element={<ComingSoon title="Mes ordonnances" />} />
        <Route path="medicaments"           element={<MedicinesPage />} />
        <Route path="reserver"              element={<ReservationPage />} />
        <Route path="pharmacie/*"           element={<ComingSoon title="Réservations" />} />
        <Route path="mutuelle/*"            element={<ComingSoon title="Ma mutuelle" />} />
        <Route path="paiements/*"           element={<ComingSoon title="Paiements" />} />
        <Route path="documents"             element={<DocumentsPage />} />
        <Route path="famille"               element={<FamilyPage />} />
        <Route path="historique"            element={<HistoryPage />} />
        <Route path="notifications"         element={<ComingSoon title="Notifications" />} />
        <Route path="profil/*"              element={<ComingSoon title="Mon profil" />} />
        <Route path="*"                     element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
