'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save, CheckCircle2, Loader2, Stethoscope, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type Establishment = { id: string; name: string }

type InsertFn = {
  insert: (v: unknown) => { select: (q: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
}
type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programmée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  scheduled:   'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  in_progress: 'bg-blue-50 text-blue-600',
  completed:   'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cancelled:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Props = {
  mode: 'create' | 'edit'
  consultationId?: string
  professionalId: string
  establishments: Establishment[]
  patientId: string | null
  patientName: string | null
  establishmentId: string | null
  appointmentId: string | null
  motif?: string | null
  // edit-mode initial values
  initialStatus?: string
  initialMotif?: string | null
  initialObservations?: string | null
  initialClinicalNotes?: string | null
  initialReport?: string | null
}

export function ConsultationEditor({
  mode, consultationId, professionalId, establishments, patientId, patientName,
  establishmentId, appointmentId, motif,
  initialStatus = 'in_progress', initialMotif, initialObservations, initialClinicalNotes, initialReport,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [estId, setEstId] = useState(establishmentId ?? establishments[0]?.id ?? '')
  const [motifVal, setMotifVal] = useState(initialMotif ?? motif ?? '')
  const [observations, setObservations] = useState(initialObservations ?? '')
  const [clinicalNotes, setClinicalNotes] = useState(initialClinicalNotes ?? '')
  const [report, setReport] = useState(initialReport ?? '')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const isReadOnly = status === 'cancelled' || status === 'completed'

  async function handleSave(newStatus?: string) {
    setError(''); setSaved(false)
    const targetStatus = newStatus ?? status
    const isCompleting = newStatus === 'completed'
    if (isCompleting) setCompleting(true); else setSaving(true)

    const supabase = createClient()

    if (mode === 'create') {
      if (!patientId) { setError('Aucun patient sélectionné.'); setSaving(false); return }
      const { data, error: err } = await (supabase.from('consultations') as unknown as InsertFn)
        .insert({
          professional_id: professionalId,
          patient_id: patientId,
          establishment_id: estId || null,
          appointment_id: appointmentId || null,
          status: targetStatus,
          consultation_date: new Date().toISOString(),
          motif: motifVal || null,
          observations: observations || null,
          clinical_notes: clinicalNotes || null,
          report: report || null,
        })
        .select('id')
        .single()

      if (err) { setError(err.message); setSaving(false); setCompleting(false); return }
      router.push(`/sante/consultations/${data!.id}`)
      return
    }

    if (!consultationId) return
    const { error: err } = await (supabase.from('consultations') as unknown as UpdateFn)
      .update({
        status: targetStatus,
        motif: motifVal || null,
        observations: observations || null,
        clinical_notes: clinicalNotes || null,
        report: report || null,
        establishment_id: estId || null,
      })
      .eq('id', consultationId)
      .eq('professional_id', professionalId)

    if (err) { setError(err.message) } else {
      if (newStatus) setStatus(newStatus)
      setSaved(true)
      router.refresh()
    }
    setSaving(false); setCompleting(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="sw-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <Stethoscope className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--sw-ink)] truncate">
            {mode === 'create' ? 'Nouvelle consultation' : 'Consultation'}
          </p>
          {patientName && <p className="text-xs text-[var(--sw-ink-2)]">{patientName}</p>}
        </div>
        {mode === 'edit' && (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_CLASSES[status] ?? ''}`}>
            {STATUS_LABELS[status] ?? status}
          </span>
        )}
      </div>

      {/* Établissement */}
      {establishments.length > 1 && (
        <div className="sw-card p-4 space-y-2">
          <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Établissement</label>
          <select value={estId} onChange={e => setEstId(e.target.value)} disabled={isReadOnly} className="sw-input w-full text-sm">
            {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {/* Motif */}
      <div className="sw-card p-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Motif de consultation</label>
        <textarea rows={2} className="sw-input w-full resize-none" placeholder="Ex : Consultation de routine, suivi traitement, douleurs thoraciques…"
          value={motifVal} onChange={e => setMotifVal(e.target.value)} disabled={isReadOnly} />
      </div>

      {/* Observations */}
      <div className="sw-card p-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Observations</label>
        <textarea rows={4} className="sw-input w-full resize-none" placeholder="Observations cliniques, examen physique, constantes vitales…"
          value={observations} onChange={e => setObservations(e.target.value)} disabled={isReadOnly} />
      </div>

      {/* Éléments cliniques */}
      <div className="sw-card p-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Éléments cliniques</label>
        <textarea rows={4} className="sw-input w-full resize-none" placeholder="Diagnostic, antécédents pertinents, résultats d'examens, hypothèses…"
          value={clinicalNotes} onChange={e => setClinicalNotes(e.target.value)} disabled={isReadOnly} />
      </div>

      {/* Compte rendu */}
      <div className="sw-card p-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Compte rendu</label>
        <textarea rows={5} className="sw-input w-full resize-none" placeholder="Résumé de la consultation, conclusions, recommandations, conduite à tenir…"
          value={report} onChange={e => setReport(e.target.value)} disabled={isReadOnly} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-success-bg)] text-[var(--sw-success)] text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Enregistré
        </div>
      )}

      {!isReadOnly && (
        <div className="flex gap-2">
          <button onClick={() => handleSave()} disabled={saving || completing}
            className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
          </button>
          {(status === 'scheduled' || status === 'in_progress') && mode === 'edit' && (
            <button onClick={() => handleSave('completed')} disabled={saving || completing}
              className="flex-1 py-2.5 rounded-xl bg-[var(--sw-success)] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Terminer
            </button>
          )}
          {status === 'scheduled' && mode === 'edit' && (
            <button onClick={() => handleSave('in_progress')} disabled={saving || completing}
              className="flex-1 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              Démarrer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
