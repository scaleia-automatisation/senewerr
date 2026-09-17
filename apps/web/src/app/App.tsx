import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

// Espaces lazy-loaded (7 bundles)
const PublicRoutes     = lazy(() => import('./public/PublicRoutes'))
const PatientRoutes    = lazy(() => import('./patient/PatientRoutes'))
const ProfessionalRoutes = lazy(() => import('./professional/ProfessionalRoutes'))
const EstablishmentRoutes = lazy(() => import('./establishment/EstablishmentRoutes'))
const PharmacyRoutes   = lazy(() => import('./pharmacy/PharmacyRoutes'))
const MutualRoutes     = lazy(() => import('./mutual/MutualRoutes'))
const AdminRoutes      = lazy(() => import('./admin/AdminRoutes'))
const SuperAdminRoutes = lazy(() => import('./super-admin/SuperAdminRoutes'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
    </div>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) return <LoadingFallback />

  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Landing, blog, pages légales, auth */}
          <Route path="/*" element={<PublicRoutes />} />

          {/* Espaces authentifiés */}
          {session && profile ? (
            <>
              <Route path="/patient/*" element={
                profile.role === 'patient'
                  ? <PatientRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/pro/*" element={
                profile.role === 'professional'
                  ? <ProfessionalRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/etablissement/*" element={
                ['establishment_admin','establishment_staff'].includes(profile.role)
                  ? <EstablishmentRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/pharmacie/*" element={
                ['pharmacy_admin','pharmacy_staff'].includes(profile.role)
                  ? <PharmacyRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/mutuelle/*" element={
                ['mutual_admin','mutual_staff'].includes(profile.role)
                  ? <MutualRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/admin/*" element={
                ['platform_admin','super_admin'].includes(profile.role)
                  ? <AdminRoutes />
                  : <Navigate to="/" replace />
              } />
              <Route path="/super-admin/*" element={
                profile.role === 'super_admin'
                  ? <SuperAdminRoutes />
                  : <Navigate to="/" replace />
              } />
            </>
          ) : null}
        </Routes>
      </Suspense>
    </>
  )
}
