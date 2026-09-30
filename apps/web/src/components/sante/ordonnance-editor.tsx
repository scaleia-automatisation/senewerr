'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Save, Send, Loader2, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'

type OrdItem = {
  localId: string
  medication_name: string
  dosage: string
  posologie: string
  duree: string
  quantite: string
  renouvellements: number
}

type InsertFn = {
  insert: (v: unknown) => { select: (q: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
}
type InsertManyFn = {
  insert: (v: unknown) => Promise<{ error: { message: string } | null }>
}
type UpdateFn = {
  update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptyItem(): OrdItem {
  return { localId: uid(), medication_name: '', dosage: '', posologie: '', duree: '', quantite: '1', renouvellements: 0 }
}

type Props = {
  mode: 'create'
  professionalId: string
  patientId: string | null
  patientName: string | null
  consultationId: string | null
}

export function OrdonnanceEditor({ professionalId, patientId, patientName, consultationId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<OrdItem[]>([emptyItem()])
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState<'draft' | 'issue' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function updateItem(localId: string, field: keyof OrdItem, value: string | number) {
    setItems(prev => prev.map(it => it.localId === localId ? { ...it, [field]: value } : it))
  }
  function addItem() { setItems(prev => [...prev, emptyItem()]) }
  function removeItem(localId: string) {
    if (items.length <= 1) return
    setItems(prev => prev.filter(it => it.localId !== localId))
  }

  async function handleSave(action: 'draft' | 'issue') {
    setError(''); setSaving(action)
    if (!patientId) { setError('Aucun patient associé.'); setSaving(null); return }
    const filledItems = items.filter(it => it.medication_name.trim())
    if (action === 'issue' && filledItems.length === 0) { setError('Ajoutez au moins un médicament avant d\'émettre.'); setSaving(null); return }

    const supabase = createClient()

    const { data: presc, error: prescErr } = await (supabase.from('prescriptions') as unknown as InsertFn)
      .insert({
        professional_id: professionalId,
        patient_id: patientId,
        consultation_id: consultationId || null,
        status: action === 'issue' ? 'issued' : 'draft',
        issued_at: action === 'issue' ? new Date().toISOString() : null,
        valid_until: validUntil || null,
        notes: notes || null,
        item_count: filledItems.length,
      })
      .select('id')
      .single()

    if (prescErr) { setError(prescErr.message); setSaving(null); return }

    if (filledItems.length > 0) {
      const rows = filledItems.map(it => ({
        prescription_id: presc!.id,
        medication_name: it.medication_name.trim(),
        dosage: it.dosage || null,
        posologie: it.posologie || null,
        duree: it.duree || null,
        quantite: it.quantite || null,
        renouvellements: it.renouvellements || 0,
      }))
      const { error: itemsErr } = await (supabase.from('prescription_items') as unknown as InsertManyFn).insert(rows)
      if (itemsErr) { setError(itemsErr.message); setSaving(null); return }
    }

    setSaving(null); setSuccess(true)
    setTimeout(() => {
      router.push(consultationId ? `/sante/consultations/${consultationId}` : `/sante/ordonnances/${presc!.id}`)
    }, 800)
  }

  if (success) {
    return (
      <div className="sw-card p-10 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)] mx-auto" />
        <p className="text-sm font-medium text-[var(--sw-ink)]">Ordonnance enregistrée</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="sw-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--sw-ink)]">Nouvelle ordonnance</p>
          {patientName && <p className="text-xs text-[var(--sw-ink-2)]">{patientName}</p>}
        </div>
      </div>

      {/* Validité + Notes */}
      <div className="sw-card p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide mb-1.5">Date de fin de validité</label>
          <input type="date" className="sw-input w-full" value={validUntil} onChange={e => setValidUntil(e.target.value)}
            min={new Date().toISOString().split('T')[0]} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide mb-1.5">Notes</label>
          <textarea rows={2} className="sw-input w-full resize-none" placeholder="Instructions particulières, contre-indications…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Médicaments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Médicaments prescrits</h2>
          <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-[var(--sw-primary)] font-medium hover:opacity-80">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        {items.map((item, idx) => (
          <div key={item.localId} className="sw-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">Médicament {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(item.localId)} className="text-[var(--sw-ink-3)] hover:text-[var(--sw-danger)] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Nom du médicament *</label>
                <input type="text" className="sw-input w-full" placeholder="Ex : Amoxicilline 500mg"
                  value={item.medication_name} onChange={e => updateItem(item.localId, 'medication_name', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Dosage</label>
                  <input type="text" className="sw-input w-full" placeholder="Ex : 500mg"
                    value={item.dosage} onChange={e => updateItem(item.localId, 'dosage', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Quantité</label>
                  <input type="text" className="sw-input w-full" placeholder="Ex : 1 boîte"
                    value={item.quantite} onChange={e => updateItem(item.localId, 'quantite', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Posologie (instructions de prise)</label>
                <input type="text" className="sw-input w-full" placeholder="Ex : 1 comprimé 3x/jour pendant les repas"
                  value={item.posologie} onChange={e => updateItem(item.localId, 'posologie', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Durée du traitement</label>
                  <input type="text" className="sw-input w-full" placeholder="Ex : 7 jours"
                    value={item.duree} onChange={e => updateItem(item.localId, 'duree', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--sw-ink-3)] mb-1">Renouvellements</label>
                  <input type="number" min={0} max={12} className="sw-input w-full"
                    value={item.renouvellements} onChange={e => updateItem(item.localId, 'renouvellements', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Avertissement conformité */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--sw-warning-bg)] border border-[var(--sw-warning)]/30">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-warning)]">
          En émettant cette ordonnance, le professionnel de santé certifie qu'elle est conforme à sa prescription. La validité légale et la conformité aux exigences de signature électronique restent soumises à la réglementation en vigueur au Sénégal.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-[var(--sw-danger)] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => handleSave('draft')} disabled={!!saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)] text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
          {saving === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Brouillon
        </button>
        <button onClick={() => handleSave('issue')} disabled={!!saving}
          className="flex-1 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
          {saving === 'issue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Émettre
        </button>
      </div>
    </div>
  )
}
