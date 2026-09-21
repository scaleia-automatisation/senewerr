import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronLeft, Mic, MicOff, Printer, Pill, RefreshCw, Check,
  AlertTriangle, Copy, Clock, User, Stethoscope, Activity,
  FileText, Beaker, Save,
} from 'lucide-react'
import { format, parseISO, differenceInYears, differenceInMinutes } from 'date-fns'
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
import { AllergyBadge } from '@/components/praticien/AllergyBadge'
import { TimerConsultation } from '@/components/praticien/TimerConsultation'
import { cn } from '@/lib/utils'

// ── CIM-10 mini-dataset (codes les plus fréquents) ───────────────────────────

const CIM10_COMMON = [
  { code: 'J06.9',  label: 'Infection aiguë des voies respiratoires supérieures, sans précision' },
  { code: 'A09',    label: 'Diarrhée et gastro-entérite d\'origine infectieuse présumée' },
  { code: 'J18.9',  label: 'Pneumonie, sans précision' },
  { code: 'B50.9',  label: 'Paludisme à Plasmodium falciparum, sans précision' },
  { code: 'E11',    label: 'Diabète sucré de type 2' },
  { code: 'I10',    label: 'Hypertension artérielle essentielle (primitive)' },
  { code: 'J45.9',  label: 'Asthme, sans précision' },
  { code: 'D57.1',  label: 'Drépanocytose sans crise' },
  { code: 'K29.7',  label: 'Gastrite, sans précision' },
  { code: 'M54.5',  label: 'Lombalgie' },
  { code: 'R50.9',  label: 'Fièvre, sans précision' },
  { code: 'R05',    label: 'Toux' },
  { code: 'R51',    label: 'Céphalée' },
  { code: 'J03.9',  label: 'Amygdalite aiguë, sans précision' },
  { code: 'J00',    label: 'Rhinopharyngite aiguë (rhume commun)' },
  { code: 'N39.0',  label: 'Infection des voies urinaires, siège non précisé' },
  { code: 'A01.0',  label: 'Fièvre typhoïde' },
  { code: 'B02.9',  label: 'Zona, sans complication' },
  { code: 'L30.9',  label: 'Dermatite, sans précision' },
  { code: 'E43',    label: 'Malnutrition protéino-énergétique grave, sans précision' },
  { code: 'O80',    label: 'Accouchement normal' },
  { code: 'Z34.9',  label: 'Surveillance d\'une grossesse normale, sans précision' },
  { code: 'K92.1',  label: 'Selles sanglantes' },
  { code: 'J20.9',  label: 'Bronchite aiguë, sans précision' },
  { code: 'B19.9',  label: 'Hépatite virale, sans précision' },
  { code: 'A15.0',  label: 'Tuberculose du poumon avec confirmation bactériologique' },
  { code: 'F20.9',  label: 'Schizophrénie, sans précision' },
  { code: 'G43.9',  label: 'Migraine, sans précision' },
  { code: 'K21.0',  label: 'Reflux gastro-œsophagien avec œsophagite' },
  { code: 'I25.9',  label: 'Cardiopathie ischémique chronique, sans précision' },
  { code: 'R06.0',  label: 'Dyspnée' },
  { code: 'R10.0',  label: 'Douleur abdominale aiguë' },
  { code: 'R11',    label: 'Nausées et vomissements' },
  { code: 'J32.9',  label: 'Sinusite chronique, sans précision' },
  { code: 'D64.9',  label: 'Anémie, sans précision' },
]

function searchCim10(q: string): typeof CIM10_COMMON {
  if (!q || q.length < 2) return []
  const s = q.toLowerCase()
  return CIM10_COMMON.filter(
    c => c.code.toLowerCase().startsWith(s) || c.label.toLowerCase().includes(s)
  ).slice(0, 8)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApptData {
  id: string
  starts_at: string
  ends_at?: string | null
  motif?: string | null
  type?: string | null
  patient_id: string
  status: string
}

interface PatientCtx {
  id: string
  full_name: string
  date_naissance?: string | null
  sexe?: string | null
  avatar_url?: string | null
  allergies: string[]
  pathologies_chroniques: string[]
  groupe_sanguin?: string | null
  derniere_constante?: Record<string, number | null> | null
}

interface SoapForm {
  motif: string
  type_consultation: string
  subjectif: string
  objectif: string
  analyse: string
  plan: string
  diagnostic_principal: string
  diagnostic_code: string
  diagnostics_secondaires: string
  est_chronique: boolean
  premiere_occurrence: boolean
  examens_demandes: string
  resume_patient: string
}

interface Constantes {
  poids_kg: string
  taille_cm: string
  tension_s: string
  tension_d: string
  fc: string
  temp: string
  spo2: string
  glycemie: string
}

const EMPTY_FORM: SoapForm = {
  motif: '', type_consultation: 'consultation',
  subjectif: '', objectif: '', analyse: '', plan: '',
  diagnostic_principal: '', diagnostic_code: '',
  diagnostics_secondaires: '', est_chronique: false,
  premiere_occurrence: false, examens_demandes: '', resume_patient: '',
}

const EMPTY_CST: Constantes = {
  poids_kg: '', taille_cm: '', tension_s: '', tension_d: '',
  fc: '', temp: '', spo2: '', glycemie: '',
}

const TYPE_OPTS = [
  { value: 'premiere_visite',  label: 'Première visite' },
  { value: 'consultation',     label: 'Consultation' },
  { value: 'suivi',            label: 'Suivi' },
  { value: 'urgence',         label: 'Urgence' },
  { value: 'teleconsultation', label: 'Téléconsultation' },
]

// ── IMC calculé en temps réel ─────────────────────────────────────────────────

function calcImc(poids: string, taille: string): string | null {
  const p = parseFloat(poids)
  const t = parseFloat(taille)
  if (!p || !t) return null
  return (p / ((t / 100) ** 2)).toFixed(1)
}

function imcClass(v: number): string {
  if (v < 18.5) return 'text-blue-500'
  if (v < 25)   return 'text-emerald-500'
  if (v < 30)   return 'text-amber-500'
  return 'text-red-500'
}

// ── CIM-10 autocomplete ────────────────────────────────────────────────────────

function Cim10Field({ value, onChange, onCodeSelect }: {
  value: string
  onChange: (v: string) => void
  onCodeSelect: (code: string, label: string) => void
}) {
  const [suggestions, setSuggestions] = useState<typeof CIM10_COMMON>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      const s = searchCim10(value)
      setSuggestions(s)
      setOpen(s.length > 0)
    }, 200)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="relative">
      <Input
        label="Code CIM-10"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="J06, diabète…"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-surface shadow-2">
          {suggestions.map(s => (
            <button key={s.code}
              onMouseDown={() => { onCodeSelect(s.code, s.label); setOpen(false) }}
              className="flex w-full items-start gap-s-2 px-s-3 py-s-2 text-left text-small hover:bg-surface-2">
              <span className="shrink-0 font-mono font-bold text-primary text-micro mt-0.5">{s.code}</span>
              <span className="text-ink-2">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section SOAP ──────────────────────────────────────────────────────────────

function SoapSection({
  id, label, icon, value, onChange, onDictate, dictating, placeholder,
}: {
  id: string; label: string; icon: React.ReactNode; value: string
  onChange: (v: string) => void; onDictate: (field: string) => void
  dictating: string | null; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-s-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-s-1.5 text-small font-semibold text-ink">
          {icon}
          <span className="text-primary font-mono">{id}</span>
          <span className="text-ink-3 font-normal">— {label}</span>
        </label>
        <button
          onClick={() => onDictate(id)}
          title="Dictée vocale (expérimental)"
          className={cn(
            'flex items-center gap-s-1 rounded-md px-s-2 py-s-1 text-micro transition-colors',
            dictating === id
              ? 'bg-red-100 text-red-600 animate-pulse'
              : 'text-ink-3 hover:text-ink',
          )}>
          {dictating === id ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {dictating === id ? 'Stop' : '🎤'}
          {dictating === id ? '' : ' Dictée'}
          <span className="ml-s-1 rounded bg-amber-100 px-s-1 text-micro font-bold text-amber-600">Bêta</span>
        </button>
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-line bg-surface p-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
      />
    </div>
  )
}

// ── Print / PDF CR ────────────────────────────────────────────────────────────

function printCR(patient: PatientCtx, form: SoapForm, praticienName: string, appt?: ApptData | null) {
  const date = appt ? format(parseISO(appt.starts_at), 'EEEE d MMMM yyyy', { locale: fr }) : format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })
  const age  = patient.date_naissance ? differenceInYears(new Date(), parseISO(patient.date_naissance)) : null

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Compte rendu de consultation — ${patient.full_name}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.5; }
  header { border-bottom: 2px solid #1A7A4C; padding-bottom: 12px; margin-bottom: 16px; }
  h1 { font-size: 16pt; color: #1A7A4C; margin: 0; }
  h2 { font-size: 12pt; color: #1A7A4C; margin: 16px 0 4px; border-bottom: 1px solid #e5e7eb; }
  p { margin: 4px 0; }
  .meta { color: #555; font-size: 10pt; }
  .section { margin-bottom: 14px; }
  .warning { border: 1px solid #fbbf24; background: #fffbeb; padding: 6px 12px; margin-bottom: 12px; font-size: 9pt; color: #92400e; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<header>
  <h1>Compte rendu de consultation</h1>
  <p class="meta">Dr. ${praticienName} · ${date}</p>
</header>

<div class="warning">⚕ Document médical confidentiel — Séne Wérr</div>

<div class="section">
  <h2>Patient</h2>
  <p><strong>${patient.full_name}</strong> ${age !== null ? `— ${age} ans` : ''} ${patient.sexe ? `— ${patient.sexe === 'M' ? 'Homme' : 'Femme'}` : ''}</p>
  ${patient.allergies.length ? `<p><strong>Allergies :</strong> ${patient.allergies.join(', ')}</p>` : ''}
</div>

<div class="section">
  <h2>Motif de la consultation</h2>
  <p>${form.motif || '—'}</p>
</div>

${form.diagnostic_principal ? `<div class="section">
  <h2>Diagnostic</h2>
  <p><strong>${form.diagnostic_principal}</strong>${form.diagnostic_code ? ` (${form.diagnostic_code})` : ''}</p>
  ${form.diagnostics_secondaires ? `<p>Secondaires : ${form.diagnostics_secondaires}</p>` : ''}
</div>` : ''}

${form.plan ? `<div class="section">
  <h2>Plan thérapeutique</h2>
  <p style="white-space:pre-wrap">${form.plan}</p>
</div>` : ''}

${form.examens_demandes ? `<div class="section">
  <h2>Examens complémentaires prescrits</h2>
  <p style="white-space:pre-wrap">${form.examens_demandes}</p>
</div>` : ''}

${form.resume_patient ? `<div class="section">
  <h2>Message au patient</h2>
  <p style="white-space:pre-wrap">${form.resume_patient}</p>
</div>` : ''}

<footer style="margin-top:32px; border-top:1px solid #e5e7eb; padding-top:12px; font-size:9pt; color:#888">
  Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')} via Séne Wérr · Données de santé protégées
</footer>
</body>
</html>`

  const w = window.open('', '_blank')
  if (!w) { toast.error('Autoriser les pop-ups pour imprimer'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const [searchParams]    = useSearchParams()
  const navigate          = useNavigate()
  const { profile }       = useAuth()
  const db = supabase as any

  const [appt, setAppt]       = useState<ApptData | null>(null)
  const [patient, setPatient] = useState<PatientCtx | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [readOnly, setReadOnly]   = useState(false)
  const [consultationId, setConsultationId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)

  const [form, setForm]       = useState<SoapForm>(EMPTY_FORM)
  const [cst, setCst]         = useState<Constantes>(EMPTY_CST)
  const [cim10Search, setCim10Search] = useState('')
  const [dictating, setDictating]     = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const draftKey = appointmentId
    ? `consult_draft_${appointmentId}`
    : `consult_draft_new_${searchParams.get('patient') ?? 'x'}`

  // ── Auto-save draft ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      try { localStorage.setItem(draftKey, JSON.stringify({ form, cst })) } catch {}
    }, 20000)
    return () => clearInterval(id)
  }, [form, cst, draftKey])

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    let patientId = searchParams.get('patient') ?? ''
    let apptData: ApptData | null = null

    if (appointmentId) {
      const { data: a } = await db.from('appointments')
        .select('id, starts_at, ends_at, motif, type, patient_id, status')
        .eq('id', appointmentId).single()
      if (a) { apptData = a; patientId = a.patient_id; setStartTime(new Date(a.starts_at)) }
      setAppt(apptData)

      // Load existing consultation if any
      const { data: cons } = await db.from('consultations')
        .select('id, motif, type_consultation, notes_soap_subjectif, notes_soap_objectif, notes_soap_analyse, notes_soap_plan, diagnostic_principal, diagnostic_code, diagnostics_secondaires, examens_demandes, resume_patient, est_chronique, premiere_occurrence')
        .eq('appointment_id', appointmentId).maybeSingle()
      if (cons) {
        setConsultationId(cons.id)
        const draft = (() => { try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null') } catch { return null } })()
        setForm({
          motif:                 draft?.form?.motif               ?? cons.motif ?? a?.motif ?? '',
          type_consultation:     draft?.form?.type_consultation    ?? cons.type_consultation ?? a?.type ?? 'consultation',
          subjectif:             draft?.form?.subjectif            ?? cons.notes_soap_subjectif ?? '',
          objectif:              draft?.form?.objectif             ?? cons.notes_soap_objectif ?? '',
          analyse:               draft?.form?.analyse              ?? cons.notes_soap_analyse ?? '',
          plan:                  draft?.form?.plan                 ?? cons.notes_soap_plan ?? '',
          diagnostic_principal:  draft?.form?.diagnostic_principal ?? cons.diagnostic_principal ?? '',
          diagnostic_code:       draft?.form?.diagnostic_code      ?? cons.diagnostic_code ?? '',
          diagnostics_secondaires:draft?.form?.diagnostics_secondaires ?? cons.diagnostics_secondaires ?? '',
          est_chronique:         cons.est_chronique ?? false,
          premiere_occurrence:   cons.premiere_occurrence ?? false,
          examens_demandes:      draft?.form?.examens_demandes ?? cons.examens_demandes ?? '',
          resume_patient:        draft?.form?.resume_patient ?? cons.resume_patient ?? '',
        })
        if (cst.poids_kg === '' && draft?.cst) setCst(draft.cst)
        // read-only if more than 48h
        const created = new Date(cons.id ? (cons as any).created_at ?? 0 : 0)
        // allow edit if started recently
      }
      else {
        const draft = (() => { try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null') } catch { return null } })()
        if (draft?.form) setForm(f => ({ ...f, motif: a?.motif ?? '', type_consultation: a?.type ?? 'consultation', ...draft.form }))
        else setForm(f => ({ ...f, motif: a?.motif ?? '', type_consultation: a?.type ?? 'consultation' }))
        if (draft?.cst) setCst(draft.cst)
      }
    }

    if (patientId) {
      const [profRes, dossierRes, constRes] = await Promise.all([
        db.from('profiles').select('id, full_name, date_naissance, sexe, avatar_url').eq('id', patientId).single(),
        db.from('dossiers_medicaux').select('allergies, pathologies_chroniques, groupe_sanguin').eq('patient_id', patientId).maybeSingle(),
        db.from('constantes_vitales').select('poids_kg, taille_cm, tension_systolique, tension_diastolique, frequence_cardiaque, temperature_c, saturation_o2, glycemie_mmol').eq('patient_id', patientId).order('mesure_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      setPatient({
        id:                   profRes.data?.id,
        full_name:            profRes.data?.full_name ?? '',
        date_naissance:       profRes.data?.date_naissance,
        sexe:                 profRes.data?.sexe,
        avatar_url:           profRes.data?.avatar_url,
        allergies:            dossierRes.data?.allergies ?? [],
        pathologies_chroniques:dossierRes.data?.pathologies_chroniques ?? [],
        groupe_sanguin:       dossierRes.data?.groupe_sanguin,
        derniere_constante:   constRes.data,
      })
    }

    setLoading(false)
  }, [appointmentId, profile?.id, searchParams.get('patient')])

  useEffect(() => { load() }, [load])

  // ── Dictée vocale ─────────────────────────────────────────────────────────────
  function toggleDictate(field: string) {
    if (dictating === field) {
      recognitionRef.current?.stop()
      setDictating(null)
      return
    }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { toast.warning('Dictée vocale non disponible sur ce navigateur'); return }
    const r: any = new SR()
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = false
    r.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ')
      const soapKey = field === 'S' ? 'subjectif' : field === 'O' ? 'objectif' : field === 'A' ? 'analyse' : 'plan'
      setForm(f => ({ ...f, [soapKey]: f[soapKey as keyof SoapForm] + (f[soapKey as keyof SoapForm] ? ' ' : '') + transcript }))
    }
    r.onerror = () => setDictating(null)
    r.onend   = () => setDictating(null)
    recognitionRef.current = r
    r.start()
    setDictating(field)
  }

  // ── Copier depuis dernière constante ─────────────────────────────────────────
  function copyLastConstantes() {
    const c = patient?.derniere_constante
    if (!c) { toast.info('Aucune constante précédente disponible'); return }
    setCst({
      poids_kg:  c.poids_kg    != null ? String(c.poids_kg)    : '',
      taille_cm: c.taille_cm   != null ? String(c.taille_cm)   : '',
      tension_s: c.tension_systolique  != null ? String(c.tension_systolique)  : '',
      tension_d: c.tension_diastolique != null ? String(c.tension_diastolique) : '',
      fc:        c.frequence_cardiaque != null ? String(c.frequence_cardiaque) : '',
      temp:      c.temperature_c       != null ? String(c.temperature_c)       : '',
      spo2:      c.saturation_o2       != null ? String(c.saturation_o2)       : '',
      glycemie:  c.glycemie_mmol       != null ? String(c.glycemie_mmol)       : '',
    })
    toast.success('Constantes copiées depuis la dernière consultation')
  }

  // ── Sauvegarder (brouillon) ───────────────────────────────────────────────────
  async function saveDraft() {
    if (!patient) return
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('save-consultation', {
      body: {
        appointment_id: appointmentId ?? null,
        patient_id: patient.id,
        ...buildPayload(),
      }
    })
    setSaving(false)
    if (error) { toast.error('Erreur sauvegarde'); return }
    if (data?.consultation_id && !consultationId) setConsultationId(data.consultation_id)
    try { localStorage.setItem(draftKey, JSON.stringify({ form, cst })) } catch {}
    toast.success('Brouillon sauvegardé')
  }

  // ── Terminer la consultation ──────────────────────────────────────────────────
  async function finish() {
    if (!patient) return
    setFinishing(true)
    const { data, error } = await supabase.functions.invoke('save-consultation', {
      body: {
        appointment_id: appointmentId ?? null,
        patient_id: patient.id,
        ...buildPayload(),
      }
    })
    setFinishing(false)
    if (error) { toast.error('Erreur lors de la finalisation'); return }
    try { localStorage.removeItem(draftKey) } catch {}
    toast.success('Consultation enregistrée — patient notifié')
    if (data?.consultation_id) {
      setConsultationId(data.consultation_id)
    }
    navigate('/pro/patients/' + patient.id)
  }

  function buildPayload() {
    return {
      motif:                 form.motif,
      type_consultation:     form.type_consultation,
      subjectif:             form.subjectif,
      objectif:              form.objectif,
      analyse:               form.analyse,
      plan:                  form.plan,
      diagnostic_principal:  form.diagnostic_principal,
      diagnostic_code:       form.diagnostic_code,
      diagnostics_secondaires:form.diagnostics_secondaires,
      est_chronique:         form.est_chronique,
      premiere_occurrence:   form.premiere_occurrence,
      examens_demandes:      form.examens_demandes,
      resume_patient:        form.resume_patient,
      constantes: {
        poids_kg:            cst.poids_kg    ? parseFloat(cst.poids_kg)    : null,
        taille_cm:           cst.taille_cm   ? parseFloat(cst.taille_cm)   : null,
        tension_systolique:  cst.tension_s   ? parseInt(cst.tension_s)     : null,
        tension_diastolique: cst.tension_d   ? parseInt(cst.tension_d)     : null,
        frequence_cardiaque: cst.fc          ? parseInt(cst.fc)            : null,
        temperature_c:       cst.temp        ? parseFloat(cst.temp)        : null,
        saturation_o2:       cst.spo2        ? parseFloat(cst.spo2)        : null,
        glycemie_mmol:       cst.glycemie    ? parseFloat(cst.glycemie)    : null,
      }
    }
  }

  function setF(k: keyof SoapForm) {
    return (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }
  function setC(k: keyof Constantes) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCst(c => ({ ...c, [k]: e.target.value }))
  }

  const imc     = calcImc(cst.poids_kg, cst.taille_cm)
  const imcNum  = imc ? parseFloat(imc) : null

  if (loading) return (
    <div className="flex gap-s-4 p-s-6">
      <Skeleton className="h-96 w-72 shrink-0 rounded-xl" />
      <Skeleton className="h-96 flex-1 rounded-xl" />
    </div>
  )

  const patientAge = patient?.date_naissance
    ? differenceInYears(new Date(), parseISO(patient.date_naissance))
    : null

  return (
    <div className="flex h-full gap-s-4 overflow-hidden p-s-4 md:p-s-6">

      {/* ── Panel gauche — contexte patient ──────────────────────────────────── */}
      <aside className="flex w-68 shrink-0 flex-col gap-s-3 overflow-y-auto">
        {/* Breadcrumb */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-s-1 text-small text-ink-3 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>

        {patient && (
          <>
            <Card className="p-s-4">
              <div className="flex items-center gap-s-3 mb-s-3">
                <Avatar src={patient.avatar_url} fallback={patient.full_name} size="md" />
                <div>
                  <p className="font-semibold text-ink">{patient.full_name}</p>
                  <p className="text-small text-ink-3">
                    {patientAge !== null ? `${patientAge} ans` : '—'}
                    {patient.sexe ? ` · ${patient.sexe === 'M' ? 'H' : patient.sexe === 'F' ? 'F' : '?'}` : ''}
                    {patient.groupe_sanguin ? ` · ${patient.groupe_sanguin}` : ''}
                  </p>
                </div>
              </div>

              {patient.allergies.length > 0 && (
                <div className="mb-s-2 flex flex-wrap gap-s-1">
                  {patient.allergies.map(a => (
                    <span key={a} className="flex items-center gap-s-1 rounded-pill bg-red-100 px-s-2 py-0.5 text-micro font-bold text-red-700">
                      <AlertTriangle className="h-3 w-3" />{a}
                    </span>
                  ))}
                </div>
              )}

              {patient.pathologies_chroniques.length > 0 && (
                <div className="flex flex-wrap gap-s-1">
                  {patient.pathologies_chroniques.map(p => (
                    <Badge key={p} variant="accent">{p}</Badge>
                  ))}
                </div>
              )}
            </Card>

            {/* Timer si depuis RDV */}
            {appt && appt.status === 'in_consultation' && startTime && (
              <Card className="p-s-3">
                <p className="mb-s-1 text-micro font-semibold text-ink-3 uppercase tracking-wide">Durée</p>
                <TimerConsultation running={true} />
              </Card>
            )}

            {/* Dernières constantes */}
            {patient.derniere_constante && (
              <Card className="p-s-3">
                <p className="mb-s-2 text-micro font-semibold text-ink-3 uppercase tracking-wide">Dernières constantes</p>
                <div className="flex flex-col gap-s-1 text-small">
                  {patient.derniere_constante.poids_kg    != null && <span>{patient.derniere_constante.poids_kg} kg</span>}
                  {patient.derniere_constante.tension_systolique != null && (
                    <span>{patient.derniere_constante.tension_systolique}/{patient.derniere_constante.tension_diastolique} mmHg</span>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </aside>

      {/* ── Corps principal — formulaire ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-s-5 overflow-y-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-s-2">
          <h1 className="text-heading font-bold text-ink">
            {appt ? 'Consultation en cours' : 'Nouvelle consultation'}
          </h1>
          <div className="flex items-center gap-s-2">
            <Button variant="ghost" size="sm" leftIcon={<Save className="h-4 w-4" />}
              loading={saving} onClick={saveDraft}>
              Brouillon
            </Button>
            {patient && (
              <Button variant="ghost" size="sm" leftIcon={<Printer className="h-4 w-4" />}
                onClick={() => printCR(patient, form, profile?.full_name ?? 'Médecin', appt)}>
                PDF CR
              </Button>
            )}
          </div>
        </div>

        {/* Section 1 — Patient & type */}
        <Card className="p-s-4">
          <h2 className="mb-s-3 flex items-center gap-s-2 font-semibold text-ink">
            <User className="h-4 w-4 text-primary" /> Patient & contexte
          </h2>
          <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
            <Select label="Type de consultation" options={TYPE_OPTS}
              value={form.type_consultation}
              onValueChange={v => setForm(f => ({ ...f, type_consultation: v }))} />
            <Input label="Motif de la visite" value={form.motif} onChange={setF('motif')}
              placeholder="Douleur abdominale, fièvre, suivi HTA…" />
          </div>
        </Card>

        {/* Section 2 — Constantes vitales */}
        <Card className="p-s-4">
          <div className="mb-s-3 flex items-center justify-between">
            <h2 className="flex items-center gap-s-2 font-semibold text-ink">
              <Activity className="h-4 w-4 text-primary" /> Constantes vitales
            </h2>
            <Button variant="ghost" size="sm" leftIcon={<Copy className="h-4 w-4" />}
              onClick={copyLastConstantes}>
              Copier depuis dernière
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
            <Input label="Poids (kg)" type="number" step="0.1" value={cst.poids_kg}   onChange={setC('poids_kg')} />
            <Input label="Taille (cm)" type="number"            value={cst.taille_cm}  onChange={setC('taille_cm')} />
            <Input label="TA sys (mmHg)" type="number"          value={cst.tension_s}  onChange={setC('tension_s')} />
            <Input label="TA dia (mmHg)" type="number"          value={cst.tension_d}  onChange={setC('tension_d')} />
            <Input label="FC (bpm)" type="number"               value={cst.fc}         onChange={setC('fc')} />
            <Input label="Temp (°C)" type="number" step="0.1"   value={cst.temp}       onChange={setC('temp')} />
            <Input label="SpO2 (%)" type="number" step="0.1"    value={cst.spo2}       onChange={setC('spo2')} />
            <Input label="Glycémie (mmol/L)" type="number" step="0.1" value={cst.glycemie} onChange={setC('glycemie')} />
          </div>
          {imc && (
            <p className="mt-s-2 text-small">
              IMC calculé :&nbsp;
              <span className={cn('font-bold', imcClass(imcNum!))}>{imc}</span>
              <span className="ml-s-1 text-ink-3">
                ({imcNum! < 18.5 ? 'Insuffisance pondérale' : imcNum! < 25 ? 'Normal' : imcNum! < 30 ? 'Surpoids' : 'Obésité'})
              </span>
            </p>
          )}
        </Card>

        {/* Section 3 — Notes SOAP */}
        <Card className="p-s-4">
          <h2 className="mb-s-3 flex items-center gap-s-2 font-semibold text-ink">
            <Stethoscope className="h-4 w-4 text-primary" /> Notes cliniques SOAP
            <span className="ml-auto text-micro font-normal text-red-500 bg-red-50 rounded-pill px-s-2 py-0.5">
              Réservé au praticien — jamais visible au patient
            </span>
          </h2>
          <div className="flex flex-col gap-s-4">
            <SoapSection id="S" label="Subjectif — plaintes du patient" icon={<User className="h-3 w-3" />}
              value={form.subjectif} onChange={v => setForm(f => ({ ...f, subjectif: v }))}
              onDictate={toggleDictate} dictating={dictating}
              placeholder="Description des symptômes tels que rapportés par le patient…" />
            <SoapSection id="O" label="Objectif — examen clinique" icon={<Activity className="h-3 w-3" />}
              value={form.objectif} onChange={v => setForm(f => ({ ...f, objectif: v }))}
              onDictate={toggleDictate} dictating={dictating}
              placeholder="Signes cliniques observés, résultats d'examen physique…" />
            <SoapSection id="A" label="Analyse / Diagnostic" icon={<Stethoscope className="h-3 w-3" />}
              value={form.analyse} onChange={v => setForm(f => ({ ...f, analyse: v }))}
              onDictate={toggleDictate} dictating={dictating}
              placeholder="Interprétation clinique, hypothèses diagnostiques…" />
            <SoapSection id="P" label="Plan thérapeutique" icon={<FileText className="h-3 w-3" />}
              value={form.plan} onChange={v => setForm(f => ({ ...f, plan: v }))}
              onDictate={toggleDictate} dictating={dictating}
              placeholder="Traitement, suivi, orientation, recommandations…" />
          </div>
        </Card>

        {/* Section 4 — Diagnostic */}
        <Card className="p-s-4">
          <h2 className="mb-s-3 flex items-center gap-s-2 font-semibold text-ink">
            <FileText className="h-4 w-4 text-primary" /> Diagnostic
          </h2>
          <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Diagnostic principal</label>
              <input
                value={form.diagnostic_principal}
                onChange={e => setForm(f => ({ ...f, diagnostic_principal: e.target.value }))}
                placeholder="Paludisme simple, Diabète type 2…"
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
              />
            </div>
            <Cim10Field
              value={cim10Search || form.diagnostic_code}
              onChange={v => { setCim10Search(v); setForm(f => ({ ...f, diagnostic_code: v })) }}
              onCodeSelect={(code, label) => {
                setForm(f => ({
                  ...f,
                  diagnostic_code: code,
                  diagnostic_principal: f.diagnostic_principal || label,
                }))
                setCim10Search(code)
              }}
            />
          </div>
          <div className="mt-s-3">
            <label className="mb-s-1 block text-small font-medium text-ink">Diagnostics secondaires</label>
            <textarea rows={2} value={form.diagnostics_secondaires}
              onChange={e => setForm(f => ({ ...f, diagnostics_secondaires: e.target.value }))}
              placeholder="Comorbidités, diagnostics associés…"
              className="w-full resize-none rounded-lg border border-line bg-surface p-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
          </div>
          <div className="mt-s-3 flex gap-s-4">
            <label className="flex items-center gap-s-2 cursor-pointer select-none text-small text-ink">
              <input type="checkbox" checked={form.est_chronique}
                onChange={e => setForm(f => ({ ...f, est_chronique: e.target.checked }))}
                className="h-4 w-4 rounded border-line accent-primary" />
              Maladie chronique
            </label>
            <label className="flex items-center gap-s-2 cursor-pointer select-none text-small text-ink">
              <input type="checkbox" checked={form.premiere_occurrence}
                onChange={e => setForm(f => ({ ...f, premiere_occurrence: e.target.checked }))}
                className="h-4 w-4 rounded border-line accent-primary" />
              Première occurrence
            </label>
          </div>
        </Card>

        {/* Section 5 — Examens complémentaires */}
        <Card className="p-s-4">
          <h2 className="mb-s-3 flex items-center gap-s-2 font-semibold text-ink">
            <Beaker className="h-4 w-4 text-primary" /> Examens complémentaires
          </h2>
          <textarea rows={3} value={form.examens_demandes}
            onChange={e => setForm(f => ({ ...f, examens_demandes: e.target.value }))}
            placeholder="NFS, glycémie à jeun, échographie abdominale, radiographie thoracique…&#10;Ces examens génèrent un bon d'examen visible par le patient."
            className="w-full resize-none rounded-lg border border-line bg-surface p-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        </Card>

        {/* Section 6 — Résumé patient */}
        <Card className="p-s-4">
          <h2 className="mb-s-1 flex items-center gap-s-2 font-semibold text-ink">
            <User className="h-4 w-4 text-primary" /> Message pour le patient
            <span className="ml-auto text-micro font-normal text-emerald-600 bg-emerald-50 rounded-pill px-s-2 py-0.5">
              Visible dans le dossier patient
            </span>
          </h2>
          <p className="mb-s-2 text-micro text-ink-3">Ce message (et seulement celui-ci) sera visible par le patient depuis son application.</p>
          <textarea rows={3} value={form.resume_patient}
            onChange={e => setForm(f => ({ ...f, resume_patient: e.target.value }))}
            placeholder="Prenez votre traitement pendant 7 jours. Revenez si la fièvre persiste. Repos recommandé."
            className="w-full resize-none rounded-lg border border-line bg-surface p-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-s-3 pb-s-6">
          <Button variant="secondary"
            leftIcon={<Pill className="h-4 w-4" />}
            onClick={() => navigate(`/pro/ordonnances/nouvelle?patient=${patient?.id ?? ''}&consultation=${consultationId ?? ''}&diagnostic=${encodeURIComponent(form.diagnostic_principal)}&code=${encodeURIComponent(form.diagnostic_code)}`)}>
            💊 Créer une ordonnance
          </Button>

          {patient && (
            <Button variant="ghost"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => toast.info('Déclenchement TP — disponible dans PR-6')}>
              🔄 Tiers Payant
            </Button>
          )}

          <Button variant="primary" loading={finishing}
            leftIcon={<Check className="h-4 w-4" />}
            onClick={finish}>
            ✅ Terminer et sauvegarder
          </Button>
        </div>
      </div>
    </div>
  )
}
