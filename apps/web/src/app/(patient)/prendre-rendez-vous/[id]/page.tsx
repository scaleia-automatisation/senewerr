'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Calendar, Clock, User, Video, MapPin, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Professional {
  id: string
  professional_type: string
  specialty: string | null
  title: string | null
  consultation_fee_fcfa: number | null
  teleconsultation_fee_fcfa: number | null
  teleconsultation_enabled: boolean
  address_region: string | null
  address_commune: string | null
  profiles: { first_name: string; last_name: string } | null
}

interface Beneficiary {
  id: string
  first_name: string
  last_name: string
  relationship: string
}

const SLOT_TIMES = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc']

function getDates(startOffset = 0, count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + startOffset + i)
    return d
  })
}

function formatDateISO(d: Date) {
  return d.toISOString().split('T')[0]
}

function PrendreRendezVousInner({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEtablissement = searchParams.get('type') === 'etablissement'

  const [professionalId, setProfessionalId] = useState('')
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: date
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dateOffset, setDateOffset] = useState(0)

  // Step 2: time slot
  const [selectedTime, setSelectedTime] = useState('')
  const [bookedSlots, setBookedSlots] = useState<string[]>([])

  // Step 3: details
  const [appointmentType, setAppointmentType] = useState<'in_person' | 'teleconsultation'>('in_person')
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState('')
  const [reason, setReason] = useState('')

  // Submitting
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(({ id }) => setProfessionalId(id))
  }, [params])

  useEffect(() => {
    if (!professionalId) return
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data: proData } = await supabase
        .from('professionnels')
        .select(`
          id, professional_type, specialty, title,
          consultation_fee_fcfa, teleconsultation_fee_fcfa,
          teleconsultation_enabled, address_region, address_commune,
          profiles!inner(first_name, last_name)
        `)
        .eq('id', professionalId)
        .maybeSingle()
      setProfessional(proData as unknown as Professional | null)

      if (user) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle()
        const patient = patientData as unknown as { id: string } | null
        if (patient) {
          const { data: bData } = await supabase
            .from('beneficiaires')
            .select('id, first_name, last_name, relationship')
            .eq('patient_id', patient.id)
          setBeneficiaries((bData ?? []) as unknown as Beneficiary[])
        }
      }
      setLoading(false)
    }
    load()
  }, [professionalId])

  useEffect(() => {
    if (!selectedDate || !professionalId) return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('rendez_vous')
        .select('start_time')
        .eq('professional_id', professionalId)
        .eq('appointment_date', formatDateISO(selectedDate))
        .in('status', ['pending', 'confirmed'])
      const times = ((data ?? []) as unknown as { start_time: string }[]).map(a => a.start_time.slice(0, 5))
      setBookedSlots(times)
    }
    load()
  }, [selectedDate, professionalId])

  async function handleConfirm() {
    if (!selectedDate || !selectedTime) return
    setError('')
    setSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expirée.'); setSubmitting(false); return }

    const { data: patientData } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    const patient = patientData as unknown as { id: string } | null
    if (!patient) { setError('Profil patient introuvable.'); setSubmitting(false); return }

    const startHour = parseInt(selectedTime.split(':')[0])
    const startMin  = parseInt(selectedTime.split(':')[1])
    const endMin    = startMin + 30
    const endTime   = `${endHour(startHour, endMin)}:${String(endMin % 60).padStart(2, '0')}`

    const { data: appointment, error: err } = await (supabase.from('rendez_vous') as unknown as {
      insert: (v: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    }).insert({
      professional_id: professionalId,
      patient_id: patient.id,
      beneficiary_id: selectedBeneficiaryId || null,
      appointment_type: appointmentType,
      status: 'pending',
      appointment_date: formatDateISO(selectedDate),
      start_time: selectedTime,
      end_time: endTime,
      duration_min: 30,
      reason: reason.trim() || null,
    }).select('id').single()

    if (err || !appointment) { setError(err?.message ?? 'Erreur lors de la réservation.'); setSubmitting(false); return }
    router.push(`/rendez-vous/${appointment.id}/confirmation`)
  }

  function endHour(h: number, m: number) { return String(m >= 60 ? h + 1 : h).padStart(2, '0') }

  const proName = professional?.profiles
    ? `${professional.title ? professional.title + ' ' : ''}${professional.profiles.first_name} ${professional.profiles.last_name}`.trim()
    : 'Professionnel'

  const dates = getDates(0, 14).slice(dateOffset)

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--sw-primary)]" />
      </div>
    )
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center p-4">
        <div className="sw-card p-8 max-w-sm w-full text-center space-y-3">
          <p className="font-medium text-[var(--sw-ink)]">Professionnel introuvable.</p>
          <Link href="/patient/trouver"><Button variant="outline" className="w-full">Retour à la recherche</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Header */}
        <Link href="/patient/trouver" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
          <ArrowLeft className="w-4 h-4" />
          Retour à la recherche
        </Link>

        {/* Professionnel card */}
        <div className="sw-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-[var(--sw-primary)]">
              {proName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-[var(--sw-ink)]">{proName}</p>
            <p className="text-xs text-[var(--sw-ink-2)]">
              {professional.specialty ?? professional.professional_type?.replace(/_/g, ' ')}
              {(professional.address_commune ?? professional.address_region)
                ? ` · ${professional.address_commune ?? professional.address_region}` : ''}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {([1, 2, 3, 4] as const).map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${step >= s ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-line)]'}`} />
          ))}
        </div>

        {/* Step 1: Choisir une date */}
        {step === 1 && (
          <div className="sw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Choisir une date</h2>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                disabled={dateOffset === 0}
                className="p-1.5 rounded-lg hover:bg-[var(--sw-surface-2)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--sw-ink-2)]" />
              </button>
              <span className="text-xs text-[var(--sw-ink-2)]">14 prochains jours</span>
              <button
                type="button"
                onClick={() => setDateOffset(Math.min(7, dateOffset + 7))}
                className="p-1.5 rounded-lg hover:bg-[var(--sw-surface-2)] transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-[var(--sw-ink-2)]" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {dates.slice(0, 7).map(date => {
                const iso = formatDateISO(date)
                const isSelected = selectedDate && formatDateISO(selectedDate) === iso
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => { setSelectedDate(date); setSelectedTime('') }}
                    disabled={isWeekend}
                    className={`flex flex-col items-center p-2 rounded-xl text-xs transition-colors disabled:opacity-30 ${
                      isSelected
                        ? 'bg-[var(--sw-primary)] text-white'
                        : 'hover:bg-[var(--sw-primary-subtle)] text-[var(--sw-ink-2)]'
                    }`}
                  >
                    <span className="font-medium">{DAYS_FR[date.getDay()]}</span>
                    <span className={`text-base font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-[var(--sw-ink)]'}`}>
                      {date.getDate()}
                    </span>
                    <span>{MONTHS_FR[date.getMonth()]}</span>
                  </button>
                )
              })}
            </div>

            <Button className="w-full" disabled={!selectedDate} onClick={() => setStep(2)}>
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Choisir un créneau */}
        {step === 2 && (
          <div className="sw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--sw-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--sw-ink)]">
                Choisir un créneau
                {selectedDate && (
                  <span className="text-[var(--sw-ink-2)] font-normal ml-1">
                    — {selectedDate.getDate()} {MONTHS_FR[selectedDate.getMonth()]}
                  </span>
                )}
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {SLOT_TIMES.map(time => {
                const isBooked = bookedSlots.includes(time)
                const isSelected = selectedTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => !isBooked && setSelectedTime(time)}
                    disabled={isBooked}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isBooked
                        ? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] line-through opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[var(--sw-primary)] text-white'
                          : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink)] hover:bg-[var(--sw-primary-subtle)] hover:text-[var(--sw-primary)]'
                    }`}
                  >
                    {time}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" />Retour
              </Button>
              <Button className="flex-1" disabled={!selectedTime} onClick={() => setStep(3)}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Détails */}
        {step === 3 && (
          <div className="sw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--sw-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Détails du rendez-vous</h2>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--sw-ink-2)]">Type de consultation</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'in_person', icon: MapPin, label: 'En présentiel' },
                  ...(professional.teleconsultation_enabled
                    ? [{ value: 'teleconsultation', icon: Video, label: 'Téléconsultation' }]
                    : []
                  ),
                ] as const).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAppointmentType(value as typeof appointmentType)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                      appointmentType === value
                        ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                        : 'border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bénéficiaire */}
            {beneficiaries.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--sw-ink-2)]">Pour qui ?</label>
                <select
                  value={selectedBeneficiaryId}
                  onChange={e => setSelectedBeneficiaryId(e.target.value)}
                  className="sw-input w-full"
                >
                  <option value="">Moi-même (patient principal)</option>
                  {beneficiaries.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.first_name} {b.last_name} ({b.relationship})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Motif */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--sw-ink-2)]">Motif (optionnel)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Décrivez brièvement la raison de votre visite…"
                rows={3}
                className="sw-input w-full resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" />Retour
              </Button>
              <Button className="flex-1" onClick={() => setStep(4)}>
                Récapitulatif
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && selectedDate && (
          <div className="sw-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
              <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Récapitulatif</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Professionnel</span>
                <span className="font-medium text-[var(--sw-ink)] text-right max-w-[60%]">{proName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Date</span>
                <span className="font-medium text-[var(--sw-ink)]">
                  {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Heure</span>
                <span className="font-medium text-[var(--sw-ink)]">{selectedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Type</span>
                <span className="font-medium text-[var(--sw-ink)]">
                  {appointmentType === 'teleconsultation' ? 'Téléconsultation' : 'En présentiel'}
                </span>
              </div>
              {professional.consultation_fee_fcfa != null && professional.consultation_fee_fcfa > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--sw-ink-2)]">Tarif</span>
                  <span className="font-semibold text-[var(--sw-primary)]">
                    {professional.consultation_fee_fcfa.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}
              {reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--sw-ink-2)] shrink-0">Motif</span>
                  <span className="text-[var(--sw-ink)] text-right">{reason}</span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={submitting}>
                <ChevronLeft className="w-4 h-4 mr-1" />Retour
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PrendreRendezVousPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <PrendreRendezVousInner params={params} />
    </Suspense>
  )
}
