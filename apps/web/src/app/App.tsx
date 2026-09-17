import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { RequireAuth, RequireRole, Require2FA } from '@/features/auth/guards'
import { OfflineBanner } from '@/components/ui/OfflineBanner'

// Espaces lazy-loaded (7 bundles)
const PublicRoutes        = lazy(() => import('./public/PublicRoutes'))
const DesignSystemPage    = lazy(() => import('@/features/dev/DesignSystemPage'))
const PatientRoutes       = lazy(() => import('./patient/PatientRoutes'))
const ProfessionalRoutes  = lazy(() => import('./professional/ProfessionalRoutes'))
const EstablishmentRoutes = lazy(() => import('./establishment/EstablishmentRoutes'))
const PharmacyRoutes      = lazy(() => import('./pharmacy/PharmacyRoutes'))
const MutualRoutes        = lazy(() => import('./mutual/MutualRoutes'))
const AdminRoutes         = lazy(() => import('./admin/AdminRoutes'))
const SuperAdminRoutes    = lazy(() => import('./super-admin/SuperAdminRoutes'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 animate-spin rounded-pill border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) return <LoadingFallback />

  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Design system — dev uniquement */}
          {import.meta.env.DEV && (
            <Route path="/dev/design-system" element={<DesignSystemPage />} />
          )}

          {/* Landing, blog, pages légales, auth, invitations */}
          <Route path="/*" element={<PublicRoutes />} />

          {/* ── Espaces authentifiés ── */}
          <Route path="/patient/*" element={
            <RequireAuth>
              <RequireRole roles={['patient']}>
                <PatientRoutes />
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/pro/*" element={
            <RequireAuth>
              <RequireRole roles={['professional']}>
                <ProfessionalRoutes />
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/etablissement/*" element={
            <RequireAuth>
              <RequireRole roles={['establishment_admin', 'establishment_staff']}>
                <EstablishmentRoutes />
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/pharmacie/*" element={
            <RequireAuth>
              <RequireRole roles={['pharmacy_admin', 'pharmacy_staff']}>
                <PharmacyRoutes />
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/mutuelle/*" element={
            <RequireAuth>
              <RequireRole roles={['mutual_admin', 'mutual_staff']}>
                <MutualRoutes />
              </RequireRole>
            </RequireAuth>
          } />

          {/* Routes admin — 2FA obligatoire */}
          <Route path="/admin/*" element={
            <RequireAuth>
              <RequireRole roles={['platform_admin', 'super_admin']}>
                <Require2FA>
                  <AdminRoutes />
                </Require2FA>
              </RequireRole>
            </RequireAuth>
          } />

          <Route path="/super-admin/*" element={
            <RequireAuth>
              <RequireRole roles={['super_admin']}>
                <Require2FA>
                  <SuperAdminRoutes />
                </Require2FA>
              </RequireRole>
            </RequireAuth>
          } />

          {/* Catchall */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
