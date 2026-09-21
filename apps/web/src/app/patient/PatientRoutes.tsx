import { lazy, useMemo } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PATIENT_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { PatientBadgesProvider, usePatientBadges } from '@/features/patient/PatientBadgesContext'
import PatientHome from '@/features/patient/PatientHome'

const SearchPage              = lazy(() => import('@/features/patient/SearchPage'))
const ProfessionalProfilePage = lazy(() => import('@/features/patient/ProfessionalProfilePage'))
const BookAppointmentPage     = lazy(() => import('@/features/patient/BookAppointmentPage'))
const AppointmentsPage        = lazy(() => import('@/features/patient/AppointmentsPage'))
const OrdonnancesPage         = lazy(() => import('@/features/patient/OrdonnancesPage'))
const PrescriptionPage        = lazy(() => import('@/features/patient/PrescriptionPage'))
const ReservationPage         = lazy(() => import('@/features/patient/ReservationPage'))
const MedicinesPage           = lazy(() => import('@/features/patient/MedicinesPage'))
const FamilyPage              = lazy(() => import('@/features/patient/FamilyPage'))
const DocumentsPage           = lazy(() => import('@/features/patient/DocumentsPage'))
const HistoryPage             = lazy(() => import('@/features/patient/HistoryPage'))
const NotificationsPage       = lazy(() => import('@/features/notifications/NotificationsPage'))

function PatientAppLayout() {
  const { notifications, invoices } = usePatientBadges()

  const nav = useMemo(() => ({
    ...PATIENT_NAV,
    links: PATIENT_NAV.links.map(l => {
      if (l.href === '/patient/notifications') return { ...l, badge: notifications || undefined }
      if (l.href === '/patient/paiements')     return { ...l, badge: invoices || undefined }
      return l
    }),
  }), [notifications, invoices])

  return <AppLayout nav={nav} />
}

export default function PatientRoutes() {
  return (
    <PatientBadgesProvider>
      <Routes>
        <Route element={<PatientAppLayout />}>
          <Route index                             element={<PatientHome />} />
          <Route path="recherche"                  element={<SearchPage />} />
          <Route path="pro/:professionalId"        element={<ProfessionalProfilePage />} />
          <Route path="rdv/nouveau"                element={<BookAppointmentPage />} />
          <Route path="rendez-vous"                element={<AppointmentsPage />} />
          <Route path="ordonnances/:prescriptionId" element={<PrescriptionPage />} />
          <Route path="ordonnances"                element={<OrdonnancesPage />} />
          <Route path="medicaments"                element={<MedicinesPage />} />
          <Route path="reservations"               element={<ReservationPage />} />
          <Route path="reserver"                   element={<ReservationPage />} />
          <Route path="pharmacie/*"                element={<ReservationPage />} />
          <Route path="mutuelle/*"                 element={<ComingSoon title="Ma mutuelle" />} />
          <Route path="paiements/*"                element={<ComingSoon title="Paiements" />} />
          <Route path="documents"                  element={<DocumentsPage />} />
          <Route path="famille"                    element={<FamilyPage />} />
          <Route path="historique"                 element={<HistoryPage />} />
          <Route path="notifications"              element={<NotificationsPage />} />
          <Route path="profil/*"                   element={<ComingSoon title="Mon profil" />} />
          <Route path="*"                          element={<ComingSoon title="Page introuvable" />} />
        </Route>
      </Routes>
    </PatientBadgesProvider>
  )
}
