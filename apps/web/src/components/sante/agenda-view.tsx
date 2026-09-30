'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, Clock, User, ArrowRight, CalendarDays } from 'lucide-react'

type Establishment = { id: string; name: string }
type Appointment = {
  id: string; status: string; scheduled_at: string; duration_minutes: number | null
  reason: string | null
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  establishments: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', arrived: 'Arrivé',
  in_consultation: 'En cours', completed: 'Terminé',
  cancelled: 'Annulé', rescheduled: 'Reporté', no_show: 'Absent',
}
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-[var(--sw-warning)]', confirmed: 'bg-[var(--sw-success)]',
  arrived: 'bg-blue-500', in_consultation: 'bg-blue-600',
  completed: 'bg-[var(--sw-ink-3)]', cancelled: 'bg-[var(--sw-danger)]',
  rescheduled: 'bg-purple-500', no_show: 'bg-red-300',
}
const STATUS_BG: Record<string, string> = {
  pending: 'border-l-[var(--sw-warning)]', confirmed: 'border-l-[var(--sw-success)]',
  arrived: 'border-l-blue-500', in_consultation: 'border-l-blue-600',
  completed: 'border-l-[var(--sw-ink-3)]', cancelled: 'border-l-[var(--sw-danger)]',
  rescheduled: 'border-l-purple-500', no_show: 'border-l-red-300',
}

type ViewType = 'month' | 'week' | 'day'

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_NAMES_SHORT = ['Lu','Ma','Me','Je','Ve','Sa','Di']
const DAY_NAMES_LONG = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}
function buildCalDays(year: number, month: number) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) days.push(null)
  for (let d = 1; d <= total; d++) days.push(d)
  return days
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })
}

export function AgendaView({ professionalId, establishments }: { professionalId: string; establishments: Establishment[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [view, setView] = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date(today))
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date(today))
  const [filterEstId, setFilterEstId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAppointments = useCallback(async (from: Date, to: Date) => {
    setLoading(true)
    const supabase = createClient()
    let q = supabase
      .from('appointments')
      .select('id, status, scheduled_at, duration_minutes, reason, patients(profiles(first_name, last_name)), establishments(id, name)')
      .eq('professional_id', professionalId)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())
      .order('scheduled_at')

    if (filterEstId) q = q.eq('establishment_id', filterEstId)

    const { data } = await q
    setAppointments((data ?? []) as unknown as Appointment[])
    setLoading(false)
  }, [professionalId, filterEstId])

  useEffect(() => {
    let from: Date, to: Date
    if (view === 'month') {
      from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
    } else if (view === 'week') {
      from = startOfWeek(currentDate)
      to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59)
    } else {
      from = new Date(currentDate); from.setHours(0, 0, 0, 0)
      to = new Date(currentDate); to.setHours(23, 59, 59, 999)
    }
    fetchAppointments(from, to)
  }, [view, currentDate, fetchAppointments])

  function navigate(dir: 1 | -1) {
    const d = new Date(currentDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setCurrentDate(d)
    setSelectedDay(null)
  }

  function getTitle() {
    if (view === 'month') return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    if (view === 'week') {
      const ws = startOfWeek(currentDate)
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      return `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`
    }
    return currentDate.toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function countForDay(d: Date) {
    return appointments.filter(a => sameDay(new Date(a.scheduled_at), d)).length
  }
  function aptsForDay(d: Date) {
    return appointments.filter(a => sameDay(new Date(a.scheduled_at), d))
  }

  const selectedDayApts = selectedDay ? aptsForDay(selectedDay) : []

  function ApptCard({ a }: { a: Appointment }) {
    const p = (a.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
    const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'Patient'
    return (
      <Link href={`/sante/agenda/${a.id}`} className={`sw-card p-3 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors border-l-4 ${STATUS_BG[a.status] ?? ''}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--sw-ink)">{fmtTime(a.scheduled_at)}</span>
            {a.duration_minutes && <span className="text-xs text-[var(--sw-ink-3)]">({a.duration_minutes}min)</span>}
          </div>
          <p className="text-sm font-medium text-[var(--sw-ink)] mt-0.5">{name}</p>
          {a.reason && <p className="text-xs text-[var(--sw-ink-2)] italic">{a.reason}</p>}
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status] ?? ''}`} />
            <span className="text-xs text-[var(--sw-ink-3)]">{STATUS_LABELS[a.status] ?? a.status}</span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 ml-auto mt-0.5" />
      </Link>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon agenda</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{appointments.length} rendez-vous sur la période</p>
        </div>
        <div className="flex items-center gap-2">
          {establishments.length > 1 && (
            <select value={filterEstId ?? ''} onChange={e => setFilterEstId(e.target.value || null)} className="sw-input text-sm py-1.5">
              <option value="">Tous les établissements</option>
              {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <div className="flex rounded-xl overflow-hidden border border-[var(--sw-line)]">
            {(['month', 'week', 'day'] as ViewType[]).map(v => (
              <button key={v} onClick={() => { setView(v); setSelectedDay(null) }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface)] text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)]'}`}>
                {v === 'month' ? 'Mois' : v === 'week' ? 'Sem.' : 'Jour'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--sw-surface-2)]">
          <ChevronLeft className="w-4 h-4 text-[var(--sw-ink-2)]" />
        </button>
        <p className="text-sm font-semibold text-[var(--sw-ink)] flex-1 text-center capitalize">{getTitle()}</p>
        <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--sw-surface-2)]">
          <ChevronRight className="w-4 h-4 text-[var(--sw-ink-2)]" />
        </button>
        <button onClick={() => { setCurrentDate(new Date(today)); setSelectedDay(new Date(today)) }}
          className="px-3 py-1.5 text-xs text-[var(--sw-primary)] border border-[var(--sw-primary)] rounded-lg hover:bg-[var(--sw-primary-subtle)]">
          Aujourd'hui
        </button>
      </div>

      {/* VUE MOIS */}
      {view === 'month' && (
        <div className="sw-card p-4 space-y-3">
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES_SHORT.map(d => <div key={d} className="text-center text-xs text-[var(--sw-ink-3)] font-medium py-1">{d}</div>)}
            {buildCalDays(currentDate.getFullYear(), currentDate.getMonth()).map((d, i) => {
              if (!d) return <div key={`e-${i}`} />
              const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d)
              const count = countForDay(date)
              const isToday = sameDay(date, today)
              const isSel = selectedDay ? sameDay(date, selectedDay) : false
              return (
                <button key={d} onClick={() => { setSelectedDay(date); setView('month') }}
                  className={`relative aspect-square w-full flex flex-col items-center justify-center rounded-lg text-xs transition-colors
                    ${isSel ? 'bg-[var(--sw-primary)] text-white' : isToday ? 'border border-[var(--sw-primary)] text-[var(--sw-primary)]' : 'hover:bg-[var(--sw-surface-2)] text-[var(--sw-ink)]'}`}>
                  <span className="font-medium">{d}</span>
                  {count > 0 && (
                    <div className={`flex gap-0.5 mt-0.5 ${isSel ? 'opacity-80' : ''}`}>
                      {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                        <div key={k} className={`w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-[var(--sw-primary)]'}`} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* VUE SEMAINE */}
      {view === 'week' && (
        <div className="sw-card p-4 overflow-x-auto">
          <div className="min-w-[560px] grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const ws = startOfWeek(currentDate)
              const date = new Date(ws); date.setDate(ws.getDate() + i)
              const apts = aptsForDay(date)
              const isToday = sameDay(date, today)
              return (
                <div key={i} className={`rounded-xl p-2 space-y-1 min-h-[80px] ${isToday ? 'bg-[var(--sw-primary-subtle)] border border-[var(--sw-primary)]' : 'bg-[var(--sw-surface-2)]'}`}>
                  <div className="text-center">
                    <p className="text-xs text-[var(--sw-ink-3)]">{DAY_NAMES_SHORT[i]}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-[var(--sw-primary)]' : 'text-[var(--sw-ink)]'}`}>{date.getDate()}</p>
                  </div>
                  {apts.map(a => {
                    const p2 = (a.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
                    return (
                      <Link key={a.id} href={`/sante/agenda/${a.id}`}
                        className={`block text-xs px-1.5 py-1 rounded border-l-2 bg-white ${STATUS_BG[a.status] ?? ''} text-[var(--sw-ink)] truncate`}>
                        {fmtTime(a.scheduled_at)} {p2 ? `${p2.first_name ?? ''}` : '?'}
                      </Link>
                    )
                  })}
                  {apts.length === 0 && <p className="text-xs text-[var(--sw-ink-3)] text-center py-2">–</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VUE JOUR */}
      {view === 'day' && (
        <div className="space-y-2">
          {loading ? (
            <div className="sw-card p-8 text-center"><div className="w-5 h-5 border-2 border-[var(--sw-primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : appointments.length === 0 ? (
            <div className="sw-card p-8 text-center">
              <CalendarDays className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun rendez-vous aujourd'hui.</p>
            </div>
          ) : (
            appointments.map(a => <ApptCard key={a.id} a={a} />)
          )}
        </div>
      )}

      {/* Rendez-vous du jour sélectionné (vue mois) */}
      {view === 'month' && selectedDay && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] capitalize">
            {selectedDay.toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="ml-2 text-[var(--sw-ink-3)] font-normal">({selectedDayApts.length} RDV)</span>
          </h2>
          {loading && <div className="sw-card p-4 text-center"><div className="w-4 h-4 border-2 border-[var(--sw-primary)] border-t-transparent rounded-full animate-spin mx-auto" /></div>}
          {!loading && selectedDayApts.length === 0 && (
            <div className="sw-card p-6 text-center">
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun rendez-vous ce jour.</p>
            </div>
          )}
          {!loading && selectedDayApts.map(a => <ApptCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
