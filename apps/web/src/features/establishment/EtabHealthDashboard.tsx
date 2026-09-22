import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays, Users, UserCheck, UserPlus, ClipboardList,
  ChevronDown, FlaskConical, Pill, AlertTriangle, Calendar,
  FileText, Eye, Plus, X, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiTile } from '@/components/ui/KpiTile'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { containerVariants, itemVariants } from '@/lib/motion'
import { useEtabHealth } from './EtabHealthContext'
import { format, startOfWeek, addDays, startOfDay, endOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Constantes ────────────────────────────────────────────────────────────────

const CANCELLED_STATUSES = ['cancelled_patient','cancelled_professional','cancelled_establishment']

/** 08:00 → 20:00 = 720 min */
const TL_START_H = 8
const TL_END_H   = 20
const TL_SPAN    = (TL_END_H - TL_START_H) * 60

function minuteFromMidnight(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function pct(minutes: number): string {
  return `${Math.max(0, Math.min(100, ((minutes - TL_START_H * 60) / TL_SPAN) * 100)).toFixed(2)}%`
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Appt = {
  id: string
  starts_at: string
  status: string
  professional_id: string
  patient_name: string
}

type ProRow = {
  professional_id: string
  name: string
  schedules: { start_time: string; end_time: string }[]
  hasException: boolean
  isActive: boolean  // has an in_consultation/patient_arrived appt RIGHT NOW
  hasFutureAppt: boolean
  todayAppts: Appt[]
}

type DayCount = {
  date: string
  label: string
  confirmed: number
  pending: number
  cancelled: number
}

// ── Sélecteur multi-site ───────────────────────────────────────────────────────

function OrgSelector() {
  const { establishmentName, organizations, setActiveOrg, orgId, theme } = useEtabHealth()
  const [open, setOpen] = useState(false)
  if (organizations.length <= 1) {
    return (
      <span className={`text-small font-medium px-s-2 py-s-1 rounded-full ${theme.bgClass} ${theme.textClass}`}>
        {theme.label}
      </span>
    )
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-s-1 text-small font-medium px-s-2 py-s-1 rounded-full ${theme.bgClass} ${theme.textClass}`}
      >
        {establishmentName}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 min-w-[180px] bg-surface border border-line rounded-md shadow-md py-s-1">
          {organizations.map(o => (
            <button key={o.orgId} onClick={() => { setActiveOrg(o.orgId); setOpen(false) }}
              className={`w-full text-left px-s-3 py-s-2 text-small hover:bg-bg ${o.orgId === orgId ? 'font-semibold text-primary' : 'text-ink'}`}
            >
              {o.orgName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timeline Gantt ─────────────────────────────────────────────────────────────

function ProfessionalTimeline({ rows, loading }: { rows: ProRow[]; loading: boolean }) {
  const { theme } = useEtabHealth()
  const [selected, setSelected] = useState<ProRow | null>(null)
  const hours = Array.from({ length: TL_END_H - TL_START_H + 1 }, (_, i) => TL_START_H + i)

  if (loading) return <Skeleton className="h-48 rounded-md" />
  if (!rows.length) return (
    <p className="text-small text-ink-3 text-center py-s-4">Aucun professionnel rattaché aujourd'hui</p>
  )

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Marqueurs horaires */}
          <div className="flex relative h-5 mb-s-1 pl-[140px]">
            {hours.map(h => (
              <div key={h} className="flex-1 text-micro text-ink-3 border-l border-line pl-s-1">
                {`${String(h).padStart(2,'0')}:00`}
              </div>
            ))}
          </div>

          {/* Lignes professionnels */}
          <div className="flex flex-col gap-s-2">
            {rows.map(row => {
              const barColor = row.hasException
                ? 'bg-sky-400/70'
                : row.isActive
                  ? 'bg-green-500'
                  : row.hasFutureAppt
                    ? 'bg-amber-400'
                    : 'bg-primary/60'

              return (
                <button
                  key={row.professional_id}
                  onClick={() => setSelected(row)}
                  className="flex items-center gap-s-2 group hover:bg-bg/50 rounded-md px-s-1 py-s-1 text-left transition-colors"
                >
                  {/* Nom */}
                  <span className="w-[132px] shrink-0 text-small font-medium text-ink truncate group-hover:text-primary">
                    {row.name}
                  </span>

                  {/* Zone Gantt */}
                  <div className="flex-1 relative h-7 bg-bg rounded">
                    {/* Grille verticale */}
                    {hours.map(h => (
                      <div key={h}
                        className="absolute top-0 bottom-0 border-l border-line/50"
                        style={{ left: pct((h - TL_START_H) * 60) }}
                      />
                    ))}

                    {/* Barres planning */}
                    {row.hasException ? (
                      <div
                        className="absolute top-1 bottom-1 bg-sky-400/40 border border-sky-400 rounded"
                        style={{ left: '0%', right: '0%' }}
                        title="Absent / Exception"
                      />
                    ) : (
                      row.schedules.map((s, i) => {
                        const startMin = minuteFromMidnight(s.start_time)
                        const endMin   = minuteFromMidnight(s.end_time)
                        const l = pct(startMin)
                        const w = `${((endMin - startMin) / TL_SPAN) * 100}%`
                        return (
                          <div
                            key={i}
                            className={`absolute top-1 bottom-1 ${barColor} rounded`}
                            style={{ left: l, width: w }}
                            title={`${s.start_time} – ${s.end_time}`}
                          />
                        )
                      })
                    )}

                    {/* Points RDV */}
                    {row.todayAppts.map(a => {
                      const apptMin = minuteFromMidnight(
                        format(new Date(a.starts_at), 'HH:mm')
                      )
                      if (apptMin < TL_START_H * 60 || apptMin > TL_END_H * 60) return null
                      return (
                        <div
                          key={a.id}
                          className="absolute top-0 bottom-0 w-0.5 bg-ink/30"
                          style={{ left: pct(apptMin) }}
                          title={`${format(new Date(a.starts_at),'HH:mm')} — ${a.patient_name}`}
                        />
                      )
                    })}
                  </div>

                  {/* Indicateur statut */}
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    row.hasException ? 'bg-sky-400' : row.isActive ? 'bg-green-500' : row.hasFutureAppt ? 'bg-amber-400' : 'bg-primary/50'
                  }`} />
                </button>
              )
            })}
          </div>

          {/* Légende */}
          <div className="flex gap-s-4 mt-s-3 flex-wrap">
            {[
              { color: 'bg-green-500', label: 'En consultation' },
              { color: 'bg-amber-400', label: 'Présent, libre' },
              { color: 'bg-primary/60', label: 'Planifié' },
              { color: 'bg-sky-400/40 border border-sky-400', label: 'Absent / Exception' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-s-1 text-micro text-ink-3">
                <span className={`h-2 w-4 rounded ${l.color} inline-block`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Modal fiche professionnel */}
      <AnimatePresence>
        {selected && (
          <Modal open={!!selected} onOpenChange={o => !o && setSelected(null)} title={selected.name}>
            <div className="flex flex-col gap-s-3">
              <div className="flex items-center gap-s-2">
                <div className={`h-2 w-2 rounded-full ${
                  selected.hasException ? 'bg-sky-400' : selected.isActive ? 'bg-green-500' : 'bg-amber-400'
                }`} />
                <span className="text-small text-ink">
                  {selected.hasException ? "Absent aujourd’hui"
                    : selected.isActive ? 'En consultation'
                    : selected.hasFutureAppt ? 'Libre (prochain RDV à venir)'
                    : 'Aucun RDV planifié'}
                </span>
              </div>
              <div className="border-t border-line pt-s-3">
                <p className="text-small font-semibold text-ink mb-s-2">RDV du jour ({selected.todayAppts.length})</p>
                {selected.todayAppts.length === 0
                  ? <p className="text-small text-ink-3">Aucun RDV</p>
                  : selected.todayAppts.map(a => (
                    <div key={a.id} className="flex items-center gap-s-3 py-s-1 text-small">
                      <span className="font-mono text-ink-3 w-12">{format(new Date(a.starts_at),'HH:mm')}</span>
                      <span className="flex-1 text-ink">{a.patient_name}</span>
                      <Badge variant="neutral" className="text-micro">{a.status}</Badge>
                    </div>
                  ))
                }
              </div>
              <div className="border-t border-line pt-s-3 flex flex-col gap-s-2">
                <p className="text-small font-semibold text-ink">Horaires planifiés</p>
                {selected.schedules.map((s, i) => (
                  <span key={i} className="text-small text-ink-3">
                    {s.start_time} – {s.end_time}
                  </span>
                ))}
                {!selected.schedules.length && <p className="text-small text-ink-3">Aucun planning actif</p>}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

// ── Graphique barres semaine ───────────────────────────────────────────────────

function WeekMiniChart({ days, loading }: { days: DayCount[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-24 rounded-md" />
  const maxVal = Math.max(...days.map(d => d.confirmed + d.pending + d.cancelled), 1)

  return (
    <div className="flex items-end gap-s-1 h-20 px-s-2">
      {days.map(d => {
        const total = d.confirmed + d.pending + d.cancelled
        const h = (total / maxVal) * 100
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-s-1 group" title={`${d.label}: ${total} RDV`}>
            <span className="text-micro text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity">{total}</span>
            <div className="w-full rounded-t overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(h, 4)}%` }}>
              {d.cancelled > 0 && (
                <div className="w-full bg-line" style={{ height: `${(d.cancelled/Math.max(total,1))*100}%` }} />
              )}
              {d.pending > 0 && (
                <div className="w-full bg-sky-300" style={{ height: `${(d.pending/Math.max(total,1))*100}%` }} />
              )}
              {d.confirmed > 0 && (
                <div className="w-full bg-primary" style={{ height: `${(d.confirmed/Math.max(total,1))*100}%` }} />
              )}
            </div>
            <span className="text-micro text-ink-3">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal absence/urgence ─────────────────────────────────────────────────────

const EXCEPTION_TYPES = [
  { value: 'conge',         label: 'Congé' },
  { value: 'absence',       label: 'Absence' },
  { value: 'urgence',       label: 'Urgence' },
  { value: 'formation',     label: 'Formation' },
  { value: 'deplacement',   label: 'Déplacement' },
  { value: 'fermeture',     label: 'Fermeture service' },
]

function AbsenceModal({
  open, onClose, professionals, establishmentId,
}: {
  open: boolean
  onClose: () => void
  professionals: { professional_id: string; name: string }[]
  establishmentId: string
}) {
  const [proId,     setProId]     = useState('')
  const [date,      setDate]      = useState(format(new Date(), 'yyyy-MM-dd'))
  const [type,      setType]      = useState('absence')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime,   setEndTime]   = useState('18:00')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    if (!proId || !date) return
    setSaving(true)
    try {
      const { error } = await (supabase as any)
        .from('schedule_exceptions')
        .insert({
          professional_id:  proId,
          establishment_id: establishmentId,
          exception_type:   type,
          date,
          start_time:  startTime || null,
          end_time:    endTime   || null,
          reason:      reason    || null,
          created_by:  (await supabase.auth.getUser()).data.user?.id,
        })
      if (error) throw error
      toast.success('Exception de planning enregistrée')
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={o => !o && onClose()} title="Ajouter une absence / exception">
      <div className="flex flex-col gap-s-3">
        <div className="flex flex-col gap-s-1">
          <label className="text-small font-medium text-ink">Professionnel</label>
          <select
            value={proId}
            onChange={e => setProId(e.target.value)}
            className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink"
          >
            <option value="">Sélectionner…</option>
            {professionals.map(p => (
              <option key={p.professional_id} value={p.professional_id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-s-3">
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-medium text-ink">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-medium text-ink">Type</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink">
              {EXCEPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-s-3">
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-medium text-ink">Début</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-medium text-ink">Fin</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink" />
          </div>
        </div>

        <div className="flex flex-col gap-s-1">
          <label className="text-small font-medium text-ink">Motif (optionnel)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            className="w-full rounded-md border border-line bg-bg px-s-3 py-s-2 text-small text-ink resize-none"
            placeholder="Ex: Congé maladie, formation…" />
        </div>

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button variant="primary" size="sm" onClick={handleSave}
            disabled={!proId || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Dashboard principal ────────────────────────────────────────────────────────

export default function EtabHealthDashboard() {
  const navigate = useNavigate()
  const { establishmentId, establishmentName, theme, loading: ctxLoading } = useEtabHealth()

  // ── État ───────────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true)
  const [proRows, setProRows]   = useState<ProRow[]>([])
  const [weekDays, setWeekDays] = useState<DayCount[]>([])
  const [kpi, setKpi] = useState({
    totalAppts: 0, arrived: 0, inConsult: 0, teamCount: 0,
    slotsAvailable: 0, prescrDraft: 0,
  })

  const [showAbsence, setShowAbsence] = useState(false)

  const today = new Date()
  const dow   = today.getDay() // 0=dim, 1=lun…
  const pgDow = dow // Postgres day_of_week: 0=Sun…6=Sat
  const todayStr   = format(today, 'yyyy-MM-dd')
  const startToday = startOfDay(today).toISOString()
  const endToday   = endOfDay(today).toISOString()
  const dateLabel  = format(today, "EEEE d MMMM yyyy", { locale: fr })

  const load = useCallback(async () => {
    if (!establishmentId) return
    setLoading(true)

    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const [apptRes, teamRes, schedRes, excepRes, slotsRes, weekRes, prescrRes] = await Promise.all([
      // RDV du jour
      (supabase as any)
        .from('appointments')
        .select('id, starts_at, status, professional_id, patients:patient_id(profiles(full_name))')
        .eq('establishment_id', establishmentId)
        .gte('starts_at', startToday)
        .lte('starts_at', endToday)
        .not('status', 'in', `(${CANCELLED_STATUSES.map(s => `"${s}"`).join(',')})`)
        .order('starts_at'),

      // Équipe rattachée
      (supabase as any)
        .from('professional_establishments')
        .select('professional_id, professionals:professional_id(profiles(full_name))')
        .eq('establishment_id', establishmentId)
        .eq('status', 'active'),

      // Plannings actifs aujourd'hui
      (supabase as any)
        .from('schedules')
        .select('professional_id, start_time, end_time')
        .eq('establishment_id', establishmentId)
        .eq('status', 'active')
        .eq('day_of_week', pgDow)
        .lte('valid_from', todayStr)
        .or(`valid_until.is.null,valid_until.gte.${todayStr}`)
        .is('deleted_at', null),

      // Exceptions du jour
      (supabase as any)
        .from('schedule_exceptions')
        .select('professional_id')
        .eq('establishment_id', establishmentId)
        .eq('date', todayStr),

      // Créneaux disponibles 7j
      (supabase as any)
        .from('appointment_slots')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .eq('status', 'available')
        .gte('starts_at', today.toISOString())
        .lte('starts_at', sevenDaysLater),

      // RDV semaine pour graphique
      (supabase as any)
        .from('appointments')
        .select('starts_at, status')
        .eq('establishment_id', establishmentId)
        .gte('starts_at', weekStart.toISOString())
        .lte('starts_at', addDays(weekStart, 6).toISOString()),

      // Ordonnances draft des pros de l'établissement
      (supabase as any)
        .from('prescriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft')
        .in('professional_id',
          // sous-requête inline simulée côté client : on refiltre après
          [] // rempli ci-dessous
        ),
    ])

    // ── RDV du jour ──────────────────────────────────────────────────────────
    const rawAppts: any[] = apptRes.data ?? []
    const appts: Appt[] = rawAppts.map(a => ({
      id:              a.id,
      starts_at:       a.starts_at,
      status:          a.status,
      professional_id: a.professional_id,
      patient_name:    a.patients?.profiles?.full_name ?? 'Patient',
    }))

    // ── Équipe ───────────────────────────────────────────────────────────────
    const rawTeam: any[] = teamRes.data ?? []
    const teamMap = new Map<string, string>(
      rawTeam.map(t => [t.professional_id, t.professionals?.profiles?.full_name ?? 'Professionnel'])
    )

    // ── Plannings + exceptions → rows timeline ────────────────────────────────
    const rawSchedules: any[]  = schedRes.data ?? []
    const rawExceptions: any[] = excepRes.data ?? []
    const exceptedProIds = new Set(rawExceptions.map((e: any) => e.professional_id))

    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const schedByPro = rawSchedules.reduce<Record<string, { start_time: string; end_time: string }[]>>((acc, s: any) => {
      if (!acc[s.professional_id]) acc[s.professional_id] = []
      acc[s.professional_id].push({ start_time: s.start_time, end_time: s.end_time })
      return acc
    }, {})

    // Construire les rows pour tous les pros rattachés
    const rows: ProRow[] = rawTeam.map((t: any) => {
      const pid       = t.professional_id
      const todayAppts = appts.filter(a => a.professional_id === pid)
      const isActive  = todayAppts.some(a => a.status === 'in_consultation' || a.status === 'patient_arrived')
      const hasFutureAppt = todayAppts.some(a => {
        const apptMin = minuteFromMidnight(format(new Date(a.starts_at), 'HH:mm'))
        return apptMin >= nowMin
      })
      return {
        professional_id: pid,
        name:            teamMap.get(pid) ?? 'Professionnel',
        schedules:       schedByPro[pid] ?? [],
        hasException:    exceptedProIds.has(pid),
        isActive,
        hasFutureAppt,
        todayAppts,
      }
    })

    setProRows(rows)

    // ── KPIs ─────────────────────────────────────────────────────────────────
    setKpi({
      totalAppts:     appts.length,
      arrived:        appts.filter(a => a.status === 'patient_arrived').length,
      inConsult:      appts.filter(a => a.status === 'in_consultation').length,
      teamCount:      rawTeam.length,
      slotsAvailable: slotsRes.count ?? 0,
      prescrDraft:    prescrRes.count ?? 0,
    })

    // ── Graphique semaine ──────────────────────────────────────────────────────
    const weekAppts: any[] = weekRes.data ?? []
    const days: DayCount[] = Array.from({ length: 7 }, (_, i) => {
      const d      = addDays(weekStart, i)
      const dStr   = format(d, 'yyyy-MM-dd')
      const dayAppts = weekAppts.filter((a: any) => a.starts_at?.startsWith(dStr))
      return {
        date:      dStr,
        label:     format(d, 'EEE', { locale: fr }),
        confirmed: dayAppts.filter((a: any) => !CANCELLED_STATUSES.includes(a.status) && a.status !== 'requested').length,
        pending:   dayAppts.filter((a: any) => a.status === 'requested').length,
        cancelled: dayAppts.filter((a: any) => CANCELLED_STATUSES.includes(a.status)).length,
      }
    })
    setWeekDays(days)

    setLoading(false)
  }, [establishmentId])

  useEffect(() => {
    if (!ctxLoading && establishmentId) load()
    else if (!ctxLoading) setLoading(false)
  }, [ctxLoading, establishmentId, load])

  // ── État vide ──────────────────────────────────────────────────────────────

  if (ctxLoading) {
    return (
      <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-s-3">
          {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!establishmentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-s-3 text-ink-3">
        <p className="text-body">Aucun établissement associé à votre compte.</p>
      </div>
    )
  }

  const teamForModal = proRows.map(r => ({ professional_id: r.professional_id, name: r.name }))

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-s-6 p-s-4 md:p-s-6 max-w-5xl mx-auto"
    >
      {/* En-tête */}
      <motion.div variants={itemVariants} className="flex flex-col gap-s-1">
        <div className="flex items-center gap-s-3 flex-wrap">
          <h1 className="text-h2 font-display font-bold text-ink">{establishmentName}</h1>
          <OrgSelector />
        </div>
        <p className="text-small text-ink-3 capitalize">{dateLabel}</p>
      </motion.div>

      {/* ── Section 4.2 — KPI Tuiles ─────────────────────────────────────── */}
      <motion.div variants={itemVariants}
        className="grid grid-cols-2 md:grid-cols-3 gap-s-3"
      >
        {loading ? (
          [0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-md" />)
        ) : (
          <>
            <KpiTile
              label="RDV aujourd'hui"
              value={String(kpi.totalAppts)}
              subtext="Confirmés + en cours"
              onClick={() => navigate('/etab-health/patients')}
            />
            <KpiTile
              label="Patients attendus"
              value={`${kpi.arrived} / ${kpi.totalAppts}`}
              subtext="Arrivés / Attendus"
              variant={kpi.totalAppts > 0 && kpi.arrived / kpi.totalAppts > 0.8 ? 'success' : 'default'}
            />
            <KpiTile
              label="En consultation"
              value={String(kpi.inConsult)}
              variant={kpi.inConsult > 0 ? 'success' : 'default'}
            />
            <KpiTile
              label="Ordonnances draft"
              value={String(kpi.prescrDraft)}
              subtext="À finaliser"
              variant={kpi.prescrDraft > 3 ? 'warning' : 'default'}
              onClick={() => navigate('/etab-health/dossiers')}
            />
            <KpiTile
              label="Créneaux disponibles"
              value={String(kpi.slotsAvailable)}
              subtext="Dans les 7 prochains jours"
              onClick={() => navigate('/etab-health/patients')}
            />
            <KpiTile
              label="Équipe rattachée"
              value={String(kpi.teamCount)}
              onClick={() => navigate('/etab-health/equipe')}
            />
          </>
        )}
      </motion.div>

      {/* ── Section 4.1 — Timeline professionnels ────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="p-s-4 flex flex-col gap-s-4">
          <div className="flex items-center justify-between flex-wrap gap-s-2">
            <h2 className={`text-body font-semibold flex items-center gap-s-2 ${theme.textClass}`}>
              <Clock className="h-4 w-4" />
              Timeline du jour
            </h2>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-3 w-3" />}
              onClick={() => setShowAbsence(true)}
            >
              Absence / Exception
            </Button>
          </div>
          <ProfessionalTimeline rows={proRows} loading={loading} />
        </Card>
      </motion.div>

      {/* ── Section 4.3 — Actions rapides ────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="p-s-4 flex flex-col gap-s-3">
          <h2 className="text-body font-semibold text-ink">Actions du jour</h2>
          <div className="flex flex-wrap gap-s-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CalendarDays className="h-4 w-4" />}
              onClick={() => navigate('/etab-health/patients')}
            >
              Nouveau rendez-vous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FlaskConical className="h-4 w-4" />}
              onClick={() => navigate('/etab-health/examens')}
            >
              Demande d'examen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<AlertTriangle className="h-4 w-4" />}
              onClick={() => setShowAbsence(true)}
            >
              Ajouter absence
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={() => navigate('/etab-health/examens')}
            >
              Voir rapports
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Pill className="h-4 w-4" />}
              onClick={() => navigate('/etab-health/pharmacie')}
            >
              Gestion pharmacie
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* ── Section 4.4 — Graphique semaine ──────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="p-s-4 flex flex-col gap-s-3">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink flex items-center gap-s-2">
              <Calendar className="h-4 w-4 text-ink-3" />
              Cette semaine
            </h2>
            <div className="flex gap-s-3 text-micro text-ink-3">
              <span className="flex items-center gap-s-1"><span className="h-2 w-3 rounded bg-primary inline-block"/>Confirmés</span>
              <span className="flex items-center gap-s-1"><span className="h-2 w-3 rounded bg-sky-300 inline-block"/>En attente</span>
              <span className="flex items-center gap-s-1"><span className="h-2 w-3 rounded bg-line inline-block"/>Annulés</span>
            </div>
          </div>
          <WeekMiniChart days={weekDays} loading={loading} />
        </Card>
      </motion.div>

      {/* Modals */}
      <AbsenceModal
        open={showAbsence}
        onClose={() => setShowAbsence(false)}
        professionals={teamForModal}
        establishmentId={establishmentId}
      />
    </motion.div>
  )
}
