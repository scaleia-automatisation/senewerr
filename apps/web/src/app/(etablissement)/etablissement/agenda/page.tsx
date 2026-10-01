import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Agenda — Établissement Séné Wérr' }

const DAYS_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed:   'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  arrived:     'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  in_progress: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  completed:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  cancelled:   'bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)]',
}

interface DayApt {
  id: string
  start_time: string
  end_time: string | null
  status: string
  professional_id: string
  patients: { profiles: { first_name: string; last_name: string } | null } | null
}

interface Member {
  professional: { id: string; title: string | null; specialty: string | null; profiles: { first_name: string; last_name: string } | null } | null
}

interface Props { searchParams: Promise<{ date?: string }> }

export default async function EtablissementAgendaPage({ searchParams }: Props) {
  const { date: dateParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase.from('etablissements').select('id, name').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string; name: string }

  const viewDate = dateParam ? new Date(dateParam) : new Date()
  const dateStr  = viewDate.toISOString().split('T')[0]

  // Naviguer jour par jour
  const prev = new Date(viewDate); prev.setDate(prev.getDate() - 1)
  const next = new Date(viewDate); next.setDate(next.getDate() + 1)
  const prevStr = prev.toISOString().split('T')[0]
  const nextStr = next.toISOString().split('T')[0]

  const { data: membersData } = await supabase
    .from('establishment_professionals')
    .select('professional:professionals(id, title, specialty, profiles!inner(first_name, last_name))')
    .eq('establishment_id', est.id)
    .eq('status', 'accepted')
  const members = (membersData ?? []) as unknown as Member[]
  const proIds  = members.map(m => m.professional?.id).filter(Boolean) as string[]

  const { data: aptsData } = proIds.length > 0
    ? await supabase.from('rendez_vous')
        .select(`id, start_time, end_time, status, professional_id,
          patients!inner(profiles!inner(first_name, last_name))`)
        .in('professional_id', proIds)
        .eq('appointment_date', dateStr)
        .not('status', 'in', '("cancelled","no_show")')
        .order('start_time', { ascending: true })
    : { data: [] }

  const apts = (aptsData ?? []) as unknown as DayApt[]

  // Grouper par professionnel
  const byPro = new Map<string, DayApt[]>()
  for (const a of apts) {
    const list = byPro.get(a.professional_id) ?? []
    list.push(a)
    byPro.set(a.professional_id, list)
  }

  // Colonnes : un professionnel par colonne
  const activePros = members
    .map(m => m.professional)
    .filter(p => p && byPro.has(p.id)) as NonNullable<Member['professional']>[]

  const dateLabel = `${DAYS_FR[viewDate.getDay()]} ${viewDate.getDate()} ${MONTHS_FR[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-5">
      {/* En-tête navigation date */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Agenda</h1>
          <p className="text-xs text-[var(--sw-ink-2)] capitalize">{dateLabel}</p>
        </div>
        <div className="flex gap-1">
          <Link href={`/etablissement/agenda?date=${prevStr}`}
            className="p-2 rounded-lg border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link href="/etablissement/agenda"
            className="px-3 py-2 rounded-lg border border-[var(--sw-line)] text-xs font-medium text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors">
            Aujourd&apos;hui
          </Link>
          <Link href={`/etablissement/agenda?date=${nextStr}`}
            className="p-2 rounded-lg border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {activePros.length === 0 ? (
        <div className="sw-card p-8 text-center">
          <Calendar className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--sw-ink)]">Aucune activité ce jour</p>
          <p className="text-xs text-[var(--sw-ink-2)] mt-1">
            {proIds.length === 0
              ? 'Invitez des professionnels pour voir leur planning ici.'
              : 'Aucun professionnel n\'a de rendez-vous ce jour.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(activePros.length, 3)}, 1fr)` }}>
          {activePros.map(pro => {
            const proApts = byPro.get(pro.id) ?? []
            const fullName = pro.profiles
              ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
              : 'Dr ?'
            return (
              <div key={pro.id} className="sw-card overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{fullName}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] capitalize">{pro.specialty?.replace(/_/g, ' ') ?? ''}</p>
                </div>
                <ul className="divide-y divide-[var(--sw-line)]">
                  {proApts.map(a => {
                    const pat = (a.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
                    const patName = pat ? `${pat.first_name} ${pat.last_name}`.trim() : 'Patient'
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xs font-semibold text-[var(--sw-ink)] w-11 shrink-0">
                          {a.start_time?.slice(0, 5)}
                        </span>
                        <span className="text-sm text-[var(--sw-ink)] flex-1 truncate">{patName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[a.status] ?? ''}`}>
                          {a.status === 'confirmed' ? 'Conf.' : a.status === 'arrived' ? 'Arrivé' : a.status === 'in_progress' ? 'En cours' : a.status}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
