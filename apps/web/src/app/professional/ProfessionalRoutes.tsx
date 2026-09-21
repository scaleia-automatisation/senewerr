import { lazy, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { PraticienProvider } from '@/features/professional/PraticienContext'
import { PraticienBadgesProvider } from '@/features/professional/PraticienBadgesContext'
import { PraticienLayout } from '@/features/professional/PraticienLayout'
import { useAuth } from '@/features/auth/useAuth'

// ── Pages lazy ────────────────────────────────────────────────────────────────
const ProfessionalDashboard = lazy(() => import('@/features/professional/ProfessionalDashboard'))
const AgendaPage             = lazy(() => import('@/features/professional/AgendaPage'))
const PatientsPage           = lazy(() => import('@/features/professional/PatientsPage'))
const DossierPatientPage     = lazy(() => import('@/features/professional/DossierPatientPage'))
const ConsultationPage       = lazy(() => import('@/features/professional/ConsultationPage'))
const ConsultationsListPage  = lazy(() => import('@/features/professional/ConsultationsListPage'))
const NewPrescriptionPage    = lazy(() => import('@/features/professional/NewPrescriptionPage'))
const SubscriptionPage       = lazy(() => import('@/features/billing/SubscriptionPage'))

// ── Route guard ───────────────────────────────────────────────────────────────
function ProfessionalGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  if (profile && profile.role !== 'professional') {
    return <Navigate to="/unauthorized" replace />
  }
  return <>{children}</>
}

// ── Routes ────────────────────────────────────────────────────────────────────
export default function ProfessionalRoutes() {
  return (
    <ProfessionalGuard>
      <PraticienProvider>
        <PraticienBadgesProvider>
          <Routes>
            <Route element={<PraticienLayout />}>
              <Route index                              element={<ProfessionalDashboard />} />
              <Route path="agenda"                      element={<AgendaPage />} />
              <Route path="consultation/:appointmentId" element={<ConsultationPage />} />
              <Route path="consultations/nouvelle"      element={<ConsultationPage />} />
              <Route path="ordonnances/nouvelle"        element={<NewPrescriptionPage />} />
              <Route path="patients" index              element={<PatientsPage />} />
              <Route path="patients/:id"              element={<DossierPatientPage />} />
              <Route path="ordonnances/*"               element={<ComingSoon title="Ordonnances" />} />
              <Route path="consultations"               element={<ConsultationsListPage />} />
              <Route path="tiers-payant/*"              element={<ComingSoon title="Tiers Payant" />} />
              <Route path="paiements/*"                 element={<ComingSoon title="Paiements" />} />
              <Route path="documents/*"                 element={<ComingSoon title="Documents" />} />
              <Route path="statistiques/*"              element={<ComingSoon title="Statistiques" />} />
              <Route path="notifications"               element={<ComingSoon title="Notifications" />} />
              <Route path="abonnement"                  element={<SubscriptionPage />} />
              <Route path="parametres/*"                element={<ComingSoon title="Paramètres" />} />
              {/* Compatibilité ancien chemin */}
              <Route path="revenus/*"                   element={<Navigate to="/pro/paiements" replace />} />
              <Route path="teleconsultation/*"          element={<ComingSoon title="Téléconsultation" />} />
              <Route path="*"                           element={<ComingSoon title="Page introuvable" />} />
            </Route>
          </Routes>
        </PraticienBadgesProvider>
      </PraticienProvider>
    </ProfessionalGuard>
  )
}
