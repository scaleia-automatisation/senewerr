import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

type Admin = {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  role: string
  last_sign_in_at?: string
  mfa_enabled?: boolean
}

export default function AdminsPage() {
  useAdminAudit('super-admin-admins')
  const { readOnly } = useSuperAdminContext()
  const { profile: me } = useAuth()
  const isSuperAdmin = me?.role === 'super_admin'

  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Invite modal
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('platform_admin')
  const [inviteSaving, setInviteSaving] = useState(false)

  // Promote modal (double confirm)
  const [promoteTarget, setPromoteTarget] = useState<Admin | null>(null)
  const [promoteStep, setPromoteStep] = useState<1 | 2>(1)
  const [promotePassword, setPromotePassword] = useState('')
  const [promoteSaving, setPromoteSaving] = useState(false)

  // Revoke modal
  const [revokeTarget, setRevokeTarget] = useState<Admin | null>(null)
  const [revokeSaving, setRevokeSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, user_id, full_name, email, role')
      .in('role', ['platform_admin', 'super_admin'])
      .order('role')

    if (!data) { setLoading(false); return }

    // Fetch MFA status for each admin
    const enriched: Admin[] = await Promise.all(
      (data as Admin[]).map(async (a: Admin) => {
        try {
          const { data: factors } = await (supabase as any)
            .from('mfa_factors')
            .select('id, factor_type, status')
            .eq('user_id', a.user_id)
            .eq('status', 'verified')
            .limit(1)
          return { ...a, mfa_enabled: (factors ?? []).length > 0 }
        } catch {
          return { ...a, mfa_enabled: false }
        }
      })
    )
    setAdmins(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  async function invite() {
    setInviteSaving(true)
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'invite_admin', email: inviteEmail, role: inviteRole },
    })
    setInviteSaving(false)
    if (e) setError(e.message)
    else { flash('Invitation envoyée.'); setInviteModal(false); setInviteEmail(''); load() }
  }

  async function promote() {
    setPromoteSaving(true)
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'promote_super_admin', profileId: promoteTarget?.id, password: promotePassword },
    })
    setPromoteSaving(false)
    if (e) setError(e.message)
    else { flash(`${promoteTarget?.full_name} promu Super Admin.`); setPromoteTarget(null); setPromoteStep(1); setPromotePassword(''); load() }
  }

  async function revoke() {
    if (!revokeTarget) return
    setRevokeSaving(true)
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'revoke_admin', profileId: revokeTarget.id },
    })
    setRevokeSaving(false)
    if (e) setError(e.message)
    else { flash(`Accès de ${revokeTarget.full_name} révoqué.`); setRevokeTarget(null); load() }
  }

  if (loading) return <div className="space-y-s-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>

  return (
    <div className="space-y-s-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-bold text-ink">Administrateurs plateforme</h1>
          <p className="text-small text-ink-3">Gestion des comptes admin et super-admin.</p>
        </div>
        <Button variant="primary" size="sm" disabled={readOnly} onClick={() => setInviteModal(true)}>
          + Inviter un admin
        </Button>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-line text-ink-3">
              <tr>
                {['Nom', 'Email', 'Rôle', '2FA', 'Dernière connexion', ''].map(h => (
                  <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {admins.map(admin => (
                <tr key={admin.id} className="hover:bg-surface-2">
                  <td className="px-s-3 py-s-2 font-medium text-ink">{admin.full_name ?? '—'}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{admin.email ?? '—'}</td>
                  <td className="px-s-3 py-s-2">
                    <Badge variant={admin.role === 'super_admin' ? 'danger' : 'primary'}>
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </Badge>
                  </td>
                  <td className="px-s-3 py-s-2">
                    <Badge variant={admin.mfa_enabled ? 'success' : 'pending'}>
                      {admin.mfa_enabled ? '2FA actif' : 'Sans 2FA'}
                    </Badge>
                  </td>
                  <td className="px-s-3 py-s-2 text-ink-2">
                    {admin.last_sign_in_at ? new Date(admin.last_sign_in_at).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="px-s-3 py-s-2">
                    <div className="flex gap-s-2">
                      {isSuperAdmin && admin.role !== 'super_admin' && (
                        <Button variant="ghost" size="sm" onClick={() => { setPromoteTarget(admin); setPromoteStep(1) }}>
                          Promouvoir
                        </Button>
                      )}
                      {admin.id !== me?.id && (
                        <Button variant="danger" size="sm" disabled={readOnly} onClick={() => setRevokeTarget(admin)}>
                          Révoquer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite modal */}
      <Modal open={inviteModal} onOpenChange={setInviteModal} title="Inviter un administrateur">
        <div className="space-y-s-4">
          <Input label="Email" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@exemple.com" />
          <Select
            label="Rôle"
            options={[{ label: 'Admin plateforme', value: 'platform_admin' }]}
            value={inviteRole}
            onValueChange={setInviteRole}
          />
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setInviteModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={invite} loading={inviteSaving} disabled={!inviteEmail}>Envoyer l'invitation</Button>
          </div>
        </div>
      </Modal>

      {/* Promote modal — step 1: password */}
      <Modal
        open={!!promoteTarget && promoteStep === 1}
        onOpenChange={open => !open && setPromoteTarget(null)}
        title="Confirmation du mot de passe"
      >
        <div className="space-y-s-4">
          <p className="text-small text-ink-2">Pour promouvoir <strong>{promoteTarget?.full_name}</strong> en Super Admin, confirmez votre mot de passe.</p>
          <Input label="Votre mot de passe" type="password" value={promotePassword} onChange={e => setPromotePassword(e.target.value)} />
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setPromoteTarget(null)}>Annuler</Button>
            <Button variant="primary" onClick={() => setPromoteStep(2)} disabled={!promotePassword}>Continuer</Button>
          </div>
        </div>
      </Modal>

      {/* Promote modal — step 2: irreversible confirm */}
      <Modal
        open={!!promoteTarget && promoteStep === 2}
        onOpenChange={open => !open && setPromoteTarget(null)}
        title="Cette action est irréversible"
      >
        <div className="space-y-s-4">
          <Banner kind="warning">
            Promouvoir un compte en Super Admin lui donne un accès complet à la console système. Cette action ne peut pas être annulée automatiquement.
          </Banner>
          <p className="text-small text-ink-2">Confirmez-vous la promotion de <strong>{promoteTarget?.full_name}</strong> en Super Admin ?</p>
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setPromoteTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={promote} loading={promoteSaving}>Confirmer la promotion</Button>
          </div>
        </div>
      </Modal>

      {/* Revoke modal */}
      <Modal
        open={!!revokeTarget}
        onOpenChange={open => !open && setRevokeTarget(null)}
        title="Révoquer l'accès admin"
      >
        <div className="space-y-s-4">
          <p className="text-small text-ink-2">Vous allez révoquer l'accès administrateur de <strong>{revokeTarget?.full_name}</strong>. Cette personne ne pourra plus accéder à la console.</p>
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Annuler</Button>
            <Button variant="danger" onClick={revoke} loading={revokeSaving}>Révoquer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
