import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { AdminLayout } from '@/features/admin/AdminLayout'
import { Banner } from '@/components/ui/Banner'

// ─────────────────────────────────────────────────────────────
// SuperAdminContext
// ─────────────────────────────────────────────────────────────
interface SuperAdminContextValue {
  /** true when viewer is platform_admin (read-only), false for super_admin */
  readOnly: boolean
}

const SuperAdminCtx = createContext<SuperAdminContextValue>({ readOnly: false })

export const useSuperAdminContext = () => useContext(SuperAdminCtx)

// ─────────────────────────────────────────────────────────────
// SuperAdminLayout
// Both super_admin and platform_admin can enter; platform_admin
// gets readOnly=true + a warning banner; write buttons should
// check useSuperAdminContext().readOnly before rendering.
// ─────────────────────────────────────────────────────────────
export function SuperAdminLayout() {
  const { profile } = useAuth()
  const role = profile?.role as string | undefined
  const readOnly = role === 'platform_admin'

  const headerBanner: ReactNode = readOnly ? (
    <div className="sticky top-0 z-30">
      <Banner kind="warning">
        Lecture seule — réservé au Super Admin. Les modifications sont désactivées pour votre rôle.
      </Banner>
    </div>
  ) : null

  return (
    <SuperAdminCtx.Provider value={{ readOnly }}>
      <AdminLayout
        allowedRoles={['platform_admin', 'super_admin']}
        headerBanner={headerBanner}
      />
    </SuperAdminCtx.Provider>
  )
}
