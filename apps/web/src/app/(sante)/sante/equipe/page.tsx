import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserCog, Users, CheckCircle2, Clock, XCircle, ShieldCheck, ShieldX } from 'lucide-react'
import { SANTE_SUBROLES, PERMISSIONS } from '@/lib/subroles'
import { AcceptRefuseButtons, SubRoleSelect } from '@/components/sante/team-action-buttons'

interface Attachment {
  id: string
  status: string
  function: string | null
  professional: {
    id: string
    professional_type: string
    title: string | null
    profiles: { first_name: string; last_name: string } | null
  } | null
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending:    { label: 'En attente', icon: Clock,         className: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]' },
  accepted:   { label: 'Actif',      icon: CheckCircle2,  className: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  refused:    { label: 'Refusé',     icon: XCircle,       className: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]' },
  terminated: { label: 'Terminé',    icon: XCircle,       className: 'text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)]' },
}

const ROLE_LABELS = Object.fromEntries(SANTE_SUBROLES.map(r => [r.value, r.label]))

export default async function SanteEquipePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/equipe')

  const { data: estData } = await supabase
    .from('etablissements')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle()
  const establishment = estData as unknown as { id: string; name: string } | null

  if (!establishment) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon équipe</h1>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">Gestion des sous-rôles et permissions</p>
        </div>
        <div className="sw-card p-8 text-center space-y-3">
          <UserCog className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto" />
          <p className="text-sm text-[var(--sw-ink-2)]">
            Cette page est réservée aux responsables d&apos;établissement.
          </p>
          <p className="text-xs text-[var(--sw-ink-3)]">
            En tant que professionnel indépendant, gérez vos rattachements depuis{' '}
            <Link href="/sante/etablissements" className="text-[var(--sw-primary)] hover:underline">Établissements</Link>.
          </p>
        </div>
      </div>
    )
  }

  const { data: teamData } = await supabase
    .from('establishment_professionals')
    .select(`
      id,
      status,
      function,
      professional:professionals (
        id,
        professional_type,
        title,
        profiles!inner(first_name, last_name)
      )
    `)
    .eq('establishment_id', establishment.id)
    .order('created_at', { ascending: false })

  const team = (teamData ?? []) as unknown as Attachment[]
  const pending = team.filter(m => m.status === 'pending')
  const active  = team.filter(m => m.status === 'accepted')
  const others  = team.filter(m => m.status !== 'pending' && m.status !== 'accepted')

  function MemberCard({ member }: { member: Attachment }) {
    const pro = member.professional
    const fullName = pro?.profiles
      ? `${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
      : 'Professionnel inconnu'
    const initials = fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    const sc = STATUS_CONFIG[member.status]
    const StatusIcon = sc?.icon ?? Clock
    const currentRole = member.function ?? 'medecin'

    return (
      <div className="sw-card p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-[var(--sw-primary)]">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{fullName}</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
            {pro?.title ? `${pro.title} · ` : ''}{pro?.professional_type?.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {member.status === 'pending' ? (
            <AcceptRefuseButtons attachmentId={member.id} />
          ) : member.status === 'accepted' ? (
            <SubRoleSelect attachmentId={member.id} currentRole={currentRole} />
          ) : (
            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${sc?.className ?? ''}`}>
              <StatusIcon className="w-3 h-3" />
              {sc?.label ?? member.status}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon équipe</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">{establishment.name} · {active.length} membre{active.length !== 1 ? 's' : ''} actif{active.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Demandes en attente */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
            <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Demandes en attente ({pending.length})</h2>
          </div>
          <div className="space-y-2">
            {pending.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        </div>
      )}

      {/* Membres actifs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Membres actifs ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun membre actif. Acceptez les demandes de rattachement ci-dessus.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {active.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        )}
      </div>

      {/* Anciens membres */}
      {others.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)]">Historique ({others.length})</h2>
          <div className="space-y-2">
            {others.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        </div>
      )}

      {/* Tableau des permissions par sous-rôle */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Permissions par sous-rôle</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SANTE_SUBROLES.filter(r => r.value !== 'professionnel_independant').map(role => {
            const perms = PERMISSIONS[role.value]
            return (
              <div key={role.value} className="sw-card p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{role.label}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">{role.desc}</p>
                </div>
                {perms && (
                  <div className="space-y-1.5">
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
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
