'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Play, CheckCircle2, FileText, Loader2, Stethoscope } from 'lucide-react'

interface Consult {
  id: string
  status: string
  notes: string | null
  diagnosis: string | null
  treatment: string | null
}

interface Props {
  appointmentId: string
  patientId: string
  professionalId: string
  canStart: boolean
  isInProgress: boolean
  isCompleted: boolean
  existingConsult: Consult | null
}

export function ConsultationActions({
  appointmentId, patientId, professionalId,
  canStart, isInProgress, isCompleted, existingConsult,
}: Props) {
  const router = useRouter()
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [notes,     setNotes]     = useState(existingConsult?.notes     ?? '')
  const [diagnosis, setDiagnosis] = useState(existingConsult?.diagnosis ?? '')
  const [treatment, setTreatment] = useState(existingConsult?.treatment ?? '')
  const [consultId, setConsultId] = useState(existingConsult?.id ?? '')

  async function handleStart() {
    setLoading(true); setError('')
    const supabase = createClient()

    // Créer la consultation
    const { data: newConsult, error: err1 } = await (supabase.from('consultations') as unknown as {
      insert: (v: unknown) => { select: (s: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
    }).insert({
      appointment_id: appointmentId,
      patient_id: patientId,
      professional_id: professionalId,
      status: 'in_progress',
    }).select('id').single()

    if (err1) { setError(err1.message); setLoading(false); return }

    // Mettre à jour le statut du RDV
    await (supabase.from('rendez_vous') as unknown as {
      update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
    }).update({ status: 'in_consultation' }).eq('id', appointmentId)

    if (newConsult) setConsultId(newConsult.id)
    setLoading(false)
    router.refresh()
  }

  async function handleSave() {
    if (!consultId) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await (supabase.from('consultations') as unknown as {
      update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
    }).update({ notes, diagnosis, treatment }).eq('id', consultId)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
  }

  async function handleFinish() {
    setLoading(true); setError('')
    const supabase = createClient()

    if (consultId) {
      await (supabase.from('consultations') as unknown as {
        update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
      }).update({ notes, diagnosis, treatment, status: 'completed' }).eq('id', consultId)
    }

    await (supabase.from('rendez_vous') as unknown as {
      update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
    }).update({ status: 'completed' }).eq('id', appointmentId)

    setLoading(false)
    router.push('/sante/consultations')
    router.refresh()
  }

  if (isCompleted) {
    return (
      <div className="sw-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Consultation terminée</h2>
        </div>
        {existingConsult?.diagnosis && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Diagnostic</p>
            <p className="text-sm text-[var(--sw-ink)]">{existingConsult.diagnosis}</p>
          </div>
        )}
        {existingConsult?.treatment && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Traitement</p>
            <p className="text-sm text-[var(--sw-ink)]">{existingConsult.treatment}</p>
          </div>
        )}
        {existingConsult?.notes && (
          <div className="space-y-1">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Notes</p>
            <p className="text-sm text-[var(--sw-ink)]">{existingConsult.notes}</p>
          </div>
        )}
      </div>
    )
  }

  if (canStart) {
    return (
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-[var(--sw-ink-2)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Consultation</h2>
        </div>
        <p className="text-sm text-[var(--sw-ink-2)]">
          Vérifiez l'identité du patient avant de démarrer.
        </p>
        {error && <p className="text-sm text-[var(--sw-danger)]">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><Play className="w-4 h-4" /> Démarrer la consultation</>
          }
        </button>
      </div>
    )
  }

  if (isInProgress) {
    return (
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[var(--sw-primary)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">En consultation</h2>
          </div>
          <span className="text-xs text-[var(--sw-primary)] font-medium animate-pulse">● En cours</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--sw-ink-2)]">Diagnostic</label>
            <textarea
              className="sw-input w-full resize-none"
              rows={2}
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="Diagnostic principal…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--sw-ink-2)]">Traitement prescrit</label>
            <textarea
              className="sw-input w-full resize-none"
              rows={2}
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              placeholder="Traitement, médicaments, posologie…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--sw-ink-2)]">Notes cliniques</label>
            <textarea
              className="sw-input w-full resize-none"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observations, anamnèse, examen clinique…"
            />
          </div>
        </div>

        {error && <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Enregistrer'}
          </button>
          <Link
            href={`/sante/ordonnances/nouveau?apt=${appointmentId}&patient=${patientId}`}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors"
          >
            <FileText className="w-4 h-4" />
            Ordonnance
          </Link>
          <button
            onClick={handleFinish}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--sw-success)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><CheckCircle2 className="w-4 h-4" /> Terminer</>
            }
          </button>
        </div>
      </div>
    )
  }

  return null
}
