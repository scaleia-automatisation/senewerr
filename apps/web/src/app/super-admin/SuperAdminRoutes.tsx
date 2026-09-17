import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { SUPER_ADMIN_NAV } from '@/config/navigation'
import { ComingSoon } from '@/components/layout/ComingSoon'

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout nav={SUPER_ADMIN_NAV} />}>
        <Route index                element={<ComingSoon title="Console" />} />
        <Route path="migrations/*"  element={<ComingSoon title="Migrations" />} />
        <Route path="permissions/*" element={<ComingSoon title="Permissions" />} />
        <Route path="analytics"     element={<ComingSoon title="Analytics" />} />
        <Route path="platform/*"    element={<ComingSoon title="Paramètres plateforme" />} />
        <Route path="aide"          element={<ComingSoon title="Aide" />} />
        <Route path="*"             element={<ComingSoon title="Page introuvable" />} />
      </Route>
    </Routes>
  )
}
