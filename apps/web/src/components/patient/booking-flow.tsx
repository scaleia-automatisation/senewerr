'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendNotificationAction } from '@/app/actions/notifications'
import { ChevronLeft, ChevronRight, Check, Loader2, Calendar, Clock, User, MapPin, CheckCircle2 } from 'lucide-react'

type Professional = {
  id: string; name: string; specialty: string | null; consultation_fee_fcfa: number | null
  establishments: { id: string; name: string; address_commune: string | null }[]
  profile_id?: string
}
type Slot = { id: string; schedule_id: string; start_time: string; end_time: string }
type Beneficiary = { id: string; first_name: string | null; last_name: string | null; relationship: string | null }

const STEPS = ['Date', 'Créneau', 'Motif', 'Patient', 'Vérification']
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAY_NAMES = ['Lu','Ma','Me','Je','Ve','Sa','Di']

// Convertit un Date JS (0=Dim, 1=Lun…) vers convention ISO (0=Lun…6=Dim)
function toIsoWeekday(d: Date) { return (d.getDay() + 6) % 7 }

function buildCalendarDays(year: number, month: number) {
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  return days
}

function fmtTime(t: string) {
  return t.length >= 5 ? t.substring(0, 5) : t
}
function fmtDateLong(d: Date) {
  return d.toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long' })
}
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}
function durationMin(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

type ScheduleRow = { id: string }

export function BookingFlow({ professional, patientId, patientProfileId }: {
  professional: Professional
  patientId: string
  patientProfileId?: string
}) {
  const router = useRouter()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEstId, setSelectedEstId] = useState<string | null>(professional.establishments[0]?.id ?? null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [reason, setReason] = useState('')
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [selectedBenef, setSelectedBenef] = useState<string>('me')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedApptId, setConfirmedApptId] = useState<string | null>(null)

  useEffect(() => {
    loadBeneficiaries()
    loadSchedule()
  }, [])

  async function loadSchedule() {
    const supabase = createClient()
    const { data } = await supabase
      .from('plannings')
      .select('id')
      .eq('professional_id', professional.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle() as { data: ScheduleRow | null }
    if (data) setScheduleId(data.id)
  }

  async function loadBeneficiaries() {
    const supabase = createClient()
    const { data } = await supabase
      .from('beneficiaires')
      .select('id, first_name, last_name, relationship')
      .eq('patient_id', patientId)
    setBeneficiaries((data ?? []) as unknown as Beneficiary[])
  }

  async function handleDateSelect(d: number) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d)
    if (date < today) return
    setSelectedDate(date); setSelectedSlot(null); setSlots([])
    setLoadingSlots(true)

    if (!scheduleId) {
      setSlots([])
      setLoadingSlots(false)
      setStep(1)
      return
    }

    const supabase = createClient()
    const dayOfWeek = toIsoWeekday(date)
    const dateStr = toDateStr(date)

    const [slotsRes, bookedRes] = await Promise.all([
      supabase
        .from('creneaux_planning')
        .select('id, start_time, end_time')
        .eq('schedule_id', scheduleId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time'),
      supabase
        .from('rendez_vous')
        .select('start_time')
        .eq('professional_id', professional.id)
        .eq('appointment_date', dateStr)
        .not('status', 'in', '("cancelled","no_show")'),
    ])

    const bookedTimes = new Set((bookedRes.data ?? []).map((a: { start_time: string }) => a.start_time))
    const available = ((slotsRes.data ?? []) as { id: string; start_time: string; end_time: string }[])
      .filter(s => !bookedTimes.has(s.start_time))
      .map(s => ({ id: s.id, schedule_id: scheduleId, start_time: s.start_time, end_time: s.end_time }))

    setSlots(available)
    setLoadingSlots(false)
    setStep(1)
  }

  async function handleConfirm() {
    if (!selectedSlot || !selectedDate || !scheduleId) return
    setConfirming(true); setError('')
    const supabase = createClient()

    type InsertFn = {
      insert: (v: unknown) => {
        select: (q: string) => {
          single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>
        }
      }
    }

    const { data: appt, error: apptErr } = await (supabase.from('rendez_vous') as unknown as InsertFn)
      .insert({
        patient_id: patientId,
        professional_id: professional.id,
        establishment_id: selectedEstId,
        schedule_id: scheduleId,
        status: 'pending',
        appointment_date: toDateStr(selectedDate),
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        duration_min: durationMin(selectedSlot.start_time, selectedSlot.end_time),
        reason: reason || null,
        beneficiary_id: selectedBenef !== 'me' ? selectedBenef : null,
      })
      .select('id')
      .single()

    if (apptErr) { setError(apptErr.message); setConfirming(false); return }

    // Notifier le professionnel si son profile_id est disponible
    if (professional.profile_id) {
      sendNotificationAction({
        recipient_id: professional.profile_id,
        type: 'appointment_confirmed',
        body: `Nouveau rendez-vous le ${fmtDateLong(selectedDate)} à ${fmtTime(selectedSlot.start_time)}`,
        reference_type: 'appointment',
        reference_id: appt!.id,
      }).catch(() => {})
    }

    setConfirmedApptId(appt!.id)
    setConfirmed(true)
    setConfirming(false)
  }

  if (confirmed) {
    return (
      <div className="space-y-5">
        <div className="sw-card p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--sw-ink)]">Rendez-vous confirmé !</p>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">
              {selectedDate && fmtDateLong(selectedDate)} à {selectedSlot && fmtTime(selectedSlot.start_time)}
            </p>
            <p className="text-sm text-[var(--sw-ink-2)]">avec {professional.name}</p>
          </div>
          <p className="text-xs text-[var(--sw-ink-3)]">Vous recevrez une confirmation du professionnel.</p>
          <button onClick={() => router.push('/patient/rendez-vous')} className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            Voir mes rendez-vous
          </button>
        </div>
      </div>
    )
  }

  const calDays = buildCalendarDays(calMonth.getFullYear(), calMonth.getMonth())
  const isPrevDisabled = calMonth <= new Date(today.getFullYear(), today.getMonth(), 1)
  const selectedBenefObj = beneficiaries.find(b => b.id === selectedBenef)

  return (
    <div className="space-y-5">
      {/* Professionnel */}
      <div className="sw-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--sw-ink)]">{professional.name}</p>
          {professional.specialty && <p className="text-xs text-[var(--sw-primary)]">{professional.specialty}</p>}
        </div>
      </div>

      {/* Étapes */}
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
              ${i < step ? 'bg-[var(--sw-success)] text-white' : i === step ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
              {i < step ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === step ? 'text-[var(--sw-ink)] font-medium' : 'text-[var(--sw-ink-3)]'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-4 sm:w-8 h-px bg-[var(--sw-line)] mx-1" />}
          </div>
        ))}
      </div>

      {/* Étape 0 : Calendrier */}
      {step === 0 && (
        <div className="sw-card p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--sw-ink)]">Choisir une date</p>

          {professional.establishments.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-[var(--sw-ink-2)] font-medium">Établissement</p>
              <div className="space-y-1">
                {professional.establishments.map(e => (
                  <button key={e.id} onClick={() => setSelectedEstId(e.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${selectedEstId === e.id ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' : 'border-[var(--sw-line)] text-[var(--sw-ink)]'}`}>
                    <p className="font-medium">{e.name}</p>
                    {e.address_commune && <p className="text-xs opacity-70">{e.address_commune}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button onClick={() => !isPrevDisabled && setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                className={`w-8 h-8 flex items-center justify-center rounded-lg ${isPrevDisabled ? 'text-[var(--sw-ink-3)] opacity-30' : 'hover:bg-[var(--sw-surface-2)] text-[var(--sw-ink)]'}`}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-medium text-[var(--sw-ink)]">
                {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
              </p>
              <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--sw-surface-2)] text-[var(--sw-ink)]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map(d => <div key={d} className="text-center text-xs text-[var(--sw-ink-3)] font-medium py-1">{d}</div>)}
              {calDays.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d)
                const isPast = date < today
                const isToday = date.getTime() === today.getTime()
                const isSelected = selectedDate?.getTime() === date.getTime()
                return (
                  <button key={d} onClick={() => handleDateSelect(d)} disabled={isPast}
                    className={`aspect-square w-full flex items-center justify-center text-xs rounded-lg font-medium transition-colors
                      ${isSelected ? 'bg-[var(--sw-primary)] text-white' :
                        isToday ? 'border border-[var(--sw-primary)] text-[var(--sw-primary)]' :
                        isPast ? 'text-[var(--sw-ink-3)] opacity-30 cursor-not-allowed' :
                        'hover:bg-[var(--sw-primary-subtle)] text-[var(--sw-ink)]'}`}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Étape 1 : Créneaux */}
      {step === 1 && (
        <div className="sw-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(0)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">
              {selectedDate ? fmtDateLong(selectedDate) : 'Choisir un créneau'}
            </p>
          </div>
          {loadingSlots ? (
            <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--sw-ink-3)] mx-auto" /></div>
          ) : slots.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun créneau disponible ce jour.</p>
              <button onClick={() => setStep(0)} className="text-xs text-[var(--sw-primary)] mt-1">Choisir une autre date</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map(slot => (
                <button key={slot.id} onClick={() => { setSelectedSlot(slot); setStep(2) }}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors
                    ${selectedSlot?.id === slot.id ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' : 'border-[var(--sw-line)] text-[var(--sw-ink)] hover:border-[var(--sw-primary)]'}`}>
                  <Clock className="w-3 h-3 mx-auto mb-0.5" />
                  {fmtTime(slot.start_time)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Étape 2 : Motif */}
      {step === 2 && (
        <div className="sw-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(1)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Motif de consultation</p>
          </div>
          <textarea rows={4} className="sw-input w-full resize-none" placeholder="Ex : Consultation de routine, suivi traitement, douleurs…" value={reason} onChange={e => setReason(e.target.value)} />
          <button onClick={() => setStep(3)} className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            Continuer
          </button>
        </div>
      )}

      {/* Étape 3 : Patient / Bénéficiaire */}
      {step === 3 && (
        <div className="sw-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(2)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Pour qui est ce rendez-vous ?</p>
          </div>
          <div className="space-y-2">
            <button onClick={() => setSelectedBenef('me')}
              className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                ${selectedBenef === 'me' ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' : 'border-[var(--sw-line)] text-[var(--sw-ink)]'}`}>
              <p className="font-medium">Moi-même</p>
            </button>
            {beneficiaries.map(b => (
              <button key={b.id} onClick={() => setSelectedBenef(b.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                  ${selectedBenef === b.id ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' : 'border-[var(--sw-line)] text-[var(--sw-ink)]'}`}>
                <p className="font-medium">{b.first_name} {b.last_name}</p>
                {b.relationship && <p className="text-xs opacity-70">{b.relationship}</p>}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(4)} className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            Continuer
          </button>
        </div>
      )}

      {/* Étape 4 : Vérification */}
      {step === 4 && (
        <div className="sw-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(3)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">Vérification</p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 py-2 border-b border-[var(--sw-line)]">
              <User className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
              <div><p className="text-xs text-[var(--sw-ink-3)]">Professionnel</p><p className="text-[var(--sw-ink)] font-medium">{professional.name}</p></div>
            </div>
            {selectedDate && selectedSlot && (
              <div className="flex items-start gap-3 py-2 border-b border-[var(--sw-line)]">
                <Calendar className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
                <div><p className="text-xs text-[var(--sw-ink-3)]">Date et heure</p><p className="text-[var(--sw-ink)] font-medium">{fmtDateLong(selectedDate)} à {fmtTime(selectedSlot.start_time)}</p></div>
              </div>
            )}
            {professional.establishments.find(e => e.id === selectedEstId) && (
              <div className="flex items-start gap-3 py-2 border-b border-[var(--sw-line)]">
                <MapPin className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
                <div><p className="text-xs text-[var(--sw-ink-3)]">Lieu</p><p className="text-[var(--sw-ink)] font-medium">{professional.establishments.find(e => e.id === selectedEstId)?.name}</p></div>
              </div>
            )}
            {reason && (
              <div className="flex items-start gap-3 py-2 border-b border-[var(--sw-line)]">
                <Clock className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
                <div><p className="text-xs text-[var(--sw-ink-3)]">Motif</p><p className="text-[var(--sw-ink)]">{reason}</p></div>
              </div>
            )}
            {professional.consultation_fee_fcfa && (
              <div className="flex items-start gap-3 py-2 border-b border-[var(--sw-line)]">
                <Clock className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
                <div><p className="text-xs text-[var(--sw-ink-3)]">Tarif indicatif</p><p className="text-[var(--sw-ink)] font-medium">{new Intl.NumberFormat('fr-SN').format(professional.consultation_fee_fcfa)} F CFA</p></div>
              </div>
            )}
            <div className="flex items-start gap-3 py-2">
              <User className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
              <div><p className="text-xs text-[var(--sw-ink-3)]">Patient</p><p className="text-[var(--sw-ink)] font-medium">{selectedBenef === 'me' ? 'Moi-même' : `${selectedBenefObj?.first_name} ${selectedBenefObj?.last_name}`}</p></div>
            </div>
          </div>

          {error && <p className="text-xs text-[var(--sw-danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={handleConfirm} disabled={confirming}
            className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmer le rendez-vous
          </button>
        </div>
      )}
    </div>
  )
}
