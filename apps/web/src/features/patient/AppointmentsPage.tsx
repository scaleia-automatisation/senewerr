import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, isToday, addWeeks, subWeeks,
  differenceInMinutes, addMinutes, isBefore, isAfter, addDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays, List, Plus, ChevronLeft, ChevronRight, MapPin,
  Video, Download, X, Clock, Phone, Building2, Search,
  AlertTriangle, CheckCircle, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Banner } from '@/components/ui/Banner'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────
interface ApptSummary {
  id: string
  starts_at: string
  duration_minutes: number
  status: string
  type: string | null
  reason: string | null
  pro_name: string
  pro_specialty: string
  pro_avatar: string | null
  pro_profile_id: string | null
  professional_id: string
  org_name: string
  org_city: string
  address: string | null
  video_link: string | null
  consultation_report_id: string | null
}

interface Professional {
  id: string
  name: string
  specialty: string
  avatar: string | null
  org_name: string
  org_city: string
}

type ViewMode = 'calendar' | 'list'
type ListTab = 'upcoming' | 'past' | 'cancelled'

const UPCOMING_STATUSES = ['requested', 'confirmed', 'payment_pending', 'paid', 'patient_arrived', 'in_consultation']
const PAST_STATUSES = ['completed', 'no_show']

const STATUS_LABEL: Record<string, string> = {
  requested: 'En attente',
  confirmed: 'Confirmé',
  payment_pending: 'Paiement en attente',
  paid: 'Payé',
  patient_arrived: 'Arrivé',
  in_consultation: 'En cours',
  completed: 'Terminé',
  no_show: 'Non présenté',
  cancelled_patient: 'Annulé par vous',
  cancelled_professional: 'Annulé par praticien',
  cancelled_admin: 'Annulé',
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function statusDot(status: string): string {
  if (['confirmed', 'paid', 'completed'].includes(status)) return 'bg-status-success'
  if (['requested', 'payment_pending'].includes(status))   return 'bg-status-pending'
  if (['patient_arrived', 'in_consultation'].includes(status)) return 'bg-status-progress'
  if (status.startsWith('cancelled'))                       return 'bg-status-danger'
  return 'bg-ink-3'
}

function statusBg(status: string): string {
  if (['confirmed', 'paid', 'completed'].includes(status))  return 'bg-status-success/10 text-status-success'
  if (['requested', 'payment_pending'].includes(status))    return 'bg-status-pending/10 text-status-pending'
  if (['patient_arrived', 'in_consultation'].includes(status)) return 'bg-status-progress/10 text-status-progress'
  if (status.startsWith('cancelled'))                        return 'bg-status-danger/10 text-status-danger'
  return 'bg-surface-2 text-ink-3'
}

function canCancel(appt: ApptSummary): boolean {
  if (appt.status.startsWith('cancelled') || appt.status === 'completed' || appt.status === 'no_show') return false
  return differenceInMinutes(new Date(appt.starts_at), new Date()) > 60 * 24
}

function videoState(startsAt: string): { active: boolean; label: string } {
  const mins = differenceInMinutes(new Date(startsAt), new Date())
  if (mins > 15) return { active: false, label: `Disponible dans ${mins > 60 ? `${Math.floor(mins / 60)}h` : `${mins} min`}` }
  if (mins >= -30) return { active: true, label: 'Rejoindre la visio' }
  return { active: false, label: 'Séance terminée' }
}

function generateICS(appt: ApptSummary): string {
  const start = new Date(appt.starts_at)
  const end = addMinutes(start, appt.duration_minutes || 30)
  const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Séne Wérr//FR',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:RDV ${appt.pro_name}${appt.pro_specialty ? ` — ${appt.pro_specialty}` : ''}`,
    appt.reason ? `DESCRIPTION:${appt.reason}` : '',
    appt.address ? `LOCATION:${appt.address}` : appt.org_name ? `LOCATION:${appt.org_name}, ${appt.org_city}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

function downloadICS(appt: ApptSummary) {
  const blob = new Blob([generateICS(appt)], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `rdv-${appt.id.slice(0, 8)}.ics`
  a.click(); URL.revokeObjectURL(url)
}

// ─── MonthCalendar ─────────────────────────────────────────────────────────
function MonthCalendar({
  appointments, month, onMonthChange, onSelect,
}: {
  appointments: ApptSummary[]
  month: Date
  onMonthChange: (d: Date) => void
  onSelect: (a: ApptSummary) => void
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
  const days  = eachDayOfInterval({ start, end })
  const DAYS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="rounded-md border border-line bg-surface">
      {/* Nav */}
      <div className="flex items-center justify-between border-b border-line px-s-4 py-s-3">
        <button onClick={() => onMonthChange(subMonths(month, 1))} className="rounded-md p-1 hover:bg-surface-2 transition-colors">
          <ChevronLeft className="h-4 w-4 text-ink-2" />
        </button>
        <span className="font-display font-semibold text-ink capitalize">
          {format(month, 'MMMM yyyy', { locale: fr })}
        </span>
        <button onClick={() => onMonthChange(addMonths(month, 1))} className="rounded-md p-1 hover:bg-surface-2 transition-colors">
          <ChevronRight className="h-4 w-4 text-ink-2" />
        </button>
      </div>
      {/* Grid header */}
      <div className="grid grid-cols-7 border-b border-line">
        {DAYS.map(d => (
          <div key={d} className="py-s-2 text-center text-micro font-semibold uppercase tracking-wider text-ink-3">
            {d}
          </div>
        ))}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayAppts = appointments.filter(a => isSameDay(new Date(a.starts_at), day))
          const inMonth  = day.getMonth() === month.getMonth()
          const todayDay = isToday(day)
          return (
            <div
              key={idx}
              className={cn(
                'min-h-[72px] border-b border-r border-line p-s-1',
                !inMonth && 'bg-surface-2/40',
                idx % 7 === 6 && 'border-r-0',
                idx >= days.length - 7 && 'border-b-0',
              )}
            >
              <span className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-micro font-medium',
                todayDay ? 'bg-primary text-primary-fg' : inMonth ? 'text-ink' : 'text-ink-3',
              )}>
                {format(day, 'd')}
              </span>
              <div className="mt-s-1 flex flex-col gap-0.5">
                {dayAppts.slice(0, 2).map(a => (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className={cn(
                      'w-full rounded px-1 py-0.5 text-left text-micro font-medium leading-tight truncate transition-opacity hover:opacity-80',
                      statusBg(a.status),
                    )}
                  >
                    {format(new Date(a.starts_at), 'HH:mm')} {a.pro_name.split(' ').slice(-1)[0]}
                  </button>
                ))}
                {dayAppts.length > 2 && (
                  <button
                    onClick={() => onSelect(dayAppts[2])}
                    className="text-micro text-primary font-medium"
                  >
                    +{dayAppts.length - 2} autre{dayAppts.length - 2 > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ApptCard (list) ───────────────────────────────────────────────────────
function ApptCard({ appt, onClick }: { appt: ApptSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-line bg-surface p-s-4 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-start gap-s-3">
        <Avatar src={appt.pro_avatar} fallback={appt.pro_name} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-s-2">
            <div className="min-w-0">
              <p className="font-medium text-ink truncate">{appt.pro_name}</p>
              <p className="text-small text-ink-2">{appt.pro_specialty}</p>
            </div>
            <span className={cn('shrink-0 rounded-pill px-s-2 py-0.5 text-micro font-medium', statusBg(appt.status))}>
              {STATUS_LABEL[appt.status] ?? appt.status}
            </span>
          </div>
          <div className="mt-s-2 flex flex-wrap items-center gap-s-2">
            <span className="flex items-center gap-s-1 text-small text-ink-3">
              <Clock className="h-3.5 w-3.5" />
              {format(new Date(appt.starts_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
            </span>
            {appt.type && (
              <span className={cn(
                'rounded-pill px-s-2 py-0.5 text-micro font-medium',
                appt.type === 'teleconsultation' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-2',
              )}>
                {appt.type === 'teleconsultation' ? 'Téléconsultation' : 'Présentiel'}
              </span>
            )}
          </div>
          {appt.org_name && <p className="mt-s-1 text-micro text-ink-3">{appt.org_name}{appt.org_city ? `, ${appt.org_city}` : ''}</p>}
        </div>
      </div>
    </button>
  )
}

// ─── ApptDetailModal ───────────────────────────────────────────────────────
function ApptDetailModal({
  appt, onClose, onCancel, onNavigate,
}: {
  appt: ApptSummary
  onClose: () => void
  onCancel: () => void
  onNavigate: (path: string) => void
}) {
  const video  = appt.type === 'teleconsultation' ? videoState(appt.starts_at) : null
  const isPast = isBefore(new Date(appt.starts_at), new Date())

  return (
    <Modal open onOpenChange={v => !v && onClose()} title="Détail du rendez-vous" size="md">
      <div className="flex flex-col gap-s-4">
        {/* Praticien */}
        <div className="flex items-center gap-s-3">
          <Avatar src={appt.pro_avatar} fallback={appt.pro_name} size="lg" />
          <div>
            <p className="font-semibold text-ink">{appt.pro_name}</p>
            {appt.pro_specialty && <p className="text-small text-ink-2">{appt.pro_specialty}</p>}
            {appt.org_name && (
              <p className="flex items-center gap-s-1 text-micro text-ink-3 mt-s-1">
                <Building2 className="h-3 w-3" />
                {appt.org_name}{appt.org_city ? `, ${appt.org_city}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Statut */}
        <div className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2">
          <span className="text-small text-ink-2">Statut</span>
          <span className={cn('rounded-pill px-s-3 py-0.5 text-small font-medium', statusBg(appt.status))}>
            {STATUS_LABEL[appt.status] ?? appt.status}
          </span>
        </div>
        {appt.status === 'requested' && (
          <p className="text-small text-ink-2 flex items-center gap-s-2">
            <Clock className="h-4 w-4 text-status-pending shrink-0" />
            En attente de confirmation du praticien
          </p>
        )}

        {/* Date & durée */}
        <div className="rounded-md border border-line px-s-4 py-s-3 space-y-s-2">
          <div className="flex items-center justify-between">
            <span className="text-small text-ink-2 flex items-center gap-s-2">
              <CalendarDays className="h-4 w-4" />
              Date
            </span>
            <span className="text-small font-medium text-ink capitalize">
              {format(new Date(appt.starts_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
          </div>
          {appt.duration_minutes > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-small text-ink-2 flex items-center gap-s-2">
                <Clock className="h-4 w-4" />
                Durée
              </span>
              <span className="text-small font-medium text-ink">{appt.duration_minutes} min</span>
            </div>
          )}
          {appt.reason && (
            <div className="pt-s-1 border-t border-line">
              <p className="text-micro text-ink-3">Motif</p>
              <p className="text-small text-ink mt-0.5">{appt.reason}</p>
            </div>
          )}
        </div>

        {/* Présentiel ou visio */}
        {appt.type !== 'teleconsultation' && appt.address && (
          <div className="flex items-start gap-s-3">
            <MapPin className="h-4 w-4 text-ink-3 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-small text-ink">{appt.address}</p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(appt.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-micro text-primary hover:underline mt-s-1 inline-block"
              >
                Voir l'itinéraire →
              </a>
            </div>
          </div>
        )}
        {video && (
          <div className="flex items-center gap-s-3">
            <Video className="h-4 w-4 text-primary shrink-0" />
            {video.active && appt.video_link ? (
              <a
                href={appt.video_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-s-2 rounded-md bg-primary px-s-4 py-s-2 text-small font-medium text-primary-fg hover:bg-primary-hover transition-colors"
              >
                <Video className="h-4 w-4" />
                Rejoindre la visio
              </a>
            ) : (
              <div className="flex items-center gap-s-2">
                <button disabled className="flex items-center gap-s-2 rounded-md bg-surface-2 px-s-4 py-s-2 text-small font-medium text-ink-3 cursor-not-allowed">
                  <Video className="h-4 w-4" />
                  Rejoindre la visio
                </button>
                <span className="text-micro text-ink-3">{video.label}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-s-2 pt-s-1 border-t border-line">
          <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadICS(appt)}>
            Calendrier (.ics)
          </Button>
          {appt.consultation_report_id && (
            <Button size="sm" variant="secondary" onClick={() => { onClose(); onNavigate(`/patient/documents?doc_id=${appt.consultation_report_id}`) }}>
              Compte-rendu
            </Button>
          )}
          {!isPast && !appt.status.startsWith('cancelled') && (
            <Button size="sm" variant="ghost" disabled={!canCancel(appt)} onClick={onCancel}
              className="text-status-danger hover:bg-status-danger/5 disabled:text-ink-3">
              Annuler
            </Button>
          )}
        </div>
        {!canCancel(appt) && !isPast && !appt.status.startsWith('cancelled') && (
          <p className="text-micro text-ink-3">L'annulation n'est plus possible à moins de 24h du rendez-vous.</p>
        )}
      </div>
    </Modal>
  )
}

// ─── CancelModal ───────────────────────────────────────────────────────────
function CancelModal({ appt, loading, onClose, onConfirm }: {
  appt: ApptSummary; loading: boolean; onClose: () => void; onConfirm: () => void
}) {
  return (
    <Modal open onOpenChange={v => !v && onClose()} title="Annuler ce rendez-vous" size="sm">
      <div className="flex flex-col gap-s-4">
        <div className="flex items-start gap-s-3 rounded-md bg-surface-2 p-s-3">
          <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-small font-medium text-ink">{appt.pro_name}</p>
            <p className="text-small text-ink-2 capitalize">
              {format(new Date(appt.starts_at), "EEE d MMM 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        </div>
        <p className="text-small text-ink-2">Le praticien sera notifié. Cette action est irréversible.</p>
        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>Garder le RDV</Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading}>
            Confirmer l'annulation
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── BookDrawer ────────────────────────────────────────────────────────────
const TIMES = Array.from({ length: 21 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function BookDrawer({ open, onClose, patientId, onSuccess }: {
  open: boolean; onClose: () => void; patientId: string | null; onSuccess: () => void
}) {
  const db = supabase as any
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [pros, setPros] = useState<Professional[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null)
  const [slotWeek, setSlotWeek] = useState(new Date())
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [apptType, setApptType] = useState<'in_person' | 'teleconsultation'>('in_person')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const weekDays = useMemo(() => {
    const start = startOfWeek(slotWeek, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [slotWeek])

  useEffect(() => {
    if (!open) { setStep(1); setSelectedPro(null); setSelectedDate(null); setSelectedTime(null); setSearchQuery(''); setReason(''); setSubmitted(false) }
  }, [open])

  async function searchPros(q: string) {
    setSearchLoading(true)
    const { data } = await db.from('professionals')
      .select('id, specialty, profile:profiles(first_name, last_name, avatar_url), organization:organizations(name, city)')
      .or(`specialty.ilike.%${q}%`)
      .eq('verification_status', 'verified')
      .limit(10)
    setPros((data ?? []).map((p: any) => ({
      id: p.id,
      name: `${p.profile?.first_name ?? ''} ${p.profile?.last_name ?? ''}`.trim() || 'Praticien',
      specialty: p.specialty ?? '',
      avatar: p.profile?.avatar_url ?? null,
      org_name: p.organization?.name ?? '',
      org_city: p.organization?.city ?? '',
    })))
    setSearchLoading(false)
  }

  useEffect(() => {
    if (searchQuery.length >= 2) { const t = setTimeout(() => searchPros(searchQuery), 300); return () => clearTimeout(t) }
    else setPros([])
  }, [searchQuery])

  async function fetchTakenSlots(proId: string, week: Date) {
    const start = startOfWeek(week, { weekStartsOn: 1 })
    const end = endOfWeek(week, { weekStartsOn: 1 })
    const { data } = await db.from('appointments')
      .select('starts_at')
      .eq('professional_id', proId)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .not('status', 'like', 'cancelled_%')
    setTakenSlots((data ?? []).map((a: any) => a.starts_at))
  }

  useEffect(() => {
    if (selectedPro && step === 2) fetchTakenSlots(selectedPro.id, slotWeek)
  }, [selectedPro, slotWeek, step])

  function isSlotTaken(day: Date, time: string): boolean {
    const [h, m] = time.split(':').map(Number)
    const dt = new Date(day); dt.setHours(h, m, 0, 0)
    return isBefore(dt, new Date()) || takenSlots.some(s => {
      const taken = new Date(s); taken.setSeconds(0, 0)
      return Math.abs(taken.getTime() - dt.getTime()) < 30 * 60000
    })
  }

  async function submit() {
    if (!patientId || !selectedPro || !selectedDate || !selectedTime) return
    setSubmitting(true)
    const [h, m] = selectedTime.split(':').map(Number)
    const startsAt = new Date(selectedDate); startsAt.setHours(h, m, 0, 0)
    await db.from('appointments').insert({
      patient_id: patientId,
      professional_id: selectedPro.id,
      starts_at: startsAt.toISOString(),
      status: 'requested',
      type: apptType,
      reason: reason || null,
    })
    // Notifier le praticien (best-effort)
    try {
      const { data: pro } = await db.from('professionals').select('profile_id').eq('id', selectedPro.id).maybeSingle()
      if (pro?.profile_id) {
        await db.from('notifications').insert({
          user_id: pro.profile_id,
          event_type: 'nouveau_rdv_demande',
          title: 'Nouveau rendez-vous demandé',
          message: `Un patient a demandé un RDV le ${format(startsAt, "d MMM 'à' HH:mm", { locale: fr })}.`,
          badge_category: 'appointment',
          priority: 'high',
          data: { starts_at: startsAt.toISOString(), type: apptType },
        })
      }
    } catch { /* silent */ }
    setSubmitted(true)
    setSubmitting(false)
    setTimeout(() => { onClose(); onSuccess() }, 1800)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)]" onClick={onClose} />
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface shadow-2"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-s-5 py-s-4">
          <div>
            <h2 className="font-display font-semibold text-ink">Prendre un rendez-vous</h2>
            <div className="mt-s-2 flex items-center gap-s-1">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={cn('h-1.5 w-8 rounded-pill transition-colors', n <= step ? 'bg-primary' : 'bg-line')} />
              ))}
              <span className="ml-s-2 text-micro text-ink-3">Étape {step}/4</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-2 transition-colors">
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        <div className="px-s-5 py-s-5">
          {/* Étape 1 — Praticien */}
          {step === 1 && (
            <div className="flex flex-col gap-s-4">
              <h3 className="font-semibold text-ink">Choisir un praticien</h3>
              <div className="relative">
                <Search className="absolute left-s-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Spécialité ou nom (ex: cardiologue, Sow…)"
                  className="w-full rounded-md border border-line bg-surface pl-10 pr-s-4 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
                />
              </div>
              {searchLoading && <p className="text-small text-ink-3">Recherche…</p>}
              {pros.length > 0 && (
                <div className="flex flex-col gap-s-2">
                  {pros.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPro(p); setStep(2) }}
                      className="flex items-center gap-s-3 rounded-md border border-line p-s-3 text-left hover:bg-surface-2 hover:border-primary transition-colors"
                    >
                      <Avatar src={p.avatar} fallback={p.name} size="sm" />
                      <div>
                        <p className="font-medium text-ink text-small">{p.name}</p>
                        <p className="text-micro text-ink-2">{p.specialty}{p.org_name ? ` · ${p.org_name}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && !searchLoading && pros.length === 0 && (
                <p className="text-small text-ink-3 text-center py-s-4">Aucun praticien trouvé pour "{searchQuery}"</p>
              )}
            </div>
          )}

          {/* Étape 2 — Créneaux */}
          {step === 2 && selectedPro && (
            <div className="flex flex-col gap-s-4">
              <div className="flex items-center gap-s-3">
                <button onClick={() => setStep(1)} className="text-primary text-small hover:underline">← Retour</button>
                <div className="flex-1 text-small text-ink-2">
                  {selectedPro.name} — {selectedPro.specialty}
                </div>
              </div>
              <h3 className="font-semibold text-ink">Choisir un créneau</h3>
              {/* Semaine nav */}
              <div className="flex items-center justify-between">
                <button onClick={() => setSlotWeek(subWeeks(slotWeek, 1))} className="rounded p-1 hover:bg-surface-2 transition-colors">
                  <ChevronLeft className="h-4 w-4 text-ink-2" />
                </button>
                <span className="text-small font-medium text-ink">
                  {format(weekDays[0], 'd MMM', { locale: fr })} – {format(weekDays[6], 'd MMM yyyy', { locale: fr })}
                </span>
                <button onClick={() => setSlotWeek(addWeeks(slotWeek, 1))} className="rounded p-1 hover:bg-surface-2 transition-colors">
                  <ChevronRight className="h-4 w-4 text-ink-2" />
                </button>
              </div>
              {/* Jours */}
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-s-1 min-w-[480px]">
                  {weekDays.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(isBefore(day, new Date()) ? null : day)}
                      disabled={isBefore(day, addDays(new Date(), -1))}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-md py-s-2 text-center text-micro font-medium transition-colors',
                        selectedDate && isSameDay(day, selectedDate) ? 'bg-primary text-primary-fg' :
                        isToday(day) ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2 text-ink disabled:opacity-40',
                      )}
                    >
                      <span className="uppercase">{format(day, 'EEE', { locale: fr }).slice(0, 3)}</span>
                      <span className="font-semibold">{format(day, 'd')}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Horaires */}
              {selectedDate && (
                <div>
                  <p className="mb-s-2 text-small font-medium text-ink capitalize">
                    {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
                  </p>
                  <div className="grid grid-cols-4 gap-s-1">
                    {TIMES.map(t => {
                      const taken = isSlotTaken(selectedDate, t)
                      const active = selectedTime === t
                      return (
                        <button
                          key={t}
                          disabled={taken}
                          onClick={() => setSelectedTime(t)}
                          className={cn(
                            'rounded-md py-s-1 text-small font-medium transition-colors',
                            taken ? 'bg-surface-2 text-ink-3 cursor-not-allowed' :
                            active ? 'bg-primary text-primary-fg' :
                            'border border-line hover:border-primary hover:text-primary text-ink',
                          )}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <Button
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
                fullWidth
              >
                Continuer
              </Button>
            </div>
          )}

          {/* Étape 3 — Type + motif */}
          {step === 3 && (
            <div className="flex flex-col gap-s-4">
              <div className="flex items-center gap-s-3">
                <button onClick={() => setStep(2)} className="text-primary text-small hover:underline">← Retour</button>
              </div>
              <h3 className="font-semibold text-ink">Type de consultation</h3>
              <div className="grid grid-cols-2 gap-s-3">
                {(['in_person', 'teleconsultation'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setApptType(t)}
                    className={cn(
                      'flex flex-col items-center gap-s-2 rounded-md border p-s-4 transition-colors',
                      apptType === t ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
                    )}
                  >
                    {t === 'in_person' ? <MapPin className="h-5 w-5 text-primary" /> : <Video className="h-5 w-5 text-primary" />}
                    <span className="text-small font-medium text-ink">
                      {t === 'in_person' ? 'Présentiel' : 'Téléconsultation'}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Motif (optionnel)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="Décrivez brièvement le motif de votre consultation…"
                  className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 resize-none focus:outline-none focus:shadow-focus"
                />
                <p className="mt-s-1 text-micro text-ink-3 text-right">{reason.length}/300</p>
              </div>
              <Button onClick={() => setStep(4)} fullWidth>Continuer</Button>
            </div>
          )}

          {/* Étape 4 — Récap */}
          {step === 4 && selectedPro && selectedDate && selectedTime && (
            <div className="flex flex-col gap-s-4">
              <div className="flex items-center gap-s-3">
                <button onClick={() => setStep(3)} className="text-primary text-small hover:underline">← Retour</button>
              </div>
              {submitted ? (
                <div className="flex flex-col items-center gap-s-4 py-s-8 text-center">
                  <CheckCircle className="h-12 w-12 text-status-success" />
                  <div>
                    <p className="font-semibold text-ink">Demande envoyée !</p>
                    <p className="text-small text-ink-2 mt-s-1">En attente de confirmation du praticien.</p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-ink">Récapitulatif</h3>
                  <div className="rounded-md border border-line divide-y divide-line">
                    <div className="flex items-center gap-s-3 p-s-3">
                      <Avatar src={selectedPro.avatar} fallback={selectedPro.name} size="sm" />
                      <div>
                        <p className="text-small font-medium text-ink">{selectedPro.name}</p>
                        <p className="text-micro text-ink-2">{selectedPro.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-s-3">
                      <span className="text-small text-ink-2">Date</span>
                      <span className="text-small font-medium text-ink capitalize">
                        {format(selectedDate, "EEE d MMM yyyy", { locale: fr })} à {selectedTime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-s-3">
                      <span className="text-small text-ink-2">Type</span>
                      <span className="text-small font-medium text-ink">
                        {apptType === 'in_person' ? 'Présentiel' : 'Téléconsultation'}
                      </span>
                    </div>
                    {reason && (
                      <div className="p-s-3">
                        <span className="text-small text-ink-2">Motif</span>
                        <p className="text-small text-ink mt-0.5">{reason}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-micro text-ink-3">
                    Le praticien devra confirmer votre demande. Vous recevrez une notification dès confirmation.
                  </p>
                  <Button onClick={submit} loading={submitting} fullWidth>
                    Envoyer la demande
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── AppointmentsPage ───────────────────────────────────────────────────────
const PAGE_SIZE = 10

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const db = supabase as any

  const [patientId, setPatientId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('patient-rdv-view') as ViewMode) || 'list' } catch { return 'list' }
  })
  const [tab, setTab]               = useState<ListTab>('upcoming')
  const [appointments, setAppointments] = useState<ApptSummary[]>([])
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(0)
  const [hasMore, setHasMore]       = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calAppts, setCalAppts]     = useState<ApptSummary[]>([])
  const [selectedAppt, setSelectedAppt] = useState<ApptSummary | null>(null)
  const [cancelAppt, setCancelAppt] = useState<ApptSummary | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [bookOpen, setBookOpen]     = useState(false)
  const [nextIn24h, setNextIn24h]   = useState<ApptSummary | null>(null)

  // Fetch patient id
  useEffect(() => {
    if (!session?.user) return
    supabase.from('patients').select('id').eq('profile_id', session.user.id).single()
      .then(({ data }) => { if (data) setPatientId(data.id) })
  }, [session])

  // Open book drawer if ?action=nouveau
  useEffect(() => {
    if (searchParams.get('action') === 'nouveau') setBookOpen(true)
  }, [searchParams])

  // Persist view mode
  function switchView(v: ViewMode) {
    setView(v)
    try { localStorage.setItem('patient-rdv-view', v) } catch { /* */ }
  }

  const mapAppt = (a: any): ApptSummary => ({
    id: a.id,
    starts_at: a.starts_at,
    duration_minutes: a.duration_minutes ?? 0,
    status: a.status,
    type: a.type ?? null,
    reason: a.reason ?? null,
    pro_name: `${a.professional?.profile?.first_name ?? ''} ${a.professional?.profile?.last_name ?? ''}`.trim() || 'Praticien',
    pro_specialty: a.professional?.specialty ?? '',
    pro_avatar: a.professional?.profile?.avatar_url ?? null,
    pro_profile_id: a.professional?.profile_id ?? null,
    professional_id: a.professional_id ?? '',
    org_name: a.professional?.organization?.name ?? '',
    org_city: a.professional?.organization?.city ?? '',
    address: a.address ?? a.professional?.organization?.address ?? null,
    video_link: a.video_link ?? null,
    consultation_report_id: a.consultation_report_id ?? null,
  })

  const SELECT = `id, starts_at, duration_minutes, status, type, reason, video_link, address, consultation_report_id, professional_id,
    professional:professionals(profile_id, specialty, profile:profiles(first_name, last_name, avatar_url), organization:organizations(name, city, address))`

  // Fetch list appointments
  const fetchList = useCallback(async (reset = false) => {
    if (!patientId) return
    setLoading(true)
    const currentPage = reset ? 0 : page
    if (reset) setPage(0)

    let q = db.from('appointments').select(SELECT)
      .eq('patient_id', patientId)
      .order('starts_at', { ascending: tab === 'upcoming' })
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

    if (tab === 'cancelled') q = q.like('status', 'cancelled_%')
    else q = q.in('status', tab === 'upcoming' ? UPCOMING_STATUSES : PAST_STATUSES)

    const { data } = await q
    const mapped = (data ?? []).map(mapAppt)
    setAppointments(reset ? mapped : prev => [...prev, ...mapped])
    setHasMore(mapped.length === PAGE_SIZE + 1)
    setLoading(false)
  }, [patientId, tab, page])

  useEffect(() => { fetchList(true) }, [patientId, tab])

  // Fetch calendar appointments (full month)
  useEffect(() => {
    if (!patientId || view !== 'calendar') return
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    db.from('appointments').select(SELECT)
      .eq('patient_id', patientId)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .then(({ data }: any) => setCalAppts((data ?? []).map(mapAppt)))
  }, [patientId, view, currentMonth])

  // 24h banner
  useEffect(() => {
    if (!patientId) return
    const in24h = addMinutes(new Date(), 24 * 60)
    db.from('appointments').select(SELECT)
      .eq('patient_id', patientId)
      .in('status', ['confirmed', 'paid'])
      .gt('starts_at', new Date().toISOString())
      .lt('starts_at', in24h.toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setNextIn24h(data ? mapAppt(data) : null))
  }, [patientId])

  async function handleCancel() {
    if (!cancelAppt) return
    setCancelLoading(true)
    try {
      await supabase.functions.invoke('cancel-appointment', { body: { appointmentId: cancelAppt.id } })
    } catch {
      await db.from('appointments').update({ status: 'cancelled_patient' }).eq('id', cancelAppt.id)
      if (cancelAppt.pro_profile_id) {
        await db.from('notifications').insert({
          user_id: cancelAppt.pro_profile_id,
          event_type: 'rdv_annule_par_patient',
          title: 'Rendez-vous annulé',
          message: `Le patient a annulé le RDV du ${format(new Date(cancelAppt.starts_at), "d MMM 'à' HH:mm", { locale: fr })}.`,
          badge_category: 'appointment',
          priority: 'high',
          data: { appointment_id: cancelAppt.id },
        })
      }
    }
    setCancelAppt(null)
    setSelectedAppt(null)
    setCancelLoading(false)
    fetchList(true)
  }

  const TABS: { key: ListTab; label: string }[] = [
    { key: 'upcoming', label: 'À venir' },
    { key: 'past', label: 'Passés' },
    { key: 'cancelled', label: 'Annulés' },
  ]

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">

      {/* ── Banner 24h ─────────────────────────────────────────────────── */}
      {nextIn24h && (
        <button className="w-full text-left" onClick={() => setSelectedAppt(nextIn24h)}>
          <Banner kind="info" className="rounded-md">
            <Calendar className="h-4 w-4 shrink-0" />
            Rappel : RDV demain à {format(new Date(nextIn24h.starts_at), 'HH:mm')} avec {nextIn24h.pro_name}
          </Banner>
        </button>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-s-3 flex-wrap">
        <h1 className="font-display text-h1 font-semibold text-ink">Mes rendez-vous</h1>
        <div className="flex items-center gap-s-2">
          {/* Toggle vue */}
          <div className="flex rounded-md border border-line overflow-hidden">
            <button
              onClick={() => switchView('calendar')}
              className={cn('flex items-center gap-s-1 px-s-3 py-s-1.5 text-small font-medium transition-colors', view === 'calendar' ? 'bg-primary text-primary-fg' : 'text-ink-2 hover:bg-surface-2')}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendrier</span>
            </button>
            <button
              onClick={() => switchView('list')}
              className={cn('flex items-center gap-s-1 px-s-3 py-s-1.5 text-small font-medium transition-colors', view === 'list' ? 'bg-primary text-primary-fg' : 'text-ink-2 hover:bg-surface-2')}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setBookOpen(true)}>
            <span className="hidden sm:inline">Nouveau rendez-vous</span>
            <span className="sm:hidden">Nouveau</span>
          </Button>
        </div>
      </div>

      {/* ── Vue calendrier ─────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <MonthCalendar
          appointments={calAppts}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          onSelect={setSelectedAppt}
        />
      )}

      {/* ── Vue liste ──────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          <div className="flex gap-s-1 border-b border-line">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'pb-s-2 px-s-3 text-small font-medium transition-colors',
                  tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-ink-2 hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && appointments.length === 0 ? (
            <div className="flex flex-col gap-s-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-md" />)}
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-10 w-10" />}
              title={tab === 'upcoming' ? 'Aucun rendez-vous à venir' : tab === 'past' ? 'Aucun rendez-vous passé' : 'Aucun rendez-vous annulé'}
              description={tab === 'upcoming' ? 'Réservez votre prochain rendez-vous.' : 'Votre historique apparaîtra ici.'}
              action={tab === 'upcoming' ? <Button size="sm" onClick={() => setBookOpen(true)}>Prendre un RDV</Button> : undefined}
            />
          ) : (
            <div className="flex flex-col gap-s-2">
              {appointments.map(a => (
                <ApptCard key={a.id} appt={a} onClick={() => setSelectedAppt(a)} />
              ))}
              {hasMore && (
                <Button variant="secondary" size="sm" loading={loading} onClick={() => { setPage(p => p + 1); fetchList() }}>
                  Voir plus
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedAppt && !cancelAppt && (
          <ApptDetailModal
            appt={selectedAppt}
            onClose={() => setSelectedAppt(null)}
            onCancel={() => setCancelAppt(selectedAppt)}
            onNavigate={path => { window.location.href = path }}
          />
        )}
        {cancelAppt && (
          <CancelModal
            appt={cancelAppt}
            loading={cancelLoading}
            onClose={() => setCancelAppt(null)}
            onConfirm={handleCancel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookOpen && (
          <BookDrawer
            open={bookOpen}
            onClose={() => setBookOpen(false)}
            patientId={patientId}
            onSuccess={() => { fetchList(true) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
