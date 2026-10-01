import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react'
import type { Metadata } from 'next'
import { AdherentActions } from './adherent-actions'

export const metadata: Metadata = { title: 'Adhérents — Couverture' }

type Member = {
  id: string
  member_number: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  statut: string
  employer_name: string | null
  patients: { id: string; profils: { first_name: string | null; last_name: string | null; phone: string | null } | null } | null
  formules_couverture: { name: string } | null
}

export default async function AdherentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase
    .from('organismes_couverture')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle()
  const org = orgData as unknown as { id: string; name: string } | null
  if (!org) redirect('/connexion')

  const { data: membersData } = await supabase
    .from('adherents_couverture')
    .select(`
      id, member_number, start_date, end_date, is_active, statut, employer_name,
      patients!inner(id, profils!inner(first_name, last_name, phone)),
      formules_couverture(name)
    `)
    .eq('coverage_org_id', org.id)
    .order('statut', { ascending: true })
    .order('start_date', { ascending: false })

  const members = (membersData ?? []) as unknown as Member[]
  const enAttente = members.filter(m => m.statut === 'en_attente')
  const actifs    = members.filter(m => m.statut === 'actif')
  const refuses   = members.filter(m => m.statut === 'refuse')

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Adhérents</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">
            {org.name} — {actifs.length} actif{actifs.length > 1 ? 's' : ''}
            {enAttente.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {enAttente.length} en attente
              </span>
            )}
          </p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Users className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun adhérent pour le moment.</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">
            Lorsqu'un patient déclare votre organisme, sa demande apparaît ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── En attente ── */}
          {enAttente.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-[var(--sw-ink)]">
                  En attente de validation ({enAttente.length})
                </h2>
              </div>
              <div className="space-y-2">
                {enAttente.map(m => (
                  <MemberCard key={m.id} member={m} showActions />
                ))}
              </div>
            </section>
          )}

          {/* ── Actifs ── */}
          {actifs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
                <h2 className="text-sm font-semibold text-[var(--sw-ink)]">
                  Actifs ({actifs.length})
                </h2>
              </div>
              <div className="space-y-2">
                {actifs.map(m => <MemberCard key={m.id} member={m} />)}
              </div>
            </section>
          )}

          {/* ── Refusés ── */}
          {refuses.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[var(--sw-danger)]" />
                <h2 className="text-sm font-semibold text-[var(--sw-ink-2)]">
                  Refusés ({refuses.length})
                </h2>
              </div>
              <div className="space-y-2">
                {refuses.map(m => <MemberCard key={m.id} member={m} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function MemberCard({ member: m, showActions }: { member: Member; showActions?: boolean }) {
  const pat  = m.patients?.profils
  const name = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() || 'Patient' : 'Patient'
  const plan = (m.formules_couverture as unknown as { name: string } | null)?.name

  const badgeClass =
    m.statut === 'actif'      ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' :
    m.statut === 'en_attente' ? 'bg-amber-50 text-amber-700' :
                                'bg-red-50 text-[var(--sw-danger)]'
  const badgeLabel =
    m.statut === 'actif'      ? 'Actif' :
    m.statut === 'en_attente' ? 'En attente' : 'Refusé'

  return (
    <div className={`sw-card p-4 space-y-3 ${m.statut === 'en_attente' ? 'border-amber-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
          <span className="text-purple-600 text-sm font-bold">{name[0]?.toUpperCase() ?? '?'}</span>
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--sw-ink)]">{name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
              {badgeLabel}
            </span>
          </div>
          {m.member_number && <p className="text-xs text-[var(--sw-ink-3)]">N° {m.member_number}</p>}
          {m.employer_name && <p className="text-xs text-[var(--sw-ink-2)]">Employeur : {m.employer_name}</p>}
          <div className="flex gap-3 text-xs text-[var(--sw-ink-2)] flex-wrap">
            {plan && <span>Formule : {plan}</span>}
            {pat?.phone && <span>{pat.phone}</span>}
          </div>
          {m.start_date && (
            <p className="text-xs text-[var(--sw-ink-3)]">
              Depuis le {fmtDate(m.start_date)}
              {m.end_date && <> · jusqu'au {fmtDate(m.end_date)}</>}
            </p>
          )}
        </div>
      </div>

      {showActions && <AdherentActions adherentId={m.id} />}
    </div>
  )
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
