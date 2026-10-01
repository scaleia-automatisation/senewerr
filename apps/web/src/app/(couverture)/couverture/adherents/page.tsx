import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Adhérents — Couverture' }

type Member = {
  id: string; member_number: string | null; start_date: string | null; end_date: string | null; is_active: boolean
  patients: { id: string; profiles: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null
  coverage_plans: { name: string } | null
}

export default async function AdherentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('organismes_couverture').select('id, name').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string; name: string } | null
  if (!org) redirect('/connexion')

  const { data: membersData } = await supabase
    .from('adherents_couverture')
    .select('id, member_number, start_date, end_date, is_active, patients!inner(id, profiles!inner(first_name, last_name, phone)), coverage_plans(name)')
    .eq('coverage_org_id', org.id)
    .order('is_active', { ascending: false })

  const members = (membersData ?? []) as unknown as Member[]
  const active = members.filter(m => m.is_active)
  const inactive = members.filter(m => !m.is_active)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Adhérents</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{org.name} — {active.length} actif{active.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Users className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun adhérent enregistré pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2">Actifs ({active.length})</h2>
              <div className="space-y-2">
                {active.map(m => <MemberCard key={m.id} member={m} />)}
              </div>
            </section>
          )}
          {inactive.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] mb-2">Inactifs ({inactive.length})</h2>
              <div className="space-y-2">
                {inactive.map(m => <MemberCard key={m.id} member={m} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function MemberCard({ member: m }: { member: Member }) {
  const pat = m.patients?.profiles
  const name = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
  const planName = (m.coverage_plans as unknown as { name: string } | null)?.name

  return (
    <div className="sw-card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
        <span className="text-purple-600 text-sm font-bold">{name[0]?.toUpperCase() ?? '?'}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-[var(--sw-ink)]">{name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.is_active ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
            {m.is_active ? 'Actif' : 'Inactif'}
          </span>
        </div>
        {m.member_number && <p className="text-xs text-[var(--sw-ink-3)]">N° {m.member_number}</p>}
        <div className="flex gap-3 text-xs text-[var(--sw-ink-2)]">
          {planName && <span>Formule : {planName}</span>}
          {pat?.phone && <span>{pat.phone}</span>}
        </div>
        {(m.start_date || m.end_date) && (
          <p className="text-xs text-[var(--sw-ink-3)]">
            {m.start_date ? fmtDate(m.start_date) : '—'} → {m.end_date ? fmtDate(m.end_date) : 'En cours'}
          </p>
        )}
      </div>
    </div>
  )
}

function fmtDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
