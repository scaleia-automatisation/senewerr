import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'

const STEPS = ['Établissement', 'Date & Heure', 'Motif', 'Bénéficiaire', 'Confirmation']

interface Slot { id: string; start_at: string; end_at: string }
interface Estab { id: string; name: string; city: string; address?: string }
interface Beneficiary { id: string; full_name: string }

function groupByPeriod(slots: Slot[]) {
  const m: Slot[] = [], a: Slot[] = [], e: Slot[] = []
  for (const s of slots) {
    const h = new Date(s.start_at).getHours()
    if (h < 12) m.push(s)
    else if (h < 17) a.push(s)
    else e.push(s)
  }
  return { matin: m, 'après-midi': a, soir: e }
}

function weekStart(d: Date) {
  const r = new Date(d)
  r.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmt(d: Date) { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }
function fmtTime(s: string) { return new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }

export default function BookAppointmentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, patientId } = useAuth() as { user: any; patientId?: string }

  const proId = params.get('pro') ?? ''
  const etabParam = params.get('etab') ?? ''

  const [step, setStep] = useState(etabParam ? 1 : 0)
  const [estabId, setEstabId] = useState(etabParam)
  const [estabs, setEstabs] = useState<Estab[]>([])
  const [weekOf, setWeekOf] = useState(() => weekStart(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [reason, setReason] = useState('')
  const [apptType, setApptType] = useState<'in_person' | 'teleconsultation'>('in_person')
  const [teleconsultOk, setTeleconsultOk] = useState(false)
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])
  const [beneficiaryId, setBeneficiaryId] = useState<string>('self')
  const [submitting, setSubmitting] = useState(false)
  const [slotError, setSlotError] = useState(false)
  const [confirmResult, setConfirmResult] = useState<string | null>(null)

  useEffect(() => {
    if (!proId || estabParam) return
    supabase.from('establishments').select('id, organizations(name, city, address)')
      .eq('professional_id', proId).then(({ data }) => setEstabs((data ?? []) as unknown as Estab[]))
  }, [proId, etabParam])

  useEffect(() => {
    if (!proId) return
    supabase.from('professionals').select('teleconsultation_enabled').eq('id', proId).single()
      .then(({ data }) => setTeleconsultOk(!!data?.teleconsultation_enabled))
  }, [proId])

  useEffect(() => {
    if (!estabId || step !== 1) return
    const from = weekOf.toISOString(), to = addDays(weekOf, 7).toISOString()
    supabase.rpc('available_slots', { p_professional_id: proId, p_establishment_id: estabId, p_from_date: from, p_to_date: to })
      .then(({ data }) => setSlots((data ?? []) as Slot[]))
  }, [estabId, weekOf, step, proId])

  useEffect(() => {
    if (!patientId) return
    supabase.from('family_members').select('id, full_name').eq('patient_id', patientId)
      .then(({ data }) => setBeneficiaries((data ?? []) as Beneficiary[]))
  }, [patientId])

  async function confirm() {
    if (!selectedSlot || !patientId) return
    setSubmitting(true); setSlotError(false)
    const payload = {
      professional_id: proId, establishment_id: estabId, slot_id: selectedSlot.id,
      patient_id: patientId, reason, appointment_type: apptType,
      beneficiary_id: beneficiaryId === 'self' ? null : beneficiaryId,
    }
    const { data, error } = await supabase.from('appointments').insert(payload).select('id').single()
    setSubmitting(false)
    if (error?.message?.includes('SLOT_ALREADY_BOOKED')) { setSlotError(true); return }
    if (error) return
    setConfirmResult(data?.id ?? 'ok')
  }

  const weekEnd = addDays(weekOf, 6)
  const groupedSlots = groupByPeriod(slots)

  if (confirmResult) return (
    <div className="max-w-lg mx-auto p-s-5 flex flex-col items-center gap-s-4 text-center">
      <CheckCircle2 className="w-16 h-16 text-green-500" />
      <h1 className="text-ink text-xl font-semibold">Rendez-vous confirmé</h1>
      <p className="text-ink-2 text-sm">N° {confirmResult}</p>
      <Link to="/app/rendez-vous"><Button>Retour à mes RDV</Button></Link>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto p-s-4 flex flex-col gap-s-4">
      {/* Step indicator */}
      <div className="flex items-center justify-between gap-s-2">
        {STEPS.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${i === step ? 'border-primary bg-primary text-white' : i < step ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface-2 text-ink-3'}`}>{i + 1}</div>
            <span className="text-xs text-ink-3 hidden sm:block text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 0 — Établissement */}
      {step === 0 && (
        <div className="flex flex-col gap-s-3">
          <h2 className="text-ink font-medium">Choisissez un cabinet</h2>
          {estabs.map(e => (
            <Card key={e.id} className="p-s-4 flex items-center justify-between gap-s-3">
              <div>
                <p className="text-ink font-medium">{e.name}</p>
                <p className="text-ink-3 text-sm">{e.city}{e.address ? ` — ${e.address}` : ''}</p>
              </div>
              <Button size="sm" onClick={() => { setEstabId(e.id); setStep(1) }}>Choisir</Button>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1 — Date & Heure */}
      {step === 1 && (
        <div className="flex flex-col gap-s-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOf(w => addDays(w, -7))} className="p-1 rounded-md hover:bg-surface-2"><ChevronLeft className="w-5 h-5 text-ink-2" /></button>
            <span className="text-ink text-sm font-medium">Semaine du {fmt(weekOf)} au {fmt(weekEnd)}</span>
            <button onClick={() => setWeekOf(w => addDays(w, 7))} className="p-1 rounded-md hover:bg-surface-2"><ChevronRight className="w-5 h-5 text-ink-2" /></button>
          </div>
          {(['matin', 'après-midi', 'soir'] as const).map(period => {
            const ps = groupedSlots[period]
            if (!ps.length) return null
            return (
              <div key={period} className="flex flex-col gap-s-2">
                <p className="text-ink-3 text-xs font-medium uppercase tracking-wide">{period}</p>
                <div className="flex flex-wrap gap-s-2">
                  {ps.map(s => {
                    const past = new Date(s.start_at) < new Date()
                    const sel = selectedSlot?.id === s.id
                    return (
                      <button key={s.id} disabled={past} onClick={() => setSelectedSlot(s)}
                        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${sel ? 'bg-primary text-white border-primary' : past ? 'bg-surface-2 text-ink-3 border-line cursor-not-allowed opacity-50' : 'bg-surface text-ink border-line hover:border-primary hover:text-primary'}`}>
                        {fmtTime(s.start_at)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {slots.length === 0 && <p className="text-ink-3 text-sm text-center py-4">Aucun créneau disponible cette semaine.</p>}
        </div>
      )}

      {/* Step 2 — Motif */}
      {step === 2 && (
        <div className="flex flex-col gap-s-3">
          <h2 className="text-ink font-medium">Motif de la consultation</h2>
          <div className="flex flex-col gap-s-2">
            <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 200))} maxLength={200} rows={4}
              placeholder="Décrivez brièvement le motif de votre consultation…"
              className="w-full border border-line rounded-md p-s-3 text-ink text-sm bg-surface resize-none focus:outline-none focus:border-primary" />
            <p className="text-ink-3 text-xs text-right">{reason.length}/200</p>
          </div>
          <div className="flex flex-col gap-s-2">
            <label className="text-ink text-sm font-medium">Type de consultation</label>
            <select value={apptType} onChange={e => setApptType(e.target.value as any)}
              className="border border-line rounded-md p-s-3 text-ink text-sm bg-surface focus:outline-none focus:border-primary">
              <option value="in_person">En présentiel</option>
              {teleconsultOk && <option value="teleconsultation">Téléconsultation</option>}
            </select>
          </div>
        </div>
      )}

      {/* Step 3 — Bénéficiaire */}
      {step === 3 && (
        <div className="flex flex-col gap-s-3">
          <h2 className="text-ink font-medium">Pour qui est ce rendez-vous ?</h2>
          {[{ id: 'self', full_name: 'Pour moi' }, ...beneficiaries].map(b => (
            <button key={b.id} onClick={() => setBeneficiaryId(b.id)}
              className={`p-s-3 border rounded-md text-left transition-colors ${beneficiaryId === b.id ? 'border-primary bg-primary/5' : 'border-line bg-surface hover:border-primary'}`}>
              <span className="text-ink text-sm">{b.full_name}</span>
            </button>
          ))}
          <Link to="/app/famille" className="text-primary text-sm">+ Ajouter un bénéficiaire</Link>
        </div>
      )}

      {/* Step 4 — Confirmation */}
      {step === 4 && (
        <div className="flex flex-col gap-s-3">
          <h2 className="text-ink font-medium">Récapitulatif</h2>
          {slotError && <Banner kind="warning">Ce créneau vient d'être pris. <button className="underline" onClick={() => { setSlotError(false); setStep(1) }}>Choisir un autre horaire</button></Banner>}
          <Card className="p-s-4 flex flex-col gap-s-2">
            {selectedSlot && <p className="text-ink text-sm"><span className="text-ink-3">Date : </span>{new Date(selectedSlot.start_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</p>}
            <p className="text-ink text-sm"><span className="text-ink-3">Type : </span>{apptType === 'in_person' ? 'En présentiel' : 'Téléconsultation'}</p>
            {reason && <p className="text-ink text-sm"><span className="text-ink-3">Motif : </span>{reason}</p>}
            <p className="text-ink text-sm"><span className="text-ink-3">Bénéficiaire : </span>{beneficiaryId === 'self' ? 'Moi-même' : beneficiaries.find(b => b.id === beneficiaryId)?.full_name ?? '—'}</p>
          </Card>
          <Button onClick={confirm} disabled={submitting} className="w-full">
            {submitting ? 'Confirmation…' : 'Confirmer le rendez-vous'}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-s-2">
        {step > 0
          ? <Button variant="ghost" onClick={() => setStep(s => s - 1)}><ChevronLeft className="w-4 h-4 mr-1" />Retour</Button>
          : <div />
        }
        {step < 4 && step !== 0 && (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !selectedSlot}>
            Continuer <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
