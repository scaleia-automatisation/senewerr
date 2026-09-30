import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rendez-vous — Séné Wérr Santé' }

const FILTER_TABS = [
  { value: 'today',    label: "Aujourd'hui" },
  { value: 'upcoming', label: 'À venir' },
  { value: 'past',     label: 'Passés' },
  { value: 'all',      label: 'Tous' },
]

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'En attente',  cls: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]' },
  confirmed:   { label: 'Confirmé',   cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  arrived:     { label: 'Arrivé',     cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  in_progress: { label: 'En cours',   cls: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
  completed:   { label: 'Terminé',    cls: 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]' },
  cancelled:   { label: 'Annulé',     cls: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]' },
  no_show:     { label: 'Absent',     cls: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]' },
}

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]}`
}

interface Apt {
  id: string
  appointment_date: string
  start_time: string
  status: string
  appointment_type: string
  reason: string | null
  patients: { profiles: { first_name: string; last_name: string } | null } | null
}

interface Props { searchParams: Promise<{ filter?: string }> }

export default async function RendezVousPage({ searchParams }: Props) {
  const { filter = 'today' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase.from('professionals').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string } | null

  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('appointments')
    .select(`id, appointment_date, start_time, status, appointment_type, reason,
      patients!inner(profiles!inner(first_name, last_name))`)

  if (pro) query = (query as unknown as typeof query).eq('professional_id', pro.id) as unknown as typeof query

  if (filter === 'today') {
    query = (query as unknown as typeof query).eq('appointment_date', today) as unknown as typeof query
  } else if (filter === 'upcoming') {
    query = (query as unknown as typeof query).gt('appointment_date', today).not('status', 'in', '("cancelled","no_show")') as unknown as typeof query
  } else if (filter === 'past') {
    query = (query as unknown as typeof query).lt('appointment_date', today) as unknown as typeof query
  }

  const { data } = await (query as unknown as typeof query).order('appointment_date', { ascending: filter !== 'past' }).order('start_time', { ascending: true }).limit(50)
  const apts = (data ?? []) as unknown as Apt[]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rendez-vous</h1>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(tab => (
          <Link
            key={tab.value}
            href={`/sante/rendez-vous?filter=${tab.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-[var(--sw-primary)] text-white'
                : 'bg-[var(--sw-surface)] border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <p className="text-xs text-[var(--sw-ink-3)]">{apts.length} résultat{apts.length !== 1 ? 's' : ''}</p>

      {apts.length === 0 ? (
        <div className="sw-card p-8 text-center">
          <CalendarDays className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun rendez-vous dans cette période.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apts.map(apt => {
            const p = (apt.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
            const fullName = p ? `${p.first_name} ${p.last_name}`.trim() : 'Patient inconnu'
            const cfg = STATUS_CONFIG[apt.status] ?? { label: apt.status, cls: 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]' }
            return (
              <Link
                key={apt.id}
                href={`/sante/consultations/${apt.id}`}
                className="sw-card p-4 flex items-center gap-4 hover:border-[var(--sw-primary)] transition-colors"
              >
                <div className="text-center w-12 shrink-0">
                  <p className="text-xs text-[var(--sw-ink-3)]">{fmtDate(apt.appointment_date)}</p>
                  <p className="text-sm font-bold text-[var(--sw-ink)]">{apt.start_time?.slice(0, 5)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{fullName}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] truncate">
                    {apt.reason ?? (apt.appointment_type === 'teleconsultation' ? 'Téléconsultation' : 'Consultation générale')}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
