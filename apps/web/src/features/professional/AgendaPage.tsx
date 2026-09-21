import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Plus, Settings2, CalendarOff,
  X, Check, Clock, User, AlertTriangle, List, Calendar,
  Play, RefreshCw, Ban, Download,
} from 'lucide-react'
import {
  format, addDays, addWeeks, addMonths, subWeeks, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameDay, isToday, parseISO, differenceInYears,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { AllergyBadge } from '@/components/praticien/AllergyBadge'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_START = 7
const HOUR_END   = 21
const SLOT_MINS  = 30
const SLOTS_COUNT = ((HOUR_END - HOUR_START) * 60) / SLOT_MINS   // 28
const ROW_H      = 40  // px per 30-min slot

const TYPE_STYLES: Record<string, string> = {
  consultation:    'bg-sky-100   border-sky-400   text-sky-800',
  urgence:         'bg-red-100   border-red-400   text-red-800',
  suivi:           'bg-emerald-100 border-emerald-400 text-emerald-800',
  teleconsultation:'bg-purple-100 border-purple-400 text-purple-800',
}
const TYPE_DOT: Record<string, string> = {
  consultation:    'bg-sky-400',
  urgence:         'bg-red-400',
  suivi:           'bg-emerald-400',
  teleconsultation:'bg-purple-400',
}
const TYPE_OPTS = [
  { value: 'consultation',    label: 'Consultation' },
  { value: 'suivi',           label: 'Suivi' },
  { value: 'urgence',         label: 'Urgence' },
  { value: 'teleconsultation',label: 'Téléconsultation' },
]
const DURATION_OPTS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
]
const BLOCK_TYPE_OPTS = [
  { value: 'conge',    label: 'Congé' },
  { value: 'formation',label: 'Formation' },
  { value: 'absence',  label: 'Absence' },
]
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_FULL  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

const STATUS_LABEL: Record<string, string> = {
  pending:                'En attente',
  confirmed:              'Confirmé',
  patient_arrived:        'Arrivé',
  in_consultation:        'En cours',
  completed:              'Terminé',
  no_show:                'Absent',
  cancelled_patient:      'Annulé',
  cancelled_professional: 'Annulé',
}
const STATUS_VARIANT: Record<string, 'neutral'|'primary'|'success'|'accent'|'pending'|'danger'> = {
  pending:                'pending',
  confirmed:              'primary',
  patient_arrived:        'success',
  in_consultation:        'accent',
  completed:              'neutral',
  no_show:                'danger',
  cancelled_patient:      'danger',
  cancelled_professional: 'danger',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appt {
  id: string
  starts_at: string
  ends_at?: string | null
  duration_minutes?: number | null
  status: string
  type?: string | null
  motif?: string | null
  patient_id: string
  patient?: {
    id: string
    full_name: string
    date_naissance?: string | null
    avatar_url?: string | null
    allergies?: string[]
  } | null
}

interface ScheduleDay {
  day_of_week: number
  is_active: boolean
  start_time: string
  end_time: string
  break_start?: string | null
  break_end?: string | null
  slot_duration: number
  max_per_day?: number | null
}

interface BlockedPeriod {
  id: string
  date_debut: string
  date_fin: string
  motif?: string | null
  type: string
}

interface PatientSearch {
  id: string
  full_name: string
  telephone?: string | null
  avatar_url?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotOffset(dt: Date): number {
  return (dt.getHours() - HOUR_START) * 2 + Math.floor(dt.getMinutes() / 30)
}

function getWeekDays(ref: Date): Date[] {
  const mon = startOfWeek(ref, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

function isBlocked(date: Date, blocks: BlockedPeriod[]): boolean {
  const d = format(date, 'yyyy-MM-dd')
  return blocks.some(b => d >= b.date_debut && d <= b.date_fin)
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Une "étiquette" de RDV positionnée dans la grille */
function ApptChip({ appt, onClick, compact = false }: { appt: Appt; onClick: () => void; compact?: boolean }) {
  const start = parseISO(appt.starts_at)
  const dur = appt.duration_minutes ?? 30
  const top  = slotOffset(start) * ROW_H
  const h    = Math.max((dur / 30) * ROW_H, ROW_H * 0.75)
  const style = TYPE_STYLES[appt.type ?? ''] ?? 'bg-primary/15 border-primary text-primary'

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{ top, height: h, left: 2, right: 2 }}
      className={cn(
        'absolute overflow-hidden rounded border text-left text-micro font-medium px-1 py-0.5 transition-opacity hover:opacity-80 z-10',
        style,
      )}
      title={appt.patient?.full_name ?? 'Patient'}
    >
      <p className="truncate font-semibold">{format(start, 'HH:mm')}</p>
      {h >= ROW_H && <p className="truncate">{appt.patient?.full_name ?? 'Patient'}</p>}
    </button>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ days, appts, blocks, onApptClick }: {
  days: Date[]
  appts: Appt[]
  blocks: BlockedPeriod[]
  onApptClick: (a: Appt) => void
}) {
  const timeLabels = Array.from({ length: SLOTS_COUNT }, (_, i) => {
    const h = HOUR_START + Math.floor(i / 2)
    const m = i % 2 === 0 ? '00' : '30'
    return `${String(h).padStart(2, '0')}:${m}`
  })

  return (
    <div className="overflow-auto rounded-lg border border-line">
      {/* Header */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-line bg-surface-2">
        <div className="p-s-2 text-micro text-ink-3" />
        {days.map((d, i) => (
          <div key={i} className={cn(
            'p-s-2 text-center',
            isToday(d) ? 'bg-primary-soft' : '',
          )}>
            <p className="text-micro font-medium text-ink-3">{DAY_NAMES[i]}</p>
            <p className={cn(
              'text-small font-bold',
              isToday(d) ? 'text-primary' : 'text-ink',
            )}>{format(d, 'd')}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="relative grid grid-cols-[48px_repeat(7,1fr)]" style={{ minHeight: SLOTS_COUNT * ROW_H }}>
        {/* Time labels */}
        <div className="relative">
          {timeLabels.map((lbl, i) => (
            i % 2 === 0 && (
              <div
                key={lbl}
                style={{ top: i * ROW_H - 8, height: ROW_H }}
                className="absolute right-2 text-micro text-ink-3 leading-none select-none"
              >
                {lbl}
              </div>
            )
          ))}
          {/* Hour lines */}
          {timeLabels.map((_, i) => (
            <div key={i} style={{ top: i * ROW_H }} className={cn(
              'absolute left-0 right-0 border-t',
              i % 2 === 0 ? 'border-line' : 'border-line/40',
            )} />
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, di) => {
          const dayAppts = appts.filter(a => isSameDay(parseISO(a.starts_at), day))
          const blocked  = isBlocked(day, blocks)
          return (
            <div
              key={di}
              className={cn(
                'relative border-l border-line',
                isToday(day) ? 'bg-primary-soft/30' : '',
              )}
              style={{ minHeight: SLOTS_COUNT * ROW_H }}
            >
              {/* Hour lines */}
              {timeLabels.map((_, i) => (
                <div key={i} style={{ top: i * ROW_H }} className={cn(
                  'absolute left-0 right-0 border-t',
                  i % 2 === 0 ? 'border-line' : 'border-line/40',
                )} />
              ))}
              {/* Blocked overlay */}
              {blocked && (
                <div className="absolute inset-0 z-5 bg-repeating-diagonal opacity-30 pointer-events-none"
                  style={{ backgroundImage: 'repeating-linear-gradient(45deg,#9ca3af 0,#9ca3af 1px,transparent 0,transparent 50%)' ,
                    backgroundSize: '8px 8px' }} />
              )}
              {/* Appointments */}
              {dayAppts.map(a => (
                <ApptChip key={a.id} appt={a} onClick={() => onApptClick(a)} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ day, appts, blocks, onApptClick }: {
  day: Date; appts: Appt[]; blocks: BlockedPeriod[]; onApptClick: (a: Appt) => void
}) {
  const blocked = isBlocked(day, blocks)
  const dayAppts = appts.filter(a => isSameDay(parseISO(a.starts_at), day))
  const timeLabels = Array.from({ length: SLOTS_COUNT }, (_, i) => {
    const h = HOUR_START + Math.floor(i / 2)
    const m = i % 2 === 0 ? '00' : '30'
    return `${String(h).padStart(2, '0')}:${m}`
  })

  return (
    <div className="overflow-auto rounded-lg border border-line">
      <div className="grid grid-cols-[64px_1fr]" style={{ minHeight: SLOTS_COUNT * ROW_H }}>
        <div className="relative border-r border-line">
          {timeLabels.map((lbl, i) => (
            i % 2 === 0 ? (
              <div key={lbl} style={{ top: i * ROW_H - 8 }} className="absolute right-2 text-micro text-ink-3 leading-none">
                {lbl}
              </div>
            ) : null
          ))}
        </div>
        <div className="relative" style={{ minHeight: SLOTS_COUNT * ROW_H }}>
          {timeLabels.map((_, i) => (
            <div key={i} style={{ top: i * ROW_H }} className={cn(
              'absolute left-0 right-0 border-t',
              i % 2 === 0 ? 'border-line' : 'border-line/40',
            )} />
          ))}
          {blocked && (
            <div className="absolute inset-0 bg-gray-100 opacity-60 pointer-events-none" />
          )}
          {dayAppts.map(a => <ApptChip key={a.id} appt={a} onClick={() => onApptClick(a)} />)}
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ currentMonth, appts, blocks, onDayClick }: {
  currentMonth: Date; appts: Appt[]; blocks: BlockedPeriod[]; onDayClick: (d: Date) => void
}) {
  const start = startOfMonth(currentMonth)
  const end   = endOfMonth(currentMonth)
  const gridStart = startOfWeek(start, { weekStartsOn: 1 })
  const days: Date[] = []
  let cur = gridStart
  while (cur <= end || days.length % 7 !== 0) {
    days.push(cur)
    cur = addDays(cur, 1)
    if (days.length > 42) break
  }

  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {DAY_NAMES.map(d => (
          <div key={d} className="p-s-2 text-center text-micro font-semibold text-ink-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth  = d.getMonth() === currentMonth.getMonth()
          const isTodayDay = isToday(d)
          const blocked  = isBlocked(d, blocks)
          const dayAppts = appts.filter(a => isSameDay(parseISO(a.starts_at), d))
          const typeCounts: Record<string, number> = {}
          dayAppts.forEach(a => { typeCounts[a.type ?? 'consultation'] = (typeCounts[a.type ?? 'consultation'] ?? 0) + 1 })

          return (
            <button
              key={i}
              onClick={() => inMonth && onDayClick(d)}
              className={cn(
                'relative min-h-[80px] border-b border-r border-line p-s-1 text-left transition-colors',
                inMonth ? 'hover:bg-surface-2' : 'opacity-30',
                isTodayDay ? 'bg-primary-soft' : blocked ? 'bg-gray-50' : '',
              )}
            >
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-small font-medium',
                isTodayDay ? 'bg-primary text-white' : 'text-ink',
              )}>
                {format(d, 'd')}
              </span>
              {blocked && <div className="mt-0.5 text-micro text-gray-400">🚫 Bloqué</div>}
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {Object.entries(typeCounts).map(([type, count]) => (
                  <span key={type} className="flex items-center gap-0.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[type] ?? 'bg-primary')} />
                    <span className="text-micro text-ink-3">{count}</span>
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── RDV Detail Panel ──────────────────────────────────────────────────────────

function RdvDetailPanel({ appt, onClose, onDemarrer, onAnnuler, loading }: {
  appt: Appt
  onClose: () => void
  onDemarrer: (id: string) => void
  onAnnuler: (id: string) => void
  loading: boolean
}) {
  const navigate  = useNavigate()
  const start     = parseISO(appt.starts_at)
  const age       = appt.patient?.date_naissance
    ? differenceInYears(new Date(), parseISO(appt.patient.date_naissance))
    : null
  const allergies = appt.patient?.allergies ?? []

  return (
    <Card className="flex w-72 shrink-0 flex-col gap-s-4 p-s-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-s-2">
          <Avatar src={appt.patient?.avatar_url} fallback={appt.patient?.full_name ?? 'P'} size="md" />
          <div>
            <p className="font-semibold text-ink">{appt.patient?.full_name ?? 'Patient inconnu'}</p>
            {age !== null && <p className="text-small text-ink-3">{age} ans</p>}
          </div>
        </div>
        <button onClick={onClose} className="rounded p-s-1 text-ink-3 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Allergies */}
      {allergies.length > 0 && (
        <div className="flex flex-wrap gap-s-1">
          {allergies.map(a => <AllergyBadge key={a} allergen={a} level="severe" />)}
        </div>
      )}

      {/* Infos RDV */}
      <div className="flex flex-col gap-s-2 rounded-lg bg-surface-2 p-s-3">
        <div className="flex items-center gap-s-2 text-small">
          <Clock className="h-4 w-4 shrink-0 text-ink-3" />
          <span className="text-ink">
            {format(start, 'EEEE d MMMM', { locale: fr })} à {format(start, 'HH:mm')}
          </span>
        </div>
        {appt.duration_minutes && (
          <p className="text-small text-ink-3">Durée estimée : {appt.duration_minutes} min</p>
        )}
        {appt.type && (
          <span className={cn(
            'inline-flex w-fit rounded-pill border px-s-2 py-0.5 text-micro font-medium',
            TYPE_STYLES[appt.type] ?? 'bg-surface border-line text-ink',
          )}>
            {appt.type}
          </span>
        )}
        {appt.motif && <p className="text-small text-ink-2 italic">"{appt.motif}"</p>}
        <Badge variant={STATUS_VARIANT[appt.status] ?? 'neutral'}>
          {STATUS_LABEL[appt.status] ?? appt.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-s-2">
        {['confirmed', 'patient_arrived', 'pending'].includes(appt.status) && (
          <Button
            variant="primary" fullWidth loading={loading}
            leftIcon={<Play className="h-4 w-4" />}
            onClick={() => onDemarrer(appt.id)}
          >
            Démarrer la consultation
          </Button>
        )}
        {appt.status === 'in_consultation' && (
          <Button variant="primary" fullWidth onClick={() => navigate(`/pro/consultation/${appt.id}`)}>
            Ouvrir la consultation
          </Button>
        )}
        {!['completed', 'cancelled_patient', 'cancelled_professional', 'no_show'].includes(appt.status) && (
          <Button variant="ghost" fullWidth leftIcon={<Ban className="h-4 w-4" />}
            onClick={() => onAnnuler(appt.id)}>
            Annuler ce RDV
          </Button>
        )}
      </div>
    </Card>
  )
}

// ── Demandes Panel ────────────────────────────────────────────────────────────

function DemandesPanel({ demandes, onConfirm, onRefuse, onProposeAutre, loading }: {
  demandes: Appt[]
  onConfirm: (id: string) => void
  onRefuse: (id: string) => void
  onProposeAutre: (appt: Appt) => void
  loading: string | null
}) {
  if (demandes.length === 0) {
    return (
      <Card className="flex w-72 shrink-0 flex-col gap-s-3 p-s-4">
        <h3 className="font-semibold text-ink">Demandes en attente</h3>
        <p className="text-center py-s-6 text-small text-ink-3">Aucune demande</p>
      </Card>
    )
  }

  return (
    <Card className="flex w-72 shrink-0 flex-col gap-s-3 p-s-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Demandes en attente</h3>
        <span className="rounded-pill bg-amber-500 px-s-1.5 py-0.5 text-micro font-bold text-white">
          {demandes.length}
        </span>
      </div>
      <div className="flex flex-col gap-s-3 max-h-96 overflow-y-auto">
        {demandes.map(d => {
          const start = parseISO(d.starts_at)
          return (
            <div key={d.id} className="flex flex-col gap-s-2 rounded-lg border border-amber-200 bg-amber-50 p-s-3">
              <div className="flex items-center gap-s-2">
                <Avatar src={d.patient?.avatar_url} fallback={d.patient?.full_name ?? 'P'} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-small font-medium text-ink">{d.patient?.full_name ?? 'Patient'}</p>
                  <p className="text-micro text-ink-3">
                    {format(start, 'EEE d MMM', { locale: fr })} à {format(start, 'HH:mm')}
                  </p>
                </div>
              </div>
              {d.motif && <p className="text-micro text-ink-2 italic">"{d.motif}"</p>}
              <div className="flex gap-s-1">
                <button onClick={() => onConfirm(d.id)}
                  disabled={loading === d.id}
                  className="flex flex-1 items-center justify-center gap-s-1 rounded-md bg-emerald-500 py-1 text-micro font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50">
                  <Check className="h-3 w-3" /> Confirmer
                </button>
                <button onClick={() => onRefuse(d.id)}
                  disabled={loading === d.id}
                  className="flex flex-1 items-center justify-center gap-s-1 rounded-md bg-red-500 py-1 text-micro font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50">
                  <X className="h-3 w-3" /> Refuser
                </button>
                <button onClick={() => onProposeAutre(d)}
                  disabled={loading === d.id}
                  className="flex items-center justify-center rounded-md border border-line bg-surface px-s-2 py-1 text-micro text-ink-3 transition-colors hover:bg-surface-2">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Vue Liste ─────────────────────────────────────────────────────────────────

function VueListe({ appts, loading, onApptClick }: {
  appts: Appt[]; loading: boolean; onApptClick: (a: Appt) => void
}) {
  const [filter, setFilter] = useState<'aujourd_hui'|'semaine'|'mois'|string>('semaine')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const todayStr   = format(new Date(), 'yyyy-MM-dd')
  const weekEnd    = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const filtered = appts.filter(a => {
    const d = a.starts_at.slice(0, 10)
    if (filter === 'aujourd_hui' && d !== todayStr) return false
    if (filter === 'semaine' && (d < todayStr || d > weekEnd)) return false
    if (filter === 'mois' && (d < todayStr || d > monthEnd)) return false
    if (typeFilter && a.type !== typeFilter) return false
    if (statusFilter && a.status !== statusFilter) return false
    return true
  })

  function exportCsv() {
    const header = 'Date,Heure,Patient,Type,Motif,Statut'
    const rows = filtered.map(a =>
      [
        format(parseISO(a.starts_at), 'dd/MM/yyyy'),
        format(parseISO(a.starts_at), 'HH:mm'),
        a.patient?.full_name ?? '',
        a.type ?? '',
        a.motif ?? '',
        STATUS_LABEL[a.status] ?? a.status,
      ].map(v => `"${v}"`).join(',')
    )
    const csv = '﻿' + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `agenda_${filter}_${todayStr}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const FILTER_OPTS = [
    { value: 'aujourd_hui', label: "Aujourd'hui" },
    { value: 'semaine',     label: 'Cette semaine' },
    { value: 'mois',        label: 'Ce mois' },
  ]
  const STATUS_OPTS = [
    { value: '', label: 'Tous les statuts' },
    ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })),
  ]

  return (
    <div className="flex flex-col gap-s-3">
      <div className="flex flex-wrap items-center gap-s-2">
        <Select options={FILTER_OPTS} value={filter} onValueChange={setFilter} />
        <Select options={[{ value: '', label: 'Tous les types' }, ...TYPE_OPTS]} value={typeFilter} onValueChange={setTypeFilter} />
        <Select options={STATUS_OPTS} value={statusFilter} onValueChange={setStatusFilter} />
        <Button variant="ghost" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>
          CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              {['Date', 'Patient', 'Type', 'Motif', 'Durée', 'Statut', ''].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
                ? (
                    <tr>
                      <td colSpan={7} className="px-s-3 py-s-8 text-center text-ink-3">
                        Aucun rendez-vous pour cette période
                      </td>
                    </tr>
                  )
                : filtered.map(a => (
                    <tr key={a.id}
                      onClick={() => onApptClick(a)}
                      className="cursor-pointer border-b border-line transition-colors hover:bg-surface-2 last:border-0">
                      <td className="px-s-3 py-s-2 font-medium text-ink">
                        {format(parseISO(a.starts_at), 'dd/MM HH:mm')}
                      </td>
                      <td className="px-s-3 py-s-2 text-ink">
                        {a.patient?.full_name ?? '—'}
                      </td>
                      <td className="px-s-3 py-s-2">
                        {a.type && (
                          <span className={cn(
                            'rounded-pill border px-s-2 py-0.5 text-micro font-medium',
                            TYPE_STYLES[a.type] ?? '',
                          )}>
                            {a.type}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[12rem] truncate px-s-3 py-s-2 text-ink-3">{a.motif ?? '—'}</td>
                      <td className="px-s-3 py-s-2 text-ink-3">{a.duration_minutes ? `${a.duration_minutes} min` : '—'}</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </td>
                      <td className="px-s-3 py-s-2">
                        <ChevronRight className="h-4 w-4 text-ink-3" />
                      </td>
                    </tr>
                  ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Nouveau RDV Modal ─────────────────────────────────────────────────────────

function NouveauRdvModal({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void
}) {
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState<PatientSearch[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientSearch | null>(null)
  const [type, setType] = useState('consultation')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [heure, setHeure] = useState('09:00')
  const [duration, setDuration] = useState('30')
  const [motif, setMotif] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const db = supabase as any

  useEffect(() => {
    if (!search || search.length < 2) { setPatients([]); return }
    const t = setTimeout(async () => {
      const { data } = await db.from('profiles').select('id, full_name, telephone, avatar_url')
        .eq('role', 'patient')
        .ilike('full_name', `%${search}%`)
        .limit(8)
      setPatients(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function submit() {
    if (!selectedPatient) { toast.error('Sélectionner un patient'); return }
    setLoading(true)
    const starts_at = `${date}T${heure}:00`
    const { error } = await supabase.functions.invoke('create-rdv', {
      body: { patient_id: selectedPatient.id, type, motif, starts_at, duration_minutes: Number(duration), notes }
    })
    setLoading(false)
    if (error) { toast.error('Erreur lors de la création'); return }
    toast.success('Rendez-vous créé — patient notifié')
    onOpenChange(false); onCreated()
    // Reset
    setSearch(''); setSelectedPatient(null); setType('consultation'); setMotif(''); setNotes('')
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nouveau rendez-vous" size="md">
      <div className="flex flex-col gap-s-4">
        {/* Patient */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Patient</label>
          {selectedPatient ? (
            <div className="flex items-center gap-s-2 rounded-lg border border-primary bg-primary-soft p-s-2">
              <Avatar src={selectedPatient.avatar_url} fallback={selectedPatient.full_name} size="sm" />
              <span className="flex-1 text-small font-medium text-ink">{selectedPatient.full_name}</span>
              <button onClick={() => setSelectedPatient(null)} className="text-ink-3 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Rechercher par nom…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {patients.length > 0 && (
                <div className="absolute z-20 mt-s-1 w-full rounded-lg border border-line bg-surface shadow-2">
                  {patients.map(p => (
                    <button key={p.id}
                      onClick={() => { setSelectedPatient(p); setSearch(''); setPatients([]) }}
                      className="flex w-full items-center gap-s-2 px-s-3 py-s-2 text-left text-small hover:bg-surface-2">
                      <Avatar src={p.avatar_url} fallback={p.full_name} size="sm" />
                      <span>{p.full_name}</span>
                      {p.telephone && <span className="text-ink-3">{p.telephone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type + Durée */}
        <div className="grid grid-cols-2 gap-s-3">
          <Select label="Type" options={TYPE_OPTS} value={type} onValueChange={setType} />
          <Select label="Durée" options={DURATION_OPTS} value={duration} onValueChange={setDuration} />
        </div>

        {/* Date + Heure */}
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Heure" type="time" value={heure} onChange={e => setHeure(e.target.value)} />
        </div>

        {/* Motif */}
        <Input label="Motif (optionnel)" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Raison de la consultation" />

        {/* Notes */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Notes pour le patient (optionnel)</label>
          <textarea
            className="w-full rounded-lg border border-line bg-surface p-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Instructions particulières..."
          />
        </div>

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Créer le rendez-vous</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Disponibilités Modal ──────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: ScheduleDay[] = DAY_FULL.map((_, i) => ({
  day_of_week: i + 1,
  is_active: i < 5,
  start_time: '08:00',
  end_time: '18:00',
  break_start: '12:00',
  break_end: '14:00',
  slot_duration: 30,
  max_per_day: null,
}))

function DisponibilitesModal({ open, onOpenChange }: {
  open: boolean; onOpenChange: (o: boolean) => void
}) {
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE)
  const [loading, setLoading] = useState(false)
  const db = supabase as any

  useEffect(() => {
    if (!open) return
    // Load existing schedule
    ;(async () => {
      const { data } = await db.from('professional_schedules')
        .select('day_of_week, is_active, start_time, end_time, break_start, break_end, slot_duration, max_per_day')
        .order('day_of_week')
      if (data?.length) {
        const map: Record<number, ScheduleDay> = {}
        data.forEach((r: ScheduleDay) => { map[r.day_of_week] = r })
        setSchedule(DEFAULT_SCHEDULE.map(d => map[d.day_of_week] ?? d))
      }
    })()
  }, [open])

  function update(i: number, patch: Partial<ScheduleDay>) {
    setSchedule(s => s.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }

  async function save() {
    setLoading(true)
    const { error } = await supabase.functions.invoke('update-disponibilites', {
      body: {
        jours: schedule.map(d => ({
          day_of_week: d.day_of_week,
          active: d.is_active,
          start: d.start_time,
          end: d.end_time,
          break_start: d.break_start,
          break_end: d.break_end,
          slot_duration: d.slot_duration,
          max_per_day: d.max_per_day,
        }))
      }
    })
    setLoading(false)
    if (error) { toast.error('Erreur sauvegarde'); return }
    toast.success('Disponibilités enregistrées')
    onOpenChange(false)
  }

  const SLOT_OPTS = [
    { value: '15', label: '15 min' },
    { value: '20', label: '20 min' },
    { value: '30', label: '30 min' },
    { value: '45', label: '45 min' },
    { value: '60', label: '60 min' },
  ]

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Mes disponibilités" size="xl">
      <div className="flex flex-col gap-s-4">
        <div className="flex flex-col gap-s-3 max-h-[60vh] overflow-y-auto pr-s-1">
          {schedule.map((day, i) => (
            <div key={day.day_of_week} className={cn(
              'rounded-lg border p-s-3',
              day.is_active ? 'border-line bg-surface' : 'border-line/50 bg-surface-2 opacity-60',
            )}>
              <div className="flex items-center justify-between mb-s-3">
                <span className="font-medium text-ink">{DAY_FULL[i]}</span>
                <button
                  onClick={() => update(i, { is_active: !day.is_active })}
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    day.is_active ? 'bg-primary' : 'bg-ink-3',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    day.is_active ? 'translate-x-4' : 'translate-x-0.5',
                  )} />
                </button>
              </div>
              {day.is_active && (
                <div className="grid grid-cols-2 gap-s-2 md:grid-cols-4">
                  <Input label="Début" type="time" value={day.start_time}
                    onChange={e => update(i, { start_time: e.target.value })} />
                  <Input label="Fin" type="time" value={day.end_time}
                    onChange={e => update(i, { end_time: e.target.value })} />
                  <Input label="Pause début" type="time" value={day.break_start ?? ''}
                    onChange={e => update(i, { break_start: e.target.value || null })} />
                  <Input label="Pause fin" type="time" value={day.break_end ?? ''}
                    onChange={e => update(i, { break_end: e.target.value || null })} />
                  <div className="col-span-1">
                    <Select label="Durée créneaux" options={SLOT_OPTS}
                      value={String(day.slot_duration)}
                      onValueChange={v => update(i, { slot_duration: Number(v) })} />
                  </div>
                  <Input label="Max RDV/jour" type="number" min={1}
                    value={day.max_per_day ?? ''}
                    onChange={e => update(i, { max_per_day: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Illimité" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Bloquer Période Modal ─────────────────────────────────────────────────────

function BloquerPeriodeModal({ open, onOpenChange, onBlocked }: {
  open: boolean; onOpenChange: (o: boolean) => void; onBlocked: () => void
}) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [debut, setDebut] = useState(today)
  const [fin, setFin]     = useState(today)
  const [motif, setMotif] = useState('')
  const [type, setType]   = useState('conge')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (debut > fin) { toast.error('La date de début doit être avant la date de fin'); return }
    setLoading(true)
    const { error } = await supabase.functions.invoke('bloquer-periode', { body: { date_debut: debut, date_fin: fin, motif, type } })
    setLoading(false)
    if (error) { toast.error('Erreur'); return }
    toast.success('Période bloquée')
    onOpenChange(false); onBlocked()
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Bloquer une période" size="sm">
      <div className="flex flex-col gap-s-4">
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Du" type="date" value={debut} onChange={e => setDebut(e.target.value)} min={today} />
          <Input label="Au" type="date" value={fin} onChange={e => setFin(e.target.value)} min={debut} />
        </div>
        <Select label="Motif" options={BLOCK_TYPE_OPTS} value={type} onValueChange={setType} />
        <Input label="Détail (optionnel)" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Précision…" />
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={submit}>Bloquer</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type CalView = 'semaine' | 'jour' | 'mois'

export default function AgendaPage() {
  const { profile } = useAuth()
  const db = supabase as any

  const [view, setView] = useState<CalView>('semaine')
  const [mainView, setMainView] = useState<'calendrier' | 'liste'>('calendrier')
  const [refDate, setRefDate] = useState(new Date())

  const [appts, setAppts]         = useState<Appt[]>([])
  const [demandes, setDemandes]   = useState<Appt[]>([])
  const [blocks, setBlocks]       = useState<BlockedPeriod[]>([])
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null)

  const [showNouveauRdv,  setShowNouveauRdv]  = useState(false)
  const [showDispos,      setShowDispos]       = useState(false)
  const [showBloquer,     setShowBloquer]      = useState(false)
  const [refusTarget,     setRefusTarget]      = useState<string | null>(null)
  const [refusMotif,      setRefusMotif]       = useState('')
  const [annulerTarget,   setAnnulerTarget]    = useState<string | null>(null)

  // Date range for the current view
  const { rangeStart, rangeEnd, weekDays } = (() => {
    if (view === 'jour') {
      return { rangeStart: refDate, rangeEnd: refDate, weekDays: [refDate] }
    }
    if (view === 'semaine') {
      const days = getWeekDays(refDate)
      return { rangeStart: days[0], rangeEnd: days[6], weekDays: days }
    }
    // mois
    return { rangeStart: startOfMonth(refDate), rangeEnd: endOfMonth(refDate), weekDays: [] }
  })()

  // Navigation label
  const navLabel = view === 'jour'
    ? format(refDate, 'EEEE d MMMM yyyy', { locale: fr })
    : view === 'semaine'
      ? `${format(weekDays[0] ?? refDate, 'd MMM', { locale: fr })} – ${format(weekDays[6] ?? refDate, 'd MMM yyyy', { locale: fr })}`
      : format(refDate, 'MMMM yyyy', { locale: fr })

  function goNext() {
    if (view === 'jour')    setRefDate(d => addDays(d, 1))
    if (view === 'semaine') setRefDate(d => addWeeks(d, 1))
    if (view === 'mois')    setRefDate(d => addMonths(d, 1))
  }
  function goPrev() {
    if (view === 'jour')    setRefDate(d => addDays(d, -1))
    if (view === 'semaine') setRefDate(d => subWeeks(d, 1))
    if (view === 'mois')    setRefDate(d => subMonths(d, 1))
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadAppts = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const rStart = format(rangeStart, 'yyyy-MM-dd')
    const rEnd   = format(rangeEnd,   'yyyy-MM-dd')

    const [apptRes, demandesRes, blocksRes] = await Promise.all([
      db.from('appointments')
        .select(`
          id, starts_at, ends_at, duration_minutes, status, type, motif, patient_id,
          patient:patient_id (
            id,
            profiles!inner (id, full_name, date_naissance, avatar_url)
          )
        `)
        .eq('professional_id', profile.id)
        .gte('starts_at', `${rStart}T00:00:00`)
        .lte('starts_at', `${rEnd}T23:59:59`)
        .not('status', 'in', '(cancelled_patient,cancelled_professional)')
        .order('starts_at'),

      db.from('appointments')
        .select(`
          id, starts_at, ends_at, duration_minutes, status, type, motif, patient_id,
          patient:patient_id (
            id,
            profiles!inner (id, full_name, avatar_url)
          )
        `)
        .eq('professional_id', profile.id)
        .eq('status', 'pending')
        .order('starts_at'),

      db.from('schedule_exceptions')
        .select('id, date_debut, date_fin, motif, type')
        .eq('profile_id', profile.id)
        .gte('date_fin', rStart)
        .lte('date_debut', rEnd),
    ])

    const flatAppt = (apptRes.data ?? []).map((a: any) => ({
      ...a,
      patient: a.patient ? { ...a.patient.profiles, id: a.patient.id } : null,
    }))
    const flatDemandes = (demandesRes.data ?? []).map((a: any) => ({
      ...a,
      patient: a.patient ? { ...a.patient.profiles, id: a.patient.id } : null,
    }))

    setAppts(flatAppt)
    setDemandes(flatDemandes)
    setBlocks(blocksRes.data ?? [])
    setLoading(false)
  }, [profile?.id, rangeStart.toISOString(), rangeEnd.toISOString()])

  useEffect(() => { loadAppts() }, [loadAppts])

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`agenda-pro-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: `professional_id=eq.${profile.id}`,
      }, loadAppts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, loadAppts])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function demarrer(id: string) {
    setActionLoading(id)
    const { error } = await supabase.functions.invoke('demarrer-consultation', { body: { appointment_id: id } })
    setActionLoading(null)
    if (error) { toast.error('Impossible de démarrer'); return }
    toast.success('Consultation démarrée'); loadAppts()
  }

  async function annulerRdv() {
    if (!annulerTarget) return
    setActionLoading(annulerTarget)
    await supabase.functions.invoke('cancel-appointment', { body: { appointmentId: annulerTarget } })
    setActionLoading(null); setAnnulerTarget(null); setSelectedAppt(null)
    toast.success('RDV annulé'); loadAppts()
  }

  async function confirmerDemande(id: string) {
    setActionLoading(id)
    const { error } = await supabase.functions.invoke('confirm-rdv', { body: { appointment_id: id } })
    setActionLoading(null)
    if (error) { toast.error('Erreur'); return }
    toast.success('RDV confirmé — patient notifié'); loadAppts()
  }

  async function refuserDemande() {
    if (!refusTarget) return
    setActionLoading(refusTarget)
    const { error } = await supabase.functions.invoke('refuser-rdv', {
      body: { appointment_id: refusTarget, motif_refus: refusMotif }
    })
    setActionLoading(null); setRefusTarget(null); setRefusMotif('')
    if (error) { toast.error('Erreur'); return }
    toast.success('Demande refusée — patient notifié'); loadAppts()
  }

  // ── Month day click → switch to day view ──────────────────────────────────
  function onMonthDayClick(d: Date) {
    setRefDate(d); setView('jour')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const VIEW_OPTS: { value: CalView; icon: React.ReactNode; label: string }[] = [
    { value: 'jour',    icon: <Calendar className="h-4 w-4" />,   label: 'Jour'    },
    { value: 'semaine', icon: <Calendar className="h-4 w-4" />,   label: 'Semaine' },
    { value: 'mois',    icon: <Calendar className="h-4 w-4" />,   label: 'Mois'    },
  ]

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-s-2">
        {/* View selector */}
        <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
          {VIEW_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={cn(
                'rounded-md px-s-3 py-s-1.5 text-small font-medium transition-colors',
                view === opt.value ? 'bg-surface text-ink shadow-1' : 'text-ink-3 hover:text-ink',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-s-1">
          <button onClick={goPrev} className="rounded-md p-s-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[200px] text-center text-small font-medium text-ink capitalize">{navLabel}</span>
          <button onClick={goNext} className="rounded-md p-s-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => setRefDate(new Date())}>Aujourd'hui</Button>
        </div>

        {/* Toggle calendrier/liste */}
        <div className="ml-auto flex rounded-lg border border-line bg-surface-2 p-0.5">
          {(['calendrier','liste'] as const).map(v => (
            <button key={v} onClick={() => setMainView(v)}
              className={cn(
                'rounded-md px-s-3 py-s-1.5 text-small font-medium transition-colors',
                mainView === v ? 'bg-surface text-ink shadow-1' : 'text-ink-3 hover:text-ink',
              )}>
              {v === 'calendrier' ? <Calendar className="h-4 w-4 inline mr-1" /> : <List className="h-4 w-4 inline mr-1" />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowNouveauRdv(true)}>
          Nouveau RDV
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => setShowDispos(true)}>
          Disponibilités
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<CalendarOff className="h-4 w-4" />} onClick={() => setShowBloquer(true)}>
          Bloquer
        </Button>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex gap-s-4">

        {/* Calendrier / Liste */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-96 w-full rounded-lg" />
          ) : mainView === 'liste' ? (
            <VueListe appts={appts} loading={loading} onApptClick={a => setSelectedAppt(a)} />
          ) : view === 'semaine' ? (
            <WeekView days={weekDays} appts={appts} blocks={blocks} onApptClick={a => setSelectedAppt(a)} />
          ) : view === 'jour' ? (
            <DayView day={refDate} appts={appts} blocks={blocks} onApptClick={a => setSelectedAppt(a)} />
          ) : (
            <MonthView currentMonth={refDate} appts={appts} blocks={blocks} onDayClick={onMonthDayClick} />
          )}
        </div>

        {/* Side panel */}
        <AnimatePresence mode="wait">
          {selectedAppt ? (
            <motion.div key="detail"
              initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <RdvDetailPanel
                appt={selectedAppt}
                onClose={() => setSelectedAppt(null)}
                onDemarrer={demarrer}
                onAnnuler={(id) => setAnnulerTarget(id)}
                loading={actionLoading === selectedAppt.id}
              />
            </motion.div>
          ) : (
            <motion.div key="demandes"
              initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 32, opacity: 0 }}
              transition={{ duration: 0.15 }}>
              <DemandesPanel
                demandes={demandes}
                onConfirm={confirmerDemande}
                onRefuse={(id) => { setRefusTarget(id); setRefusMotif('') }}
                onProposeAutre={(appt) => toast.info('Fonctionnalité disponible dans la prochaine mise à jour')}
                loading={actionLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <NouveauRdvModal open={showNouveauRdv} onOpenChange={setShowNouveauRdv} onCreated={loadAppts} />
      <DisponibilitesModal open={showDispos} onOpenChange={setShowDispos} />
      <BloquerPeriodeModal open={showBloquer} onOpenChange={setShowBloquer} onBlocked={loadAppts} />

      {/* Refus modal */}
      <Modal open={!!refusTarget} onOpenChange={(o) => { if (!o) setRefusTarget(null) }} title="Refuser la demande" size="sm">
        <div className="flex flex-col gap-s-4">
          <Input
            label="Motif du refus (optionnel)"
            value={refusMotif}
            onChange={e => setRefusMotif(e.target.value)}
            placeholder="Complet, indisponible ce jour…"
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setRefusTarget(null)}>Annuler</Button>
            <Button variant="danger" loading={actionLoading === refusTarget} onClick={refuserDemande}>
              Refuser et notifier le patient
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!annulerTarget}
        onOpenChange={(o) => { if (!o) setAnnulerTarget(null) }}
        title="Annuler ce rendez-vous"
        message="Le patient sera notifié de l'annulation. Cette action est irréversible."
        confirmLabel="Confirmer l'annulation"
        variant="danger"
        loading={actionLoading === annulerTarget}
        onConfirm={annulerRdv}
      />
    </div>
  )
}
