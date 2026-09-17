import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { ComingSoon } from '@/components/layout/ComingSoon'
import { Skeleton } from '@/components/ui/Skeleton'

const AdminDashboard            = lazy(() => import('@/features/admin/AdminDashboard'))
const ActorsPage                = lazy(() => import('@/features/admin/actors/ActorsPage'))
const ActorDetail               = lazy(() => import('@/features/admin/actors/ActorDetail'))
const OrdersPage                = lazy(() => import('@/features/admin/orders/OrdersPage'))
const OrderDetail               = lazy(() => import('@/features/admin/orders/OrderDetail'))
const AppointmentsAdminPage     = lazy(() => import('@/features/admin/appointments/AppointmentsAdminPage'))
const PaymentsAdminPage         = lazy(() => import('@/features/admin/payments/PaymentsAdminPage'))
const DisputesPage              = lazy(() => import('@/features/admin/disputes/DisputesPage'))
const FlaggedPrescriptionsPage  = lazy(() => import('@/features/admin/prescriptions/FlaggedPrescriptionsPage'))
const ContentPage               = lazy(() => import('@/features/admin/content/ContentPage'))
const AiCostPage                = lazy(() => import('@/features/admin/ai/AiCostPage'))
const AuditPage                 = lazy(() => import('@/features/admin/audit/AuditPage'))
const SecurityPage              = lazy(() => import('@/features/admin/security/SecurityPage'))
const GlobalSearchPage          = lazy(() => import('@/features/admin/search/GlobalSearchPage'))

const Loader = () => <div className="p-s-6"><Skeleton className="h-64 rounded-lg" /></div>

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Suspense fallback={<Loader />}><AdminDashboard /></Suspense>} />
        {/* Acteurs */}
        <Route path="acteurs"         element={<Suspense fallback={<Loader />}><ActorsPage /></Suspense>} />
        <Route path="acteurs/:type/:id" element={<Suspense fallback={<Loader />}><ActorDetail /></Suspense>} />
        {/* Commandes */}
        <Route path="commandes"       element={<Suspense fallback={<Loader />}><OrdersPage /></Suspense>} />
        <Route path="commandes/:id"   element={<Suspense fallback={<Loader />}><OrderDetail /></Suspense>} />
        {/* Rendez-vous */}
        <Route path="rendez-vous"     element={<Suspense fallback={<Loader />}><AppointmentsAdminPage /></Suspense>} />
        {/* Paiements */}
        <Route path="paiements"       element={<Suspense fallback={<Loader />}><PaymentsAdminPage /></Suspense>} />
        {/* Litiges */}
        <Route path="litiges"         element={<Suspense fallback={<Loader />}><DisputesPage /></Suspense>} />
        {/* Ordonnances signalées */}
        <Route path="ordonnances-signalees" element={<Suspense fallback={<Loader />}><FlaggedPrescriptionsPage /></Suspense>} />
        {/* Contenu */}
        <Route path="contenu"         element={<Suspense fallback={<Loader />}><ContentPage /></Suspense>} />
        {/* Coût IA */}
        <Route path="ia"              element={<Suspense fallback={<Loader />}><AiCostPage /></Suspense>} />
        {/* Audit */}
        <Route path="audit"           element={<Suspense fallback={<Loader />}><AuditPage /></Suspense>} />
        {/* Sécurité */}
        <Route path="securite"        element={<Suspense fallback={<Loader />}><SecurityPage /></Suspense>} />
        {/* Recherche globale */}
        <Route path="recherche"       element={<Suspense fallback={<Loader />}><GlobalSearchPage /></Suspense>} />
        {/* Legacy aliases */}
        <Route path="utilisateurs/*"  element={<ComingSoon title="Acteurs" />} />
        <Route path="etablissements/*" element={<ComingSoon title="Établissements" />} />
        <Route path="pharmacies/*"    element={<ComingSoon title="Pharmacies" />} />
        <Route path="abonnements/*"   element={<ComingSoon title="Paiements" />} />
        <Route path="verifications/*" element={<ComingSoon title="Vérifications" />} />
        <Route path="statistiques"    element={<ComingSoon title="Analytics" />} />
        <Route path="parametres/*"    element={<ComingSoon title="Paramètres" />} />
        <Route path="*"               element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
