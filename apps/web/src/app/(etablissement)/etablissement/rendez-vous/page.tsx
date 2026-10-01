import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rendez-vous — Établissement Séné Wérr' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
function fmtDate(d: string) { const dt = new Date(d); return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]}` }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'En attente',  cls: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]' },
  confirmed:   { label: 'Confirmé',   cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  arrived:     { label: 'Arrivé',     cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  in_progress: { label: 'En cours',   cls: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
  completed:   { label: 'Terminé',    cls: 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]' },
  cancelled:   { label: 'Annulé',     cls: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]' },
}

interface Apt {
  id: string; appointment_date: string; start_time: string; status: string; reason: string | null
  patients: { profiles: { first_name: string; last_name: string } | null } | null
  professional: { title: string | null; profiles: { first_name: string; last_name: string } | null } | null
}

interface Props { searchParams: Promise<{ filter?: string }> }

export default async function EtablissementRendezVousPage({ searchParams }: Props) {
  const { filter = 'today' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase.from('etablissements').select('id').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string }

  const { data: membersData } = await supabase
    .from('establishment_professionals').select('professional:professionals(id)')
    .eq('establishment_id', est.id).eq('status', 'accepted')
  const proIds = ((membersData ?? []) as unknown as { professional: { id: string } | null }[])
    .map(m => m.professional?.id).filter(Boolean) as string[]

  const today = new Date().toISOString().split('T')[0]

  let apts: Apt[] = []
  if (proIds.length > 0) {
    let q = supabase.from('rendez_vous')
      .select(`id, appointment_date, start_time, status, reason,
        patients!inner(profiles!inner(first_name, last_name)),
        professional:professionals!inner(title, profiles!inner(first_name, last_name))`)
      .in('professional_id', proIds)

    if (filter === 'today')    q = (q as unknown as typeof q).eq('appointment_date', today) as typeof q
    else if (filter === 'upcoming') q = (q as unknown as typeof q).gt('appointment_date', today).not('status', 'in', '("cancelled","no_show")') as typeof q
    else if (filter === 'past')     q = (q as unknown as typeof q).lt('appointment_date', today) as typeof q

    const { data } = await (q as unknown as typeof q)
      .order('appointment_date', { ascending: filter !== 'past' })
      .order('start_time', { ascending: true }).limit(100)
    apts = (data ?? []) as unknown as Apt[]
  }

  const TABS = [
    { value: 'today',    label: "Aujourd'hui" },
    { value: 'upcoming', label: 'À venir' },
    { value: 'past',     label: 'Passés' },
    { value: 'all',      label: 'Tous' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rendez-vous</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <Link key={t.value} href={`/etablissement/rendez-vous?filter=${t.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t.value
                ? 'bg-[var(--sw-primary)] text-white'
                : 'bg-[var(--sw-surface)] border border-[var(--sw-line)] text-[var(--sw-ink-2)]'
            }`}
          >{t.label}</Link>
        ))}
      </div>

      <p className="text-xs text-[var(--sw-ink-3)]">{apts.length} résultat{apts.length !== 1 ? 's' : ''}</p>

      {apts.length === 0 ? (
        <div className="sw-card p-8 text-center">
          <CalendarDays className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
          <p className="text-sm text-[var(--sw-ink-2)]">
            {proIds.length === 0 ? 'Invitez des professionnels pour voir leurs rendez-vous.' : 'Aucun rendez-vous dans cette période.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {apts.map(apt => {
            const pat = (apt.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
            const pro = (apt.professional as unknown as { title: string | null; profiles: { first_name: string; last_name: string } | null } | null)
            const patName = pat ? `${pat.first_name} ${pat.last_name}`.trim() : 'Patient inconnu'
            const proName = pro?.profiles ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.last_name}`.trim() : ''
            const cfg = STATUS_CFG[apt.status] ?? { label: apt.status, cls: '' }
            return (
              <div key={apt.id} className="sw-card p-4 flex items-center gap-4">
                <div className="text-center w-12 shrink-0">
                  <p className="text-xs text-[var(--sw-ink-3)]">{fmtDate(apt.appointment_date)}</p>
                  <p className="text-sm font-bold text-[var(--sw-ink)]">{apt.start_time?.slice(0, 5)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{patName}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] truncate">{proName}{apt.reason ? ` · ${apt.reason}` : ''}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
