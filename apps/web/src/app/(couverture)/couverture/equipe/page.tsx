import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ShieldCheck, ShieldX } from 'lucide-react'
import { COUVERTURE_SUBROLES, PERMISSIONS } from '@/lib/subroles'
import { InviteMemberForm, TeamMemberRoleSelect, RemoveMemberButton } from '@/components/sante/team-action-buttons'

interface TeamMember {
  id: string
  sub_role: string
  status: string
  invited_phone: string | null
  profile: { first_name: string; last_name: string } | null
}

const SUBROLE_LABELS = Object.fromEntries(COUVERTURE_SUBROLES.map(r => [r.value, r.label]))

export default async function CouvertureEquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/couverture/equipe')

  const { data: coverageData } = await supabase
    .from('organismes_couverture')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle()
  const org = coverageData as unknown as { id: string; name: string } | null

  let members: TeamMember[] = []
  const { data: membersData } = await supabase
    .from('team_members')
    .select(`
      id,
      sub_role,
      status,
      invited_phone,
      profile:profiles(first_name, last_name)
    `)
    .eq('organization_profile_id', user.id)
    .eq('organization_type', 'couverture')
    .order('created_at', { ascending: false })
  members = (membersData ?? []) as unknown as TeamMember[]

  const active  = members.filter(m => m.status === 'active')
  const pending = members.filter(m => m.status === 'pending')

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon équipe</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
          {org?.name ?? 'Mon organisme'} · {active.length} agent{active.length !== 1 ? 's' : ''} actif{active.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Invitation */}
      <InviteMemberForm
        organizationProfileId={user.id}
        organizationType="couverture"
        subRoles={COUVERTURE_SUBROLES}
      />

      {/* Invitations en attente */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Invitations en attente ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map(m => (
              <div key={m.id} className="sw-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[var(--sw-ink-3)]">?</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">
                    {m.profile ? `${m.profile.first_name} ${m.profile.last_name}`.trim() : m.invited_phone ?? 'Invité'}
                  </p>
                  <p className="text-xs text-[var(--sw-ink-3)]">
                    {SUBROLE_LABELS[m.sub_role] ?? m.sub_role} · En attente
                  </p>
                </div>
                <RemoveMemberButton memberId={m.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membres actifs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Agents actifs ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun agent pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(m => {
              const fullName = m.profile
                ? `${m.profile.first_name} ${m.profile.last_name}`.trim()
                : m.invited_phone ?? 'Agent'
              const initials = fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
              return (
                <div key={m.id} className="sw-card p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[var(--sw-primary)]">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{fullName}</p>
                  </div>
                  <TeamMemberRoleSelect
                    memberId={m.id}
                    currentRole={m.sub_role}
                    subRoles={COUVERTURE_SUBROLES}
                  />
                  <RemoveMemberButton memberId={m.id} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tableau des permissions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Permissions par sous-rôle</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {COUVERTURE_SUBROLES.map(role => {
            const perms = PERMISSIONS[role.value]
            return (
              <div key={role.value} className="sw-card p-4 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{role.label}</p>
                  <p className="text-xs text-[var(--sw-ink-2)]">{role.desc}</p>
                </div>
                {perms ? (
                  <div className="space-y-1">
                    {perms.allowed.map(p => (
                      <div key={p} className="flex items-start gap-2 text-xs text-[var(--sw-ink-2)]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0 mt-0.5" />
                        {p}
                      </div>
                    ))}
                    {perms.restricted.map(p => (
                      <div key={p} className="flex items-start gap-2 text-xs text-[var(--sw-ink-3)]">
                        <ShieldX className="w-3.5 h-3.5 text-[var(--sw-danger)] shrink-0 mt-0.5" />
                        {p}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--sw-ink-3)] italic">Accès complet à l&apos;espace</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
