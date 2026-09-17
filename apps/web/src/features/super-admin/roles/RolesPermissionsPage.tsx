import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

const ROLES = [
  'patient',
  'professional',
  'establishment_admin',
  'establishment_staff',
  'pharmacy_admin',
  'pharmacy_staff',
  'mutual_admin',
  'mutual_staff',
  'platform_admin',
  'super_admin',
]

const PERMISSION_GROUPS: { group: string; perms: string[] }[] = [
  { group: 'Rendez-vous', perms: ['appointments.read', 'appointments.write'] },
  { group: 'Ordonnances', perms: ['prescriptions.read', 'prescriptions.write'] },
  { group: 'Paiements', perms: ['payments.read', 'payments.write'] },
  { group: 'Administration', perms: ['admin.read', 'admin.write'] },
  { group: 'Super-Admin', perms: ['super.manage_admins', 'super.manage_plans', 'super.manage_settings'] },
]

const ALL_PERMS = PERMISSION_GROUPS.flatMap(g => g.perms)

// This permission cannot be removed from super_admin
const IMMUTABLE = { role: 'super_admin', permission: 'super.manage_admins' }

type Matrix = Record<string, Set<string>> // role -> Set<permission>

type RolePermRow = { role: string; permission: string }

export default function RolesPermissionsPage() {
  useAdminAudit('super-admin-roles')
  const { readOnly } = useSuperAdminContext()

  const [matrix, setMatrix] = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    ;(supabase as any)
      .from('roles_permissions')
      .select('role, permission')
      .then(({ data }: { data: RolePermRow[] | null }) => {
        const m: Matrix = {}
        for (const row of data ?? []) {
          if (!m[row.role]) m[row.role] = new Set()
          m[row.role].add(row.permission)
        }
        setMatrix(m)
        setLoading(false)
      })
  }, [])

  function isChecked(role: string, perm: string) {
    return matrix[role]?.has(perm) ?? false
  }

  function toggle(role: string, perm: string) {
    if (readOnly) return
    if (role === IMMUTABLE.role && perm === IMMUTABLE.permission) return
    setMatrix(prev => {
      const next = { ...prev }
      const set = new Set(next[role] ?? [])
      if (set.has(perm)) set.delete(perm)
      else set.add(perm)
      next[role] = set
      return next
    })
  }

  async function saveMatrix() {
    setSaving(true)
    try {
      // Build flat list of (role, permission) pairs that should be active
      const toInsert: { role: string; permission: string }[] = []
      for (const role of ROLES) {
        for (const perm of ALL_PERMS) {
          if (matrix[role]?.has(perm)) {
            toInsert.push({ role, permission: perm })
          }
        }
      }
      // Delete all then re-insert
      await (supabase as any).from('roles_permissions').delete().in('role', ROLES).in('permission', ALL_PERMS)
      if (toInsert.length > 0) {
        await (supabase as any).from('roles_permissions').insert(toInsert)
      }
      setSuccess('Matrice des permissions enregistrée.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: unknown) {
      setError((e as Error).message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="space-y-s-3">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-s-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-bold text-ink">Rôles & Permissions</h1>
          <p className="text-small text-ink-3">Matrice des droits par rôle.</p>
        </div>
        <Button variant="primary" onClick={saveMatrix} loading={saving} disabled={readOnly}>
          Enregistrer la matrice
        </Button>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      <Card className="overflow-x-auto">
        <table className="w-full text-micro border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className="border border-line px-s-2 py-s-2 text-left text-ink-2 font-medium min-w-[160px] sticky left-0 bg-surface-2 z-10">Permission</th>
              {ROLES.map(role => (
                <th key={role} className="border border-line px-s-2 py-s-2 text-center font-medium text-ink-2 min-w-[80px]">
                  <span className="block max-w-[80px] break-words text-center">{role.replace(/_/g, '­').replace(/admin/g, ' adm').trim()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map(({ group, perms }) => (
              <>
                <tr key={`group-${group}`} className="bg-surface-2">
                  <td colSpan={ROLES.length + 1} className="px-s-3 py-s-1 text-micro font-semibold text-ink-3 border border-line">
                    {group}
                  </td>
                </tr>
                {perms.map(perm => (
                  <tr key={perm} className="hover:bg-surface-2">
                    <td className="border border-line px-s-2 py-s-2 font-mono text-ink-2 sticky left-0 bg-surface z-10">
                      {perm}
                    </td>
                    {ROLES.map(role => {
                      const immutable = role === IMMUTABLE.role && perm === IMMUTABLE.permission
                      const checked = isChecked(role, perm)
                      return (
                        <td key={role} className="border border-line px-s-2 py-s-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={readOnly || immutable}
                            title={immutable ? 'Permission irréversible pour super_admin' : undefined}
                            onChange={() => toggle(role, perm)}
                            className="h-4 w-4 rounded border-line text-primary cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
