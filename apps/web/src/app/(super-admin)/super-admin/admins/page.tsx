import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { User, Plus, Shield, Lock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gestion des admins — Super Admin' }

// Spec 22.3 — gestion des comptes administrateurs et de leurs permissions
const AVAILABLE_PERMISSIONS = [
  { key: 'admin_comptes', label: 'Admin des comptes', desc: "Validation et gestion des inscriptions" },
  { key: 'admin_paiements', label: 'Admin des paiements', desc: "Suivi et réconciliation des paiements" },
  { key: 'admin_support', label: 'Admin du support', desc: "Litiges, réclamations, incidents" },
  { key: 'admin_etablissements', label: 'Admin des établissements', desc: "Validation et gestion des établissements" },
  { key: 'admin_pharmacies', label: 'Admin des pharmacies', desc: "Validation et gestion des pharmacies" },
  { key: 'admin_couverture', label: 'Admin de la couverture', desc: "Supervision des prises en charge" },
  { key: 'admin_reporting', label: 'Admin reporting', desc: "Accès aux indicateurs agrégés" },
]

type AdminAccount = {
  id: string; email: string | null; full_name: string | null
  actor_type: string[]; admin_permissions: string[] | null
  status: string | null; created_at: string
}

// Spec 22.3 — mise à jour des permissions d'un admin
async function updateAdminPermissions(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Spec 22.3 — un admin ne peut pas modifier ses propres permissions
  const targetId = formData.get('target_id') as string
  if (targetId === user.id) return

  const permissions = formData.getAll('permissions') as string[]

  type UpdateFn = { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
  await (supabase.from('profiles') as unknown as UpdateFn)
    .update({ admin_permissions: permissions })
    .eq('id', targetId)

  type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertFn).insert({
    event_type: 'admin.permissions_updated',
    actor_type: 'super_admin',
    object_type: 'profile',
    object_id: targetId,
    result: 'success',
    category: 'compte',
    metadata: { permissions },
  })

  revalidatePath('/super-admin/admins')
}

// Spec 22.3 — créer un compte admin (attribue le rôle admin à un profil existant)
async function createAdmin(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const profileId = formData.get('profile_id') as string
  const permissions = formData.getAll('new_permissions') as string[]
  if (!profileId) return

  const { data: existing } = await supabase.from('profiles').select('actor_type').eq('id', profileId).maybeSingle()
  const existingTypes = (existing as unknown as { actor_type: string[] } | null)?.actor_type ?? []
  const updatedTypes = Array.from(new Set([...existingTypes, 'admin']))

  type UpdateFn = { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
  await (supabase.from('profiles') as unknown as UpdateFn)
    .update({ actor_type: updatedTypes, admin_permissions: permissions, status: 'active' })
    .eq('id', profileId)

  type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertFn).insert({
    event_type: 'admin.created',
    actor_type: 'super_admin',
    object_type: 'profile',
    object_id: profileId,
    result: 'success',
    category: 'compte',
    metadata: { permissions },
  })

  revalidatePath('/super-admin/admins')
}

export default async function SuperAdminAdminsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  type FetchFn = {
    select: (q: string) => {
      in: (c: string, v: string[]) => Promise<{ data: unknown[] | null }>
    }
  }
  const { data: rawAdmins } = await (supabase.from('profiles') as unknown as FetchFn)
    .select('id, email, full_name, actor_type, admin_permissions, status, created_at')
    .in('actor_type', ['admin', 'super_admin'])

  const admins = (rawAdmins ?? []) as unknown as AdminAccount[]

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Gestion des administrateurs</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 22.3 — création, permissions, périmètre d'action</p>
      </div>

      {/* Note spec 22.3 */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <Lock className="w-4 h-4 text-[var(--sw-primary)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-primary)]">
          Spec 22.3 — Un admin ne peut pas modifier ses propres permissions ni celles du super admin.
        </p>
      </div>

      {/* Liste des admins */}
      <div className="space-y-3">
        {admins.map(admin => {
          const isSuperAdmin = (admin.actor_type ?? []).includes('super_admin')
          const isSelf = admin.id === user.id
          const perms = admin.admin_permissions ?? []

          return (
            <div key={admin.id} className="sw-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--sw-line)] flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  {isSuperAdmin ? <Shield className="w-4 h-4 text-[var(--sw-danger)]" /> : <User className="w-4 h-4 text-[var(--sw-primary)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--sw-ink)]">{admin.full_name ?? admin.email ?? 'Admin'}</p>
                    {isSuperAdmin && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-[var(--sw-danger)]">Super admin</span>
                    )}
                    {isSelf && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]">Vous</span>
                    )}
                  </div>
                  {admin.email && <p className="text-xs text-[var(--sw-ink-3)]">{admin.email}</p>}
                </div>
              </div>

              {/* Permissions */}
              {!isSuperAdmin && !isSelf && (
                <form action={updateAdminPermissions} className="px-4 py-3.5 space-y-3">
                  <input type="hidden" name="target_id" value={admin.id} />
                  <p className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">Permissions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {AVAILABLE_PERMISSIONS.map(p => (
                      <label key={p.key} className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" name="permissions" value={p.key}
                          defaultChecked={perms.includes(p.key)}
                          className="mt-0.5 rounded border-[var(--sw-line)] accent-[var(--sw-primary)]" />
                        <div>
                          <p className="text-xs font-medium text-[var(--sw-ink)]">{p.label}</p>
                          <p className="text-xs text-[var(--sw-ink-3)]">{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button className="px-4 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-xs font-medium">
                    Enregistrer les permissions
                  </button>
                </form>
              )}

              {(isSuperAdmin || isSelf) && (
                <div className="px-4 py-3 bg-[var(--sw-surface-2)]">
                  <p className="text-xs text-[var(--sw-ink-3)]">
                    {isSuperAdmin ? "Accès complet — permissions non modifiables." : "Vous ne pouvez pas modifier vos propres permissions."}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Créer un admin */}
      <div className="sw-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--sw-line)] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[var(--sw-primary)]" />
          <p className="text-sm font-semibold text-[var(--sw-ink)]">Attribuer le rôle admin</p>
        </div>
        <form action={createAdmin} className="px-4 py-3.5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">ID du profil à promouvoir</label>
            <input type="text" name="profile_id" required placeholder="UUID du profil"
              className="sw-input w-full text-sm font-mono" />
            <p className="text-xs text-[var(--sw-ink-3)] mt-1">L'utilisateur doit déjà avoir un compte sur la plateforme.</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--sw-ink-2)] mb-1.5">Permissions initiales</p>
            <div className="grid grid-cols-1 gap-1.5">
              {AVAILABLE_PERMISSIONS.map(p => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="new_permissions" value={p.key}
                    className="rounded border-[var(--sw-line)] accent-[var(--sw-primary)]" />
                  <span className="text-xs text-[var(--sw-ink)]">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="px-4 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" /> Créer l'admin
          </button>
        </form>
      </div>
    </div>
  )
}
