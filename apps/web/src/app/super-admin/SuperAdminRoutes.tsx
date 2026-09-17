import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SuperAdminLayout } from '@/features/super-admin/SuperAdminLayout'
import { Skeleton } from '@/components/ui/Skeleton'

const AnalyticsPage             = lazy(() => import('@/features/super-admin/analytics/AnalyticsPage'))
const PlatformSettingsPage      = lazy(() => import('@/features/super-admin/settings/PlatformSettingsPage'))
const PlansPage                 = lazy(() => import('@/features/super-admin/billing/PlansPage'))
const PromoCodesPage            = lazy(() => import('@/features/super-admin/promo/PromoCodesPage'))
const PaymentProvidersPage      = lazy(() => import('@/features/super-admin/payments/PaymentProvidersPage'))
const NotificationTemplatesPage = lazy(() => import('@/features/super-admin/notifications/NotificationTemplatesAdminPage'))
const RolesPermissionsPage      = lazy(() => import('@/features/super-admin/roles/RolesPermissionsPage'))
const AdminsPage                = lazy(() => import('@/features/super-admin/admins/AdminsPage'))
const CreditsPage               = lazy(() => import('@/features/super-admin/credits/CreditsPage'))
const IntegrationsPage          = lazy(() => import('@/features/super-admin/integrations/IntegrationsPage'))

function PageLoader() {
  return (
    <div className="space-y-s-4 p-s-6">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
    </div>
  )
}

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        {/* Default: redirect to analytics */}
        <Route index element={<Navigate to="analytics" replace />} />

        <Route path="analytics"
          element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
        <Route path="parametres"
          element={<Suspense fallback={<PageLoader />}><PlatformSettingsPage /></Suspense>} />
        <Route path="plans"
          element={<Suspense fallback={<PageLoader />}><PlansPage /></Suspense>} />
        <Route path="promo"
          element={<Suspense fallback={<PageLoader />}><PromoCodesPage /></Suspense>} />
        <Route path="paiements-config"
          element={<Suspense fallback={<PageLoader />}><PaymentProvidersPage /></Suspense>} />
        <Route path="notifications-config"
          element={<Suspense fallback={<PageLoader />}><NotificationTemplatesPage /></Suspense>} />
        <Route path="roles"
          element={<Suspense fallback={<PageLoader />}><RolesPermissionsPage /></Suspense>} />
        <Route path="admins"
          element={<Suspense fallback={<PageLoader />}><AdminsPage /></Suspense>} />
        <Route path="credits"
          element={<Suspense fallback={<PageLoader />}><CreditsPage /></Suspense>} />
        <Route path="integrations"
          element={<Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense>} />

        {/* Legacy routes kept as redirects */}
        <Route path="migrations/*"  element={<Navigate to="/super-admin/analytics" replace />} />
        <Route path="permissions/*" element={<Navigate to="/super-admin/roles" replace />} />
        <Route path="platform/*"    element={<Navigate to="/super-admin/parametres" replace />} />
        <Route path="*"             element={<Navigate to="/super-admin/analytics" replace />} />
      </Route>
    </Routes>
  )
}
