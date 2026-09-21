import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  QrCode, ChevronRight, Filter, BadgeCheck, ShieldOff, Wallet,
  ChevronDown, Loader2, Camera,
} from 'lucide-react'
import { format, parseISO, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Convention {
  id: string
  mutuelle_id: string
  mutuelle_nom: string
  mutuelle_logo?: string | null
  taux_consultation: number
  statut: 'active' | 'expiree'
  date_fin?: string | null
}

interface TpRow {
  id: string
  numero_tp: string
  patient_nom: string
  patient_avatar?: string | null
  mutuelle_nom: string
  type_acte: string
  montant_total: number
  montant_tp: number
  montant_patient: number
  statut: 'pending' | 'valide' | 'refuse' | 'regle'
  motif_refus?: string | null
  created_at: string
}

interface Reglement {
  id: string
  mutuelle_nom: string
  montant: number
  date_reglement: string
  reference?: string | null
}

interface EligibiliteResult {
  adhesion_id: string
  patient_id: string
  patient_nom: string
  numero_contrat: string
  mutuelle_id: string
  mutuelle_nom: string
  mutuelle_logo?: string | null
  plan?: string | null
  plafond_restant?: number | null
  date_expiration?: string | null
  statut: 'valide' | 'suspendu' | 'expire'
  raison?: string | null
  convention_active: boolean
  taux_prise_en_charge?: number | null
}

interface PatientSimple {
  id: string
  nom: string
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const TYPE_ACTE_OPTS = [
  { value: 'consultation',    label: 'Consultation' },
  { value: 'acte_technique',  label: 'Acte technique' },
  { value: 'urgence',         label: 'Urgence' },
]

const STATUT_OPTS = [
  { value: '',        label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'valide',  label: 'Validé' },
  { value: 'refuse',  label: 'Refusé' },
  { value: 'regle',   label: 'Réglé' },
]

const STATUT_BADGE: Record<string, 'accent' | 'success' | 'danger' | 'primary' | 'neutral'> = {
  pending: 'accent',
  valide:  'success',
  refuse:  'danger',
  regle:   'primary',
}

const STATUT_LABEL: Record<string, string> = {
  pending: 'En attente',
  valide:  'Validé',
  refuse:  'Refusé',
  regle:   'Réglé',
}

const TYPE_LABEL: Record<string, string> = {
  consultation:   'Consultation',
  acte_technique: 'Acte technique',
  urgence:        'Urgence',
}

function fcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

// ── Modal Déclencher TP (3 étapes) ─────────────────────────────────────────────
function ModalDeclencherTP({
  open, onClose, conventions, patients,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  conventions: Convention[]
  patients: PatientSimple[]
  onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Étape 1
  const [mode, setMode] = useState<'select' | 'qr'>('select')
  const [qrInput, setQrInput] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedMutuelleId, setSelectedMutuelleId] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [eligibilite, setEligibilite] = useState<EligibiliteResult | null>(null)
  const [eligiErr, setEligiErr] = useState<string | null>(null)

  // Étape 2
  const [typeActe, setTypeActe] = useState('consultation')
  const [montantTotal, setMontantTotal] = useState('')
  const [montantTp, setMontantTp] = useState('')
  const [montantPatient, setMontantPatient] = useState('')
  const [consultationId, setConsultationId] = useState('')
  const [consultations, setConsultations] = useState<{ id: string; label: string }[]>([])

  // Étape 3
  const [submitting, setSubmitting] = useState(false)

  const db = supabase as any
  const { profile } = useAuth()

  useEffect(() => {
    if (!open) {
      setStep(1); setMode('select'); setQrInput(''); setSelectedPatientId('')
      setSelectedMutuelleId(''); setEligibilite(null); setEligiErr(null)
      setTypeActe('consultation'); setMontantTotal(''); setMontantTp('')
      setMontantPatient(''); setConsultationId('')
    }
  }, [open])

  // Auto-compute montant patient when montantTp changes
  useEffect(() => {
    const t = parseFloat(montantTotal) || 0
    const tp = parseFloat(montantTp) || 0
    if (t > 0) setMontantPatient(String(Math.max(0, t - tp)))
  }, [montantTp, montantTotal])

  // Auto-compute montant TP from taux when montant total changes
  useEffect(() => {
    if (eligibilite?.taux_prise_en_charge && montantTotal) {
      const t = parseFloat(montantTotal) || 0
      const tp = Math.round(t * eligibilite.taux_prise_en_charge / 100)
      setMontantTp(String(tp))
    }
  }, [montantTotal, eligibilite])

  // Load recent consultations for this patient
  useEffect(() => {
    if (!eligibilite?.patient_id || !profile?.id) return
    db.from('consultations')
      .select('id, created_at, motif')
      .eq('praticien_id', profile.id)
      .eq('patient_id', eligibilite.patient_id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }: any) => {
        setConsultations((data ?? []).map((c: any) => ({
          id:    c.id,
          label: `${format(parseISO(c.created_at), 'dd/MM/yyyy')}${c.motif ? ` — ${c.motif}` : ''}`,
        })))
      })
  }, [eligibilite?.patient_id, profile?.id])

  async function verifierEligibilite() {
    setVerifying(true); setEligiErr(null); setEligibilite(null)
    try {
      const bodyPayload = mode === 'qr'
        ? { qr_token: qrInput.trim() }
        : { patient_id: selectedPatientId, mutuelle_id: selectedMutuelleId || undefined }

      const { data, error } = await supabase.functions.invoke('verify-carte-mutuelle', {
        body: bodyPayload,
      })
      if (error) throw error

      setEligibilite(data as EligibiliteResult)
    } catch (e: any) {
      setEligiErr(e?.message ?? 'Erreur de vérification')
    } finally {
      setVerifying(false)
    }
  }

  async function handleSubmit() {
    if (!eligibilite) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase.functions.invoke('trigger-tiers-payant', {
        body: {
          adhesion_id:     eligibilite.adhesion_id,
          patient_id:      eligibilite.patient_id,
          mutuelle_id:     eligibilite.mutuelle_id,
          type_acte:       typeActe,
          montant_total:   parseFloat(montantTotal),
          montant_tp:      parseFloat(montantTp),
          montant_patient: parseFloat(montantPatient),
          consultation_id: consultationId || null,
        },
      })
      if (error) throw error
      toast.success(`Tiers payant ${data.numero_tp} déclenché — en attente mutuelle`)
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors du déclenchement')
    } finally {
      setSubmitting(false)
    }
  }

  const canGoStep2 = eligibilite && eligibilite.statut === 'valide' && eligibilite.convention_active
  const canGoStep3 = montantTotal && montantTp && montantPatient
    && parseFloat(montantTotal) > 0
    && Math.abs(parseFloat(montantTp) + parseFloat(montantPatient) - parseFloat(montantTotal)) < 1

  return (
    <Modal open={open} onOpenChange={v => { if (!v) onClose() }} title="Déclencher un tiers payant">
      {/* Stepper */}
      <div className="flex items-center gap-s-2 px-s-4 pt-s-2 pb-s-4 border-b border-line">
        {[
          { n: 1, label: 'Patient' },
          { n: 2, label: 'Acte' },
          { n: 3, label: 'Confirmation' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-s-2 flex-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-micro font-bold transition-colors ${
              step === s.n ? 'bg-primary text-white' : step > s.n ? 'bg-success text-white' : 'bg-surface-2 text-ink-3'
            }`}>{step > s.n ? '✓' : s.n}</div>
            <span className={`text-micro ${step === s.n ? 'text-ink font-medium' : 'text-ink-3'}`}>{s.label}</span>
            {i < 2 && <div className="h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>

      <div className="p-s-4 flex flex-col gap-s-4 min-h-[320px]">
        <AnimatePresence mode="wait">

          {/* ── Étape 1 ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-s-4">

              {/* Mode selector */}
              <div className="flex rounded-lg border border-line overflow-hidden">
                {(['select', 'qr'] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setEligibilite(null); setEligiErr(null) }}
                    className={`flex-1 py-s-2 text-small font-medium transition-colors ${mode === m ? 'bg-primary text-white' : 'text-ink-3 hover:bg-surface-2'}`}>
                    {m === 'select' ? 'Sélectionner patient' : 'Scanner QR carte'}
                  </button>
                ))}
              </div>

              {mode === 'select' ? (
                <div className="flex flex-col gap-s-3">
                  <select value={selectedPatientId} onChange={e => { setSelectedPatientId(e.target.value); setEligibilite(null) }}
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none">
                    <option value="">Sélectionner un patient…</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                  <select value={selectedMutuelleId} onChange={e => { setSelectedMutuelleId(e.target.value); setEligibilite(null) }}
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none">
                    <option value="">Toutes les mutuelles (auto)</option>
                    {conventions.map(c => <option key={c.mutuelle_id} value={c.mutuelle_id}>{c.mutuelle_nom}</option>)}
                  </select>
                  <Button variant="secondary" onClick={verifierEligibilite}
                    disabled={!selectedPatientId || verifying}
                    leftIcon={verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}>
                    {verifying ? 'Vérification…' : 'Vérifier éligibilité'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-s-3">
                  <div className="flex gap-s-2">
                    <input value={qrInput} onChange={e => { setQrInput(e.target.value); setEligibilite(null) }}
                      placeholder="Token QR de la carte mutuelle…"
                      className="flex-1 rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none" />
                    <button className="rounded-lg border border-line p-s-2 text-ink-3 hover:bg-surface-2 transition-colors" title="Scanner via caméra">
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <Button variant="secondary" onClick={verifierEligibilite}
                    disabled={!qrInput.trim() || verifying}
                    leftIcon={verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}>
                    {verifying ? 'Vérification…' : 'Vérifier'}
                  </Button>
                </div>
              )}

              {/* Résultat éligibilité */}
              {eligiErr && (
                <div className="flex items-center gap-s-2 rounded-lg bg-danger/10 p-s-3">
                  <XCircle className="h-5 w-5 shrink-0 text-danger" />
                  <p className="text-small text-danger">{eligiErr}</p>
                </div>
              )}

              {eligibilite && (
                <div className={`rounded-lg border p-s-3 flex flex-col gap-s-2 ${
                  eligibilite.statut === 'valide' && eligibilite.convention_active
                    ? 'border-success bg-success/5' : 'border-danger bg-danger/5'
                }`}>
                  <div className="flex items-center gap-s-2">
                    {eligibilite.statut === 'valide' && eligibilite.convention_active
                      ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                      : <ShieldOff className="h-5 w-5 shrink-0 text-danger" />
                    }
                    <div>
                      <p className="text-small font-semibold text-ink">{eligibilite.patient_nom}</p>
                      <p className="text-micro text-ink-3">{eligibilite.mutuelle_nom} · N° {eligibilite.numero_contrat}</p>
                    </div>
                  </div>
                  {eligibilite.plan && <p className="text-micro text-ink-3">Plan : <span className="text-ink">{eligibilite.plan}</span></p>}
                  {eligibilite.taux_prise_en_charge && (
                    <p className="text-micro text-ink-3">Taux PEC : <span className="text-ink font-medium">{eligibilite.taux_prise_en_charge}%</span></p>
                  )}
                  {eligibilite.plafond_restant != null && (
                    <p className="text-micro text-ink-3">Plafond restant : <span className="text-ink font-medium">{fcfa(eligibilite.plafond_restant)}</span></p>
                  )}
                  {eligibilite.date_expiration && (
                    <p className="text-micro text-ink-3">Expire : {format(parseISO(eligibilite.date_expiration), 'dd/MM/yyyy')}</p>
                  )}
                  {eligibilite.statut !== 'valide' && (
                    <p className="text-micro font-medium text-danger">
                      ⛔ {eligibilite.raison ?? `Couverture ${eligibilite.statut}`}
                    </p>
                  )}
                  {eligibilite.statut === 'valide' && !eligibilite.convention_active && (
                    <p className="text-micro font-medium text-danger">
                      ⛔ Vous n'avez pas de convention active avec {eligibilite.mutuelle_nom}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-s-2 mt-auto">
                <Button variant="ghost" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={() => setStep(2)} disabled={!canGoStep2}>
                  Suivant →
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Étape 2 ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-s-4">

              <div className="rounded-lg bg-surface-2 p-s-3 text-small">
                <span className="text-ink-3">Patient : </span>
                <span className="font-medium text-ink">{eligibilite?.patient_nom}</span>
                <span className="mx-s-2 text-ink-3">·</span>
                <span className="text-ink-3">{eligibilite?.mutuelle_nom}</span>
                {eligibilite?.taux_prise_en_charge && (
                  <span className="ml-s-2 text-success font-medium">{eligibilite.taux_prise_en_charge}% PEC</span>
                )}
              </div>

              {/* Type acte */}
              <div>
                <label className="text-micro text-ink-3 mb-s-1 block">Type d'acte</label>
                <Select options={TYPE_ACTE_OPTS} value={typeActe} onValueChange={setTypeActe} />
              </div>

              {/* Montants */}
              <div className="grid grid-cols-3 gap-s-3">
                <div>
                  <label className="text-micro text-ink-3 mb-s-1 block">Montant total (FCFA)</label>
                  <input type="number" value={montantTotal}
                    onChange={e => setMontantTotal(e.target.value)}
                    placeholder="Ex : 25000"
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-micro text-ink-3 mb-s-1 block">Part mutuelle (FCFA)</label>
                  <input type="number" value={montantTp}
                    onChange={e => setMontantTp(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="text-micro text-ink-3 mb-s-1 block">Part patient (FCFA)</label>
                  <input type="number" value={montantPatient}
                    onChange={e => setMontantPatient(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
                </div>
              </div>

              {montantTotal && montantTp && montantPatient && (
                Math.abs(parseFloat(montantTp) + parseFloat(montantPatient) - parseFloat(montantTotal)) >= 1
                  ? <p className="text-micro text-danger">⚠ Incohérence : part mutuelle + part patient ≠ total</p>
                  : <p className="text-micro text-success">✓ Montants cohérents</p>
              )}

              {/* Consultation liée */}
              {consultations.length > 0 && (
                <div>
                  <label className="text-micro text-ink-3 mb-s-1 block">Consultation liée (optionnel)</label>
                  <select value={consultationId} onChange={e => setConsultationId(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none">
                    <option value="">Aucune consultation liée</option>
                    {consultations.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              )}

              <div className="flex justify-between gap-s-2 mt-auto">
                <Button variant="ghost" onClick={() => setStep(1)}>← Retour</Button>
                <Button variant="primary" onClick={() => setStep(3)} disabled={!canGoStep3}>
                  Suivant →
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Étape 3 ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-s-4">

              <div className="rounded-xl border border-line p-s-4 flex flex-col gap-s-3">
                <h3 className="text-small font-semibold text-ink">Récapitulatif</h3>
                <div className="flex flex-col gap-s-2 text-small">
                  <Row label="Patient" value={eligibilite?.patient_nom ?? '—'} />
                  <Row label="Mutuelle" value={eligibilite?.mutuelle_nom ?? '—'} />
                  <Row label="N° contrat" value={eligibilite?.numero_contrat ?? '—'} />
                  <Row label="Type d'acte" value={TYPE_LABEL[typeActe] ?? typeActe} />
                  <div className="my-s-1 border-t border-line" />
                  <Row label="Montant total" value={fcfa(parseFloat(montantTotal))} bold />
                  <Row label="Part mutuelle" value={fcfa(parseFloat(montantTp))} className="text-success" />
                  <Row label="Part patient" value={fcfa(parseFloat(montantPatient))} />
                </div>
              </div>

              <div className="flex items-center gap-s-2 rounded-lg bg-primary/5 border border-primary/20 p-s-3">
                <Clock className="h-5 w-5 shrink-0 text-primary" />
                <p className="text-small text-ink-3">
                  Après déclenchement, la demande sera visible dans l'espace de la mutuelle en temps réel.
                  Le patient recevra une notification de prise en charge.
                </p>
              </div>

              <div className="flex justify-between gap-s-2 mt-auto">
                <Button variant="ghost" onClick={() => setStep(2)}>← Retour</Button>
                <Button variant="primary"
                  leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  onClick={handleSubmit}
                  disabled={submitting}>
                  {submitting ? 'Déclenchement…' : '✅ Déclencher le tiers payant'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-3">{label}</span>
      <span className={`${bold ? 'font-semibold' : 'font-medium'} text-ink ${className ?? ''}`}>{value}</span>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function TiersPayantPage() {
  const { profile } = useAuth()
  const db = supabase as any

  const [conventions, setConventions]       = useState<Convention[]>([])
  const [patients, setPatients]             = useState<PatientSimple[]>([])
  const [tpRows, setTpRows]                 = useState<TpRow[]>([])
  const [reglements, setReglements]         = useState<Reglement[]>([])
  const [aRecevoir, setARecevoir]           = useState<{ mutuelle: string; montant: number }[]>([])
  const [loading, setLoading]               = useState(true)
  const [loadingTp, setLoadingTp]           = useState(true)
  const [showModal, setShowModal]           = useState(false)
  const [filterStatut, setFilterStatut]     = useState('')
  const [filterMutuelle, setFilterMutuelle] = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [page, setPage]                     = useState(0)
  const [detailTp, setDetailTp]             = useState<TpRow | null>(null)
  const [relancing, setRelancing]           = useState<string | null>(null)

  const PAGE = 20

  // Load conventions & patients
  useEffect(() => {
    if (!profile?.id) return
    Promise.all([
      db.from('conventions_praticien_mutuelle')
        .select('id, mutuelle_id, taux_prise_en_charge, statut, date_fin, mutuelle:mutuelle_id ( nom, logo_url, taux_consultation_defaut )')
        .eq('praticien_id', profile.id),
      db.from('praticien_patients')
        .select('patient_id, patient:patient_id ( id, full_name )')
        .eq('praticien_id', profile.id)
        .eq('actif', true),
    ]).then(([{ data: convs }, { data: pts }]) => {
      setConventions((convs ?? []).map((c: any) => ({
        id:                c.id,
        mutuelle_id:       c.mutuelle_id,
        mutuelle_nom:      c.mutuelle?.nom ?? '—',
        mutuelle_logo:     c.mutuelle?.logo_url,
        taux_consultation: c.mutuelle?.taux_consultation_defaut ?? c.taux_prise_en_charge,
        statut:            c.statut,
        date_fin:          c.date_fin,
      })))
      setPatients((pts ?? []).map((p: any) => ({
        id:  p.patient?.id ?? p.patient_id,
        nom: p.patient?.full_name ?? '—',
      })))
      setLoading(false)
    })
  }, [profile?.id])

  const loadTp = useCallback(async () => {
    if (!profile?.id) return
    setLoadingTp(true)

    let q = db.from('tiers_payants')
      .select(`
        id, numero_tp, type_acte, montant_total, montant_tp, montant_patient,
        statut, motif_refus, created_at,
        patient:patient_id ( full_name, avatar_url ),
        mutuelle:mutuelle_id ( nom )
      `)
      .eq('praticien_id', profile.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (filterStatut)   q = q.eq('statut', filterStatut)
    if (filterMutuelle) q = q.eq('mutuelle_id', filterMutuelle)
    if (dateFrom)       q = q.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo)         q = q.lte('created_at', `${dateTo}T23:59:59`)

    const { data } = await q
    setTpRows((data ?? []).map((r: any) => ({
      id:              r.id,
      numero_tp:       r.numero_tp,
      patient_nom:     r.patient?.full_name ?? '—',
      patient_avatar:  r.patient?.avatar_url,
      mutuelle_nom:    r.mutuelle?.nom ?? '—',
      type_acte:       r.type_acte,
      montant_total:   r.montant_total,
      montant_tp:      r.montant_tp,
      montant_patient: r.montant_patient,
      statut:          r.statut,
      motif_refus:     r.motif_refus,
      created_at:      r.created_at,
    })))
    setLoadingTp(false)
  }, [profile?.id, page, filterStatut, filterMutuelle, dateFrom, dateTo])

  useEffect(() => { loadTp() }, [loadTp])
  useEffect(() => { setPage(0) }, [filterStatut, filterMutuelle, dateFrom, dateTo])

  // Load règlements
  useEffect(() => {
    if (!profile?.id) return
    db.from('reglements_mutuelle')
      .select('id, montant, date_reglement, reference, mutuelle:mutuelle_id ( nom )')
      .eq('praticien_id', profile.id)
      .order('date_reglement', { ascending: false })
      .limit(20)
      .then(({ data }: any) => {
        setReglements((data ?? []).map((r: any) => ({
          id:             r.id,
          mutuelle_nom:   r.mutuelle?.nom ?? '—',
          montant:        r.montant,
          date_reglement: r.date_reglement,
          reference:      r.reference,
        })))
      })

    // Montants à recevoir (TP validé non encore réglé)
    db.from('tiers_payants')
      .select('montant_tp, mutuelle:mutuelle_id ( nom )')
      .eq('praticien_id', profile.id)
      .eq('statut', 'valide')
      .then(({ data }: any) => {
        const byMut: Record<string, number> = {}
        for (const r of (data ?? [])) {
          const nom = r.mutuelle?.nom ?? '—'
          byMut[nom] = (byMut[nom] ?? 0) + r.montant_tp
        }
        setARecevoir(Object.entries(byMut).map(([mutuelle, montant]) => ({ mutuelle, montant })))
      })
  }, [profile?.id])

  // Realtime — TP status updates
  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase.channel('tp-updates')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tiers_payants',
        filter: `praticien_id=eq.${profile.id}`,
      }, payload => {
        const r = payload.new as any
        if (r.statut === 'valide') {
          toast.success(`TP ${r.numero_tp} validé — ${fcfa(r.montant_tp)}`)
        } else if (r.statut === 'refuse') {
          toast.error(`TP ${r.numero_tp} refusé${r.motif_refus ? ` : ${r.motif_refus}` : ''}`)
        }
        loadTp()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, loadTp])

  async function relancer(tp: TpRow) {
    setRelancing(tp.id)
    try {
      await db.from('tiers_payants').update({ updated_at: new Date().toISOString() }).eq('id', tp.id)
      toast.success(`TP ${tp.numero_tp} relancé`)
    } catch {
      toast.error('Erreur lors de la relance')
    } finally {
      setRelancing(null)
    }
  }

  const mutuelleFilterOpts = [
    { value: '', label: 'Toutes les mutuelles' },
    ...conventions.map(c => ({ value: c.mutuelle_id, label: c.mutuelle_nom })),
  ]

  const totalARecevoir = aRecevoir.reduce((s, r) => s + r.montant, 0)

  return (
    <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6">

      {/* ── Section mutuelles conventionnées ── */}
      <section>
        <div className="flex items-center justify-between mb-s-3">
          <h2 className="text-h4 font-semibold text-ink">Mutuelles conventionnées</h2>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>
            Déclencher TP
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-s-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : conventions.length === 0 ? (
          <Card className="p-s-6 text-center text-ink-3">
            <ShieldOff className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
            <p className="text-small">Vous n'êtes conventionné avec aucune mutuelle.</p>
            <p className="text-micro mt-s-1">Contactez les mutuelles partenaires de Sene Werr.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-s-3">
            {conventions.map(c => (
              <Card key={c.id} className="p-s-4 flex flex-col gap-s-2">
                <div className="flex items-center gap-s-3">
                  {c.mutuelle_logo
                    ? <img src={c.mutuelle_logo} alt="" className="h-10 w-10 rounded-lg object-contain border border-line" />
                    : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-small">{c.mutuelle_nom[0]}</div>
                  }
                  <div className="flex-1">
                    <p className="text-small font-semibold text-ink truncate">{c.mutuelle_nom}</p>
                    <p className="text-micro text-ink-3">Taux consultation : {c.taux_consultation}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-s-2">
                  <Badge variant={c.statut === 'active' ? 'success' : 'neutral'}>
                    {c.statut === 'active' ? 'Tiers Payant Actif' : 'Convention expirée'}
                  </Badge>
                  {c.date_fin && (
                    <span className="text-micro text-ink-3">
                      Fin : {format(parseISO(c.date_fin), 'dd/MM/yyyy')}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Tableau suivi TP ── */}
      <section>
        <div className="flex flex-wrap items-center gap-s-2 mb-s-3">
          <h2 className="text-h4 font-semibold text-ink flex-1">Demandes tiers payant</h2>
          <Select options={STATUT_OPTS} value={filterStatut} onValueChange={setFilterStatut} />
          <Select options={mutuelleFilterOpts} value={filterMutuelle} onValueChange={setFilterMutuelle} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-small">
            <thead className="border-b border-line bg-surface-2">
              <tr>
                {['N° TP','Patient','Mutuelle','Acte','Montant TP','Patient','Statut','Date',''].map(h => (
                  <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingTp
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-line">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                      ))}
                    </tr>
                  ))
                : tpRows.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-s-3 py-s-10 text-center text-ink-3">
                        <RefreshCw className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
                        Aucune demande tiers payant
                      </td>
                    </tr>
                  )
                  : tpRows.map(tp => {
                    const isPending48 = tp.statut === 'pending'
                      && differenceInHours(new Date(), parseISO(tp.created_at)) > 48

                    return (
                      <tr key={tp.id}
                        className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors cursor-pointer"
                        onClick={() => setDetailTp(tp)}>
                        <td className="px-s-3 py-s-2 font-mono text-micro font-medium text-ink">{tp.numero_tp}</td>
                        <td className="px-s-3 py-s-2">
                          <div className="flex items-center gap-s-2">
                            <Avatar src={tp.patient_avatar} fallback={tp.patient_nom} size="sm" />
                            <span className="truncate max-w-[100px]">{tp.patient_nom}</span>
                          </div>
                        </td>
                        <td className="px-s-3 py-s-2 text-ink-3 truncate max-w-[100px]">{tp.mutuelle_nom}</td>
                        <td className="px-s-3 py-s-2 text-ink-3">{TYPE_LABEL[tp.type_acte] ?? tp.type_acte}</td>
                        <td className="px-s-3 py-s-2 text-success font-medium whitespace-nowrap">{fcfa(tp.montant_tp)}</td>
                        <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">{fcfa(tp.montant_patient)}</td>
                        <td className="px-s-3 py-s-2">
                          <Badge variant={STATUT_BADGE[tp.statut] ?? 'neutral'}>
                            {STATUT_LABEL[tp.statut] ?? tp.statut}
                          </Badge>
                        </td>
                        <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                          {format(parseISO(tp.created_at), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-s-3 py-s-2" onClick={e => e.stopPropagation()}>
                          {isPending48 && (
                            <button
                              onClick={() => relancer(tp)}
                              disabled={relancing === tp.id}
                              className="flex items-center gap-s-1 rounded px-s-2 py-s-1 text-micro text-accent hover:bg-accent/10 transition-colors"
                            >
                              {relancing === tp.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <RefreshCw className="h-3 w-3" />}
                              Relancer
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-s-2 mt-s-3">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
          <span className="text-small text-ink-3">Page {page + 1}</span>
          <Button variant="ghost" size="sm" disabled={tpRows.length < PAGE} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      </section>

      {/* ── Règlements à recevoir ── */}
      <section>
        <h2 className="text-h4 font-semibold text-ink mb-s-3">Règlements à recevoir</h2>

        {aRecevoir.length === 0 ? (
          <Card className="p-s-4 text-center text-ink-3">
            <Wallet className="mx-auto mb-s-2 h-6 w-6 opacity-30" />
            <p className="text-small">Aucun règlement en attente.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-s-3">
            {/* Total + par mutuelle */}
            <Card className="p-s-4">
              <div className="flex items-center justify-between mb-s-3">
                <h3 className="text-small font-semibold text-ink">Total à recevoir</h3>
                <span className="text-h4 font-bold text-success">{fcfa(totalARecevoir)}</span>
              </div>
              <div className="flex flex-col gap-s-2">
                {aRecevoir.map(r => (
                  <div key={r.mutuelle} className="flex items-center justify-between text-small">
                    <span className="text-ink-3">{r.mutuelle}</span>
                    <span className="font-medium text-ink">{fcfa(r.montant)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Historique règlements */}
            {reglements.length > 0 && (
              <Card className="p-s-4">
                <h3 className="text-small font-semibold text-ink mb-s-3">Historique des règlements reçus</h3>
                <div className="flex flex-col gap-s-2">
                  {reglements.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-s-2 border-b border-line last:border-0">
                      <div>
                        <p className="text-small font-medium text-ink">{r.mutuelle_nom}</p>
                        <p className="text-micro text-ink-3">
                          {format(parseISO(r.date_reglement), 'dd MMMM yyyy', { locale: fr })}
                          {r.reference && ` · Réf : ${r.reference}`}
                        </p>
                      </div>
                      <span className="font-semibold text-primary">{fcfa(r.montant)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ── Modal Déclencher TP ── */}
      <ModalDeclencherTP
        open={showModal}
        onClose={() => setShowModal(false)}
        conventions={conventions}
        patients={patients}
        onSuccess={loadTp}
      />

      {/* ── Modal détail TP ── */}
      <Modal open={!!detailTp} onOpenChange={v => { if (!v) setDetailTp(null) }} title={`Détail — ${detailTp?.numero_tp ?? ''}`}>
        {detailTp && (
          <div className="flex flex-col gap-s-3 p-s-4">
            <Row label="Patient" value={detailTp.patient_nom} />
            <Row label="Mutuelle" value={detailTp.mutuelle_nom} />
            <Row label="Acte" value={TYPE_LABEL[detailTp.type_acte] ?? detailTp.type_acte} />
            <Row label="Date" value={format(parseISO(detailTp.created_at), 'dd MMMM yyyy HH:mm', { locale: fr })} />
            <div className="my-s-1 border-t border-line" />
            <Row label="Montant total" value={fcfa(detailTp.montant_total)} bold />
            <Row label="Part mutuelle" value={fcfa(detailTp.montant_tp)} className="text-success" />
            <Row label="Part patient" value={fcfa(detailTp.montant_patient)} />
            <div className="flex items-center gap-s-2 mt-s-1">
              <Badge variant={STATUT_BADGE[detailTp.statut] ?? 'neutral'}>
                {STATUT_LABEL[detailTp.statut] ?? detailTp.statut}
              </Badge>
            </div>
            {detailTp.statut === 'refuse' && detailTp.motif_refus && (
              <div className="rounded-lg bg-danger/10 p-s-3">
                <p className="text-micro text-ink-3 mb-s-1">Motif de refus</p>
                <p className="text-small text-danger">{detailTp.motif_refus}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
