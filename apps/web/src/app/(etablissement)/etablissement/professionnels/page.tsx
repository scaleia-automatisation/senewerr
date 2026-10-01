import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, UserPlus, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { InviteActions } from '@/components/etablissement/invite-actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Professionnels — Établissement Séné Wérr' }

interface Member {
  id: string
  status: string
  function: string | null
  created_at: string
  professional: {
    id: string
    title: string | null
    professional_type: string | null
    specialty: string | null
    profiles: { first_name: string; last_name: string; phone: string | null } | null
  } | null
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending:    { label: 'En attente',  cls: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]',         icon: Clock },
  accepted:   { label: 'Actif',       cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]',         icon: CheckCircle2 },
  refused:    { label: 'Refusé',      cls: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]',  icon: XCircle },
  terminated: { label: 'Terminé',     cls: 'text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)]',            icon: XCircle },
}

export default async function ProfessionnelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase
    .from('etablissements').select('id, name').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string; name: string }

  const { data: membersData } = await supabase
    .from('establishment_professionals')
    .select(`
      id, status, function, created_at,
      professional:professionals(
        id, title, professional_type, specialty,
        profiles!inner(first_name, last_name, phone)
      )
    `)
    .eq('establishment_id', est.id)
    .order('created_at', { ascending: false })

  const members = (membersData ?? []) as unknown as Member[]
  const pending    = members.filter(m => m.status === 'pending')
  const active     = members.filter(m => m.status === 'accepted')
  const historical = members.filter(m => !['pending','accepted'].includes(m.status))

  function MemberRow({ m }: { m: Member }) {
    const pro = m.professional
    const fullName = pro?.profiles
      ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
      : 'Professionnel inconnu'
    const initials = fullName.split(' ').filter(w => /^[A-Za-zÀ-ÿ]/.test(w)).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    const cfg = STATUS_CFG[m.status] ?? STATUS_CFG.pending
    const Icon = cfg.icon
    return (
      <div className="sw-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-[var(--sw-primary)]">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{fullName}</p>
          <p className="text-xs text-[var(--sw-ink-2)] truncate">
            {pro?.specialty?.replace(/_/g, ' ') ?? pro?.professional_type?.replace(/_/g, ' ') ?? ''}
            {pro?.profiles?.phone ? ` · ${pro.profiles.phone}` : ''}
          </p>
        </div>
        {m.status === 'pending' ? (
          <InviteActions attachmentId={m.id} />
        ) : (
          <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <Users className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">Professionnels</h1>
            <p className="text-xs text-[var(--sw-ink-2)]">{active.length} actif{active.length !== 1 ? 's' : ''} · {est.name}</p>
          </div>
        </div>
        <Link
          href="/etablissement/professionnels/inviter"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-4 h-4" />
          Inviter
        </Link>
      </div>

      {/* Demandes en attente */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--sw-warning)]" />
            <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Demandes en attente ({pending.length})</h2>
          </div>
          {pending.map(m => <MemberRow key={m.id} m={m} />)}
        </div>
      )}

      {/* Membres actifs */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Membres actifs ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <div className="sw-card p-8 text-center border-dashed">
            <Users className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun professionnel actif.</p>
            <Link href="/etablissement/professionnels/inviter" className="text-xs text-[var(--sw-primary)] hover:underline mt-1 inline-block">
              Inviter un professionnel →
            </Link>
          </div>
        ) : (
          active.map(m => <MemberRow key={m.id} m={m} />)
        )}
      </div>

      {/* Historique */}
      {historical.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)]">Historique ({historical.length})</h2>
          {historical.map(m => <MemberRow key={m.id} m={m} />)}
        </div>
      )}
    </div>
  )
}
