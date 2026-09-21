import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Edit2, Archive, CheckCircle, XCircle, Search, Download,
  Building2, UserCheck, ShoppingBag, FileText, AlertTriangle,
  ChevronDown, X, BadgeCheck, Stethoscope, Pill,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/mutuelle/StatusBadge'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  nom: string
  montant_cotisation: number
  plafond_consultation: number | null
  plafond_pharma: number | null
  plafond_hospit: number | null
  plafond_analyses: number | null
  plafond_dentaire: number | null
  plafond_optique: number | null
  plafond_annuel: number | null
  taux_consultation: number | null
  taux_pharma: number | null
  taux_hospit: number | null
  taux_analyses: number | null
  delai_carence: number
  max_beneficiaires: number | null
  actif: boolean
  archived_at: string | null
  nb_adherents?: number
}

interface Convention {
  id: string
  statut: 'active' | 'expirée' | 'resiliee'
  date_debut: string
  date_fin: string | null
  // praticien
  praticien_id?: string
  praticien_nom?: string
  praticien_specialite?: string
  praticien_avatar?: string | null
  taux_override?: number | null
  tarif_conventionne?: number | null
  // pharmacie
  pharmacie_id?: string
  pharmacie_nom?: string
  pharmacie_ville?: string
  taux_medicaments?: number | null
  plafond_mensuel?: number | null
}

interface Contrat {
  id: string
  numero_contrat: string
  adherent_nom: string
  plan_nom: string
  date_debut: string
  date_fin: string | null
  statut: string
  adherent_id: string
}

type SubTab = 'plans' | 'praticiens' | 'pharmacies' | 'contrats'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function statutConvention(c: Convention): 'active' | 'expirée' | 'resiliee' {
  if (c.statut === 'resiliee') return 'resiliee'
  if (c.date_fin && new Date(c.date_fin) < new Date()) return 'expirée'
  return 'active'
}

// ── Modal Plan ─────────────────────────────────────────────────────────────────

const INIT_PLAN_FORM = {
  nom: '', montant_cotisation: '',
  plafond_consultation: '', plafond_pharma: '', plafond_hospit: '',
  plafond_analyses: '', plafond_dentaire: '', plafond_optique: '', plafond_annuel: '',
  taux_consultation: '80', taux_pharma: '70', taux_hospit: '80', taux_analyses: '70',
  delai_carence: '0', max_beneficiaires: '5', actif: true,
}

function PlanModal({ open, onOpenChange, plan, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  plan?: Plan | null
  onSaved: () => void
}) {
  const [form, setForm] = useState(INIT_PLAN_FORM)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    if (plan) {
      setForm({
        nom: plan.nom,
        montant_cotisation: String(plan.montant_cotisation),
        plafond_consultation: plan.plafond_consultation != null ? String(plan.plafond_consultation) : '',
        plafond_pharma: plan.plafond_pharma != null ? String(plan.plafond_pharma) : '',
        plafond_hospit: plan.plafond_hospit != null ? String(plan.plafond_hospit) : '',
        plafond_analyses: plan.plafond_analyses != null ? String(plan.plafond_analyses) : '',
        plafond_dentaire: plan.plafond_dentaire != null ? String(plan.plafond_dentaire) : '',
        plafond_optique: plan.plafond_optique != null ? String(plan.plafond_optique) : '',
        plafond_annuel: plan.plafond_annuel != null ? String(plan.plafond_annuel) : '',
        taux_consultation: plan.taux_consultation != null ? String(plan.taux_consultation) : '80',
        taux_pharma: plan.taux_pharma != null ? String(plan.taux_pharma) : '70',
        taux_hospit: plan.taux_hospit != null ? String(plan.taux_hospit) : '80',
        taux_analyses: plan.taux_analyses != null ? String(plan.taux_analyses) : '70',
        delai_carence: String(plan.delai_carence ?? 0),
        max_beneficiaires: plan.max_beneficiaires != null ? String(plan.max_beneficiaires) : '5',
        actif: plan.actif,
      })
    } else {
      setForm(INIT_PLAN_FORM)
    }
    setErrors([])
  }, [open, plan])

  const set = (k: keyof typeof INIT_PLAN_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as any).checked : e.target.value }))

  async function handleSubmit() {
    setErrors([])
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('upsert-plan-mutuelle', {
        body: {
          planId: plan?.id,
          nom: form.nom,
          montant_cotisation: Number(form.montant_cotisation),
          plafond_consultation: form.plafond_consultation ? Number(form.plafond_consultation) : null,
          plafond_pharma: form.plafond_pharma ? Number(form.plafond_pharma) : null,
          plafond_hospit: form.plafond_hospit ? Number(form.plafond_hospit) : null,
          plafond_analyses: form.plafond_analyses ? Number(form.plafond_analyses) : null,
          plafond_dentaire: form.plafond_dentaire ? Number(form.plafond_dentaire) : null,
          plafond_optique: form.plafond_optique ? Number(form.plafond_optique) : null,
          plafond_annuel: form.plafond_annuel ? Number(form.plafond_annuel) : null,
          taux_consultation: form.taux_consultation ? Number(form.taux_consultation) : null,
          taux_pharma: form.taux_pharma ? Number(form.taux_pharma) : null,
          taux_hospit: form.taux_hospit ? Number(form.taux_hospit) : null,
          taux_analyses: form.taux_analyses ? Number(form.taux_analyses) : null,
          delai_carence: Number(form.delai_carence) || 0,
          max_beneficiaires: form.max_beneficiaires ? Number(form.max_beneficiaires) : null,
          actif: form.actif,
        },
      })
      if (error) throw error
      const r = data?.data ?? data
      if (r?.error) { setErrors([r.message]); return }
      toast.success('Plan enregistré')
      onOpenChange(false); onSaved()
    } catch (e: any) {
      const msg = e?.message ?? 'Erreur'
      setErrors([msg])
      toast.error('Erreur : ' + msg)
    } finally { setLoading(false) }
  }

  const InputField = ({ label, field, type = 'text', min, max }: {
    label: string; field: keyof typeof INIT_PLAN_FORM; type?: string; min?: string; max?: string
  }) => (
    <div>
      <label className="mb-s-1 block text-micro font-medium text-ink-3">{label}</label>
      <input
        type={type}
        value={String(form[field])}
        onChange={set(field)}
        min={min}
        max={max}
        className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={plan ? 'Modifier le plan' : 'Créer un plan'} size="xl">
      <div className="space-y-s-4 max-h-[80vh] overflow-y-auto pr-s-1">
        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-s-3">
            {errors.map((e, i) => <p key={i} className="text-small text-red-700">{e}</p>)}
          </div>
        )}

        {/* Infos générales */}
        <section>
          <h3 className="mb-s-2 text-small font-semibold text-ink">Informations générales</h3>
          <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-s-1 block text-micro font-medium text-ink-3">Nom du plan *</label>
              <input
                type="text"
                value={form.nom}
                onChange={set('nom')}
                placeholder="Ex. Plan Famille Plus"
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <InputField label="Cotisation mensuelle (FCFA) *" field="montant_cotisation" type="number" min="0" />
            <InputField label="Plafond annuel global (FCFA)" field="plafond_annuel" type="number" min="0" />
            <InputField label="Délai de carence (jours)" field="delai_carence" type="number" min="0" />
            <InputField label="Nb max bénéficiaires famille" field="max_beneficiaires" type="number" min="1" />
          </div>
          <div className="mt-s-3 flex items-center gap-s-2">
            <input
              type="checkbox"
              id="plan-actif"
              checked={form.actif}
              onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
              className="h-4 w-4 rounded border-line text-primary focus:ring-primary"
            />
            <label htmlFor="plan-actif" className="text-small text-ink">Plan actif (ouvert aux nouvelles souscriptions)</label>
          </div>
        </section>

        {/* Plafonds par catégorie */}
        <section>
          <h3 className="mb-s-2 text-small font-semibold text-ink">Plafonds par catégorie (FCFA/an)</h3>
          <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3">
            <InputField label="Consultations" field="plafond_consultation" type="number" min="0" />
            <InputField label="Médicaments" field="plafond_pharma" type="number" min="0" />
            <InputField label="Hospitalisations" field="plafond_hospit" type="number" min="0" />
            <InputField label="Analyses" field="plafond_analyses" type="number" min="0" />
            <InputField label="Dentaire" field="plafond_dentaire" type="number" min="0" />
            <InputField label="Optique" field="plafond_optique" type="number" min="0" />
          </div>
        </section>

        {/* Taux prise en charge */}
        <section>
          <h3 className="mb-s-2 text-small font-semibold text-ink">Taux de prise en charge (%)</h3>
          <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-4">
            <InputField label="Consultations" field="taux_consultation" type="number" min="0" max="100" />
            <InputField label="Médicaments" field="taux_pharma" type="number" min="0" max="100" />
            <InputField label="Hospitalisations" field="taux_hospit" type="number" min="0" max="100" />
            <InputField label="Analyses" field="taux_analyses" type="number" min="0" max="100" />
          </div>
        </section>

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            Enregistrer plan
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal Convention ──────────────────────────────────────────────────────────

function ConventionModal({ open, onOpenChange, type, convention, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  type: 'praticien' | 'pharmacie'
  convention?: Convention | null
  onSaved: () => void
}) {
  const db = supabase as any
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    tauxOverride: '', tarifConventionne: '',
    tauxMedicaments: '', plafondMensuelPharma: '',
    medicamentsPrisEnCharge: '',
  })

  useEffect(() => {
    if (!open) { setSearch(''); setResults([]); setSelected(null) }
  }, [open])

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const table = type === 'praticien' ? 'praticiens' : 'pharmacies'
      const nameField = 'nom'
      const { data } = await db.from(table).select('id, nom, specialite, ville, photo_url').ilike(nameField, `%${search}%`).limit(8)
      setResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [search, type])

  async function handleSubmit() {
    const targetId = selected?.id ?? convention?.praticien_id ?? convention?.pharmacie_id
    if (!targetId && !convention) { toast.error('Sélectionnez un ' + (type === 'praticien' ? 'praticien' : 'pharmacie')); return }
    setLoading(true)
    try {
      const body: Record<string, any> = {
        conventionId: convention?.id,
        type,
        targetId,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin || undefined,
      }
      if (type === 'praticien') {
        if (form.tauxOverride) body.tauxOverride = Number(form.tauxOverride)
        if (form.tarifConventionne) body.tarifConventionne = Number(form.tarifConventionne)
      } else {
        if (form.tauxMedicaments) body.tauxMedicaments = Number(form.tauxMedicaments)
        if (form.plafondMensuelPharma) body.plafondMensuelPharma = Number(form.plafondMensuelPharma)
        if (form.medicamentsPrisEnCharge.trim()) body.medicamentsPrisEnCharge = form.medicamentsPrisEnCharge.split(',').map(s => s.trim()).filter(Boolean)
      }
      const { error } = await supabase.functions.invoke('sign-convention', { body })
      if (error) throw error
      toast.success('Convention ' + (convention ? 'mise à jour' : 'signée'))
      onOpenChange(false); onSaved()
    } catch { toast.error('Erreur lors de la signature') }
    finally { setLoading(false) }
  }

  const label = type === 'praticien' ? 'praticien' : 'pharmacie'

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={convention ? 'Modifier la convention' : `Signer une convention — ${label}`} size="lg">
      <div className="space-y-s-4 max-h-[75vh] overflow-y-auto pr-s-1">
        {/* Recherche */}
        {!convention && (
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Rechercher un {label} *</label>
            <div className="relative">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Nom, spécialité, ville…`}
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {results.length > 0 && (
              <div className="mt-s-1 rounded-lg border border-line bg-surface shadow-lg overflow-hidden">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setSearch(r.nom); setResults([]) }}
                    className="flex w-full items-center gap-s-3 px-s-3 py-s-2 hover:bg-surface-2 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-micro font-bold text-primary">
                      {r.nom?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-small font-medium text-ink">{r.nom}</p>
                      <p className="text-micro text-ink-3">{r.specialite ?? r.ville ?? ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <p className="mt-s-1 flex items-center gap-s-1 text-micro text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" /> {selected.nom} sélectionné
              </p>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-s-3">
          <div>
            <label className="mb-s-1 block text-micro font-medium text-ink-3">Date de début *</label>
            <input type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-s-1 block text-micro font-medium text-ink-3">Date de fin (optionnel)</label>
            <input type="date" value={form.dateFin} onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        {/* Champs spécifiques praticien */}
        {type === 'praticien' && (
          <div className="grid grid-cols-2 gap-s-3">
            <div>
              <label className="mb-s-1 block text-micro font-medium text-ink-3">Taux override (%, optionnel)</label>
              <input type="number" min="0" max="100" value={form.tauxOverride} onChange={e => setForm(f => ({ ...f, tauxOverride: e.target.value }))}
                placeholder="Ex. 90"
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-s-1 block text-micro font-medium text-ink-3">Tarif conventionné (FCFA, optionnel)</label>
              <input type="number" min="0" value={form.tarifConventionne} onChange={e => setForm(f => ({ ...f, tarifConventionne: e.target.value }))}
                placeholder="Ex. 5000"
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
        )}

        {/* Champs spécifiques pharmacie */}
        {type === 'pharmacie' && (
          <div className="space-y-s-3">
            <div className="grid grid-cols-2 gap-s-3">
              <div>
                <label className="mb-s-1 block text-micro font-medium text-ink-3">Taux remboursement médicaments (%)</label>
                <input type="number" min="0" max="100" value={form.tauxMedicaments} onChange={e => setForm(f => ({ ...f, tauxMedicaments: e.target.value }))}
                  placeholder="Ex. 70"
                  className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-s-1 block text-micro font-medium text-ink-3">Plafond mensuel/adhérent (FCFA)</label>
                <input type="number" min="0" value={form.plafondMensuelPharma} onChange={e => setForm(f => ({ ...f, plafondMensuelPharma: e.target.value }))}
                  placeholder="Ex. 50000"
                  className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div>
              <label className="mb-s-1 block text-micro font-medium text-ink-3">Médicaments/génériques pris en charge (séparés par virgule)</label>
              <textarea
                value={form.medicamentsPrisEnCharge}
                onChange={e => setForm(f => ({ ...f, medicamentsPrisEnCharge: e.target.value }))}
                rows={2}
                placeholder="Paracétamol, Amoxicilline, Ibuprofène…"
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            {convention ? 'Mettre à jour' : 'Signer la convention'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal Renouveler Contrat ──────────────────────────────────────────────────

function RenewModal({ open, onOpenChange, contrat, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; contrat: Contrat | null; onSaved: () => void
}) {
  const [dateFin, setDateFin] = useState('')
  const [montant, setMontant] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && contrat) {
      // Proposer +1 an
      const base = contrat.date_fin ? new Date(contrat.date_fin) : new Date()
      base.setFullYear(base.getFullYear() + 1)
      setDateFin(base.toISOString().split('T')[0])
    }
  }, [open, contrat])

  async function handleSubmit() {
    if (!dateFin || !contrat) return
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('renew-contrat', {
        body: {
          contratId: contrat.id,
          nouvelleDateFin: dateFin,
          nouveauMontantCotisation: montant ? Number(montant) : undefined,
        },
      })
      if (error) throw error
      toast.success('Contrat renouvelé — adhérent notifié')
      onOpenChange(false); onSaved()
    } catch { toast.error('Erreur renouvellement') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Renouveler le contrat" size="sm">
      <div className="space-y-s-4">
        {contrat && (
          <div className="rounded-lg bg-surface-2 p-s-3 text-small">
            <p className="font-medium text-ink">{contrat.adherent_nom}</p>
            <p className="font-mono text-micro text-ink-3">{contrat.numero_contrat} — {contrat.plan_nom}</p>
          </div>
        )}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Nouvelle date de fin *</label>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Nouveau montant cotisation (FCFA, optionnel)</label>
          <input type="number" min="0" value={montant} onChange={e => setMontant(e.target.value)}
            placeholder="Laisser vide pour garder l'actuel"
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} disabled={!dateFin} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            Renouveler
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleContratsPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any
  const [subTab, setSubTab] = useState<SubTab>('plans')

  // Plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [planModal, setPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [archivePlan, setArchivePlan] = useState<Plan | null>(null)
  const [loadingArchive, setLoadingArchive] = useState(false)

  // Conventions praticiens
  const [convPrats, setConvPrats] = useState<Convention[]>([])
  const [loadingPrats, setLoadingPrats] = useState(false)
  const [convPratModal, setConvPratModal] = useState(false)
  const [editConvPrat, setEditConvPrat] = useState<Convention | null>(null)
  const [terminatePrat, setTerminatePrat] = useState<Convention | null>(null)

  // Conventions pharmacies
  const [convPharmas, setConvPharmas] = useState<Convention[]>([])
  const [loadingPharmas, setLoadingPharmas] = useState(false)
  const [convPharmaModal, setConvPharmaModal] = useState(false)
  const [editConvPharma, setEditConvPharma] = useState<Convention | null>(null)
  const [terminatePharma, setTerminatePharma] = useState<Convention | null>(null)

  // Contrats
  const [contrats, setContrats] = useState<Contrat[]>([])
  const [loadingContrats, setLoadingContrats] = useState(false)
  const [searchContrat, setSearchContrat] = useState('')
  const [filterExpiring, setFilterExpiring] = useState(false)
  const [renewContrat, setRenewContrat] = useState<Contrat | null>(null)
  const [loadingTerminate, setLoadingTerminate] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingPlans(true)
    try {
      const { data } = await db.from('plans_mutuelle').select('*').eq('mutuelle_id', mutuelle.id).order('created_at', { ascending: false })
      // Compter adhérents actifs par plan
      const planIds = (data ?? []).map((p: any) => p.id)
      const counts: Record<string, number> = {}
      if (planIds.length) {
        const { data: contData } = await db.from('contrats')
          .select('plan_id')
          .in('plan_id', planIds)
          .eq('statut', 'ACTIF')
        for (const c of (contData ?? [])) {
          counts[c.plan_id] = (counts[c.plan_id] ?? 0) + 1
        }
      }
      setPlans((data ?? []).map((p: any) => ({ ...p, nb_adherents: counts[p.id] ?? 0 })))
    } finally { setLoadingPlans(false) }
  }, [mutuelle?.id])

  const loadConvPrats = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingPrats(true)
    try {
      const { data } = await db.from('conventions_praticiens')
        .select('id, statut, date_debut, date_fin, taux_override, tarif_conventionne, praticien_id, praticiens(nom, specialite, photo_url)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
      setConvPrats((data ?? []).map((c: any) => ({
        id: c.id,
        statut: c.statut,
        date_debut: c.date_debut,
        date_fin: c.date_fin,
        praticien_id: c.praticien_id,
        praticien_nom: c.praticiens?.nom ?? '—',
        praticien_specialite: c.praticiens?.specialite ?? '',
        praticien_avatar: c.praticiens?.photo_url ?? null,
        taux_override: c.taux_override,
        tarif_conventionne: c.tarif_conventionne,
      })))
    } finally { setLoadingPrats(false) }
  }, [mutuelle?.id])

  const loadConvPharmas = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingPharmas(true)
    try {
      const { data } = await db.from('conventions_pharmacies')
        .select('id, statut, date_debut, date_fin, taux_medicaments, plafond_mensuel, pharmacie_id, pharmacies(nom, ville)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
      setConvPharmas((data ?? []).map((c: any) => ({
        id: c.id,
        statut: c.statut,
        date_debut: c.date_debut,
        date_fin: c.date_fin,
        pharmacie_id: c.pharmacie_id,
        pharmacie_nom: c.pharmacies?.nom ?? '—',
        pharmacie_ville: c.pharmacies?.ville ?? '',
        taux_medicaments: c.taux_medicaments,
        plafond_mensuel: c.plafond_mensuel,
      })))
    } finally { setLoadingPharmas(false) }
  }, [mutuelle?.id])

  const loadContrats = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingContrats(true)
    try {
      const { data } = await db.from('contrats')
        .select('id, numero_contrat, statut, date_debut, date_fin, adherent_id, profiles!contrats_adherent_id_fkey(full_name), plans_mutuelle!contrats_plan_id_fkey(nom)')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(200)
      setContrats((data ?? []).map((c: any) => ({
        id: c.id,
        numero_contrat: c.numero_contrat,
        adherent_nom: c.profiles?.full_name ?? '—',
        plan_nom: c.plans_mutuelle?.nom ?? '—',
        date_debut: c.date_debut,
        date_fin: c.date_fin,
        statut: c.statut,
        adherent_id: c.adherent_id,
      })))
    } finally { setLoadingContrats(false) }
  }, [mutuelle?.id])

  useEffect(() => {
    if (subTab === 'plans') loadPlans()
    else if (subTab === 'praticiens') loadConvPrats()
    else if (subTab === 'pharmacies') loadConvPharmas()
    else if (subTab === 'contrats') loadContrats()
  }, [subTab, loadPlans, loadConvPrats, loadConvPharmas, loadContrats])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleArchivePlan() {
    if (!archivePlan) return
    setLoadingArchive(true)
    try {
      const { error } = await supabase.functions.invoke('archive-plan-mutuelle', { body: { planId: archivePlan.id } })
      if (error) throw error
      toast.success('Plan archivé')
      setArchivePlan(null); loadPlans()
    } catch { toast.error('Erreur archivage') }
    finally { setLoadingArchive(false) }
  }

  async function handleTerminate(conv: Convention, type: 'praticien' | 'pharmacie') {
    setLoadingTerminate(true)
    try {
      const { error } = await supabase.functions.invoke('terminate-convention', {
        body: { conventionId: conv.id, type },
      })
      if (error) throw error
      toast.success('Convention résiliée')
      setTerminatePrat(null); setTerminatePharma(null)
      if (type === 'praticien') loadConvPrats(); else loadConvPharmas()
    } catch { toast.error('Erreur résiliation') }
    finally { setLoadingTerminate(false) }
  }

  function exportContratsCSV() {
    const rows = filteredContrats
    const headers = ['N° Contrat', 'Adhérent', 'Plan', 'Date début', 'Date fin', 'Statut']
    const lines = rows.map(c => [
      c.numero_contrat, c.adherent_nom, c.plan_nom,
      c.date_debut ? format(parseISO(c.date_debut), 'dd/MM/yyyy') : '',
      c.date_fin ? format(parseISO(c.date_fin), 'dd/MM/yyyy') : '',
      c.statut,
    ].join(';'))
    const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `contrats-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
  }

  // ── Filtres contrats ──────────────────────────────────────────────────────────

  const filteredContrats = useMemo(() => {
    let rows = contrats
    const q = searchContrat.toLowerCase()
    if (q) rows = rows.filter(c =>
      c.numero_contrat.toLowerCase().includes(q) ||
      c.adherent_nom.toLowerCase().includes(q) ||
      c.plan_nom.toLowerCase().includes(q)
    )
    if (filterExpiring) rows = rows.filter(c => {
      if (!c.date_fin) return false
      return differenceInDays(parseISO(c.date_fin), new Date()) <= 30
    })
    return rows
  }, [contrats, searchContrat, filterExpiring])

  const nbExpiring = useMemo(() =>
    contrats.filter(c => c.date_fin && differenceInDays(parseISO(c.date_fin), new Date()) <= 30 && c.statut === 'ACTIF').length,
    [contrats])

  // ── Tabs config ───────────────────────────────────────────────────────────────

  const TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'plans', label: 'Plans de couverture', icon: <FileText className="h-4 w-4" /> },
    { id: 'praticiens', label: 'Praticiens', icon: <Stethoscope className="h-4 w-4" /> },
    { id: 'pharmacies', label: 'Pharmacies', icon: <Pill className="h-4 w-4" /> },
    { id: 'contrats', label: 'Contrats', icon: <UserCheck className="h-4 w-4" /> },
  ]

  // ── Convention statut badge ───────────────────────────────────────────────────

  function ConvBadge({ conv }: { conv: Convention }) {
    const s = statutConvention(conv)
    return (
      <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${
        s === 'active' ? 'bg-emerald-100 text-emerald-700' :
        s === 'expirée' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
      }`}>
        {s === 'active' ? 'Active' : s === 'expirée' ? 'Expirée' : 'Résiliée'}
      </span>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      {/* Header */}
      <div className="flex flex-col gap-s-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-h1 font-semibold text-ink">Contrats & Conventions</h1>
        {nbExpiring > 0 && (
          <button
            onClick={() => { setSubTab('contrats'); setFilterExpiring(true) }}
            className="flex items-center gap-s-2 rounded-lg border border-amber-200 bg-amber-50 px-s-3 py-s-1.5 text-small text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            {nbExpiring} contrat{nbExpiring > 1 ? 's' : ''} expirant dans 30j
          </button>
        )}
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-s-1 overflow-x-auto border-b border-line">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex shrink-0 items-center gap-s-2 border-b-2 -mb-px px-s-4 py-s-2.5 text-small font-medium transition-colors ${
              subTab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Plans de couverture ─────────────────────────────────────────────── */}
      {subTab === 'plans' && (
        <section>
          <div className="mb-s-4 flex items-center justify-between">
            <p className="text-small text-ink-3">{plans.length} plan{plans.length > 1 ? 's' : ''}</p>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditPlan(null); setPlanModal(true) }}>
              Créer un plan
            </Button>
          </div>
          {loadingPlans ? (
            <div className="space-y-s-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : plans.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} message="Aucun plan créé" description="Créez votre premier plan de couverture mutuelle." />
          ) : (
            <div className="grid gap-s-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map(plan => (
                <div key={plan.id} className={`rounded-xl border p-s-4 space-y-s-3 ${plan.actif ? 'border-line bg-surface' : 'border-line bg-surface-2 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-s-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{plan.nom}</p>
                      <p className="text-micro text-ink-3">{plan.nb_adherents ?? 0} adhérent{(plan.nb_adherents ?? 0) !== 1 ? 's' : ''} actif{(plan.nb_adherents ?? 0) !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-s-1">
                      {plan.actif
                        ? <span className="rounded-full bg-emerald-100 px-s-2 py-s-0.5 text-micro font-semibold text-emerald-700">Actif</span>
                        : <span className="rounded-full bg-surface-3 px-s-2 py-s-0.5 text-micro font-semibold text-ink-3">Archivé</span>
                      }
                    </div>
                  </div>
                  <p className="text-h3 font-bold text-primary">{formatFCFA(plan.montant_cotisation)}<span className="text-small font-normal text-ink-3">/mois</span></p>
                  <div className="grid grid-cols-2 gap-s-2 text-micro">
                    {[
                      ['Consultation', plan.taux_consultation, plan.plafond_consultation],
                      ['Médicaments', plan.taux_pharma, plan.plafond_pharma],
                      ['Hospit.', plan.taux_hospit, plan.plafond_hospit],
                      ['Analyses', plan.taux_analyses, plan.plafond_analyses],
                    ].map(([label, taux, plaf]) => (
                      <div key={String(label)} className="rounded bg-surface-2 px-s-2 py-s-1">
                        <p className="text-ink-3">{label}</p>
                        <p className="font-semibold text-ink">{taux != null ? `${taux}%` : '—'}</p>
                        <p className="text-ink-3">{plaf != null ? formatFCFA(Number(plaf)) : '—'}</p>
                      </div>
                    ))}
                  </div>
                  {plan.delai_carence > 0 && (
                    <p className="text-micro text-ink-3">Délai de carence : {plan.delai_carence}j</p>
                  )}
                  <div className="flex gap-s-2 pt-s-1">
                    <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => { setEditPlan(plan); setPlanModal(true) }}>
                      Modifier
                    </Button>
                    {plan.actif && (
                      <Button variant="ghost" size="sm" leftIcon={<Archive className="h-3.5 w-3.5" />} onClick={() => setArchivePlan(plan)}>
                        Archiver
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Praticiens conventionnés ─────────────────────────────────────────── */}
      {subTab === 'praticiens' && (
        <section>
          <div className="mb-s-4 flex items-center justify-between">
            <p className="text-small text-ink-3">{convPrats.length} convention{convPrats.length > 1 ? 's' : ''}</p>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditConvPrat(null); setConvPratModal(true) }}>
              Ajouter praticien
            </Button>
          </div>
          {loadingPrats ? (
            <div className="space-y-s-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : convPrats.length === 0 ? (
            <EmptyState icon={<Stethoscope className="h-8 w-8" />} message="Aucun praticien conventionné" description="Signez des conventions avec des praticiens pour activer le tiers payant." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['Praticien', 'Spécialité', 'Taux', 'Tarif conv.', 'Période', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {convPrats.map(c => (
                    <tr key={c.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-3">
                        <div className="flex items-center gap-s-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-micro font-bold text-primary">
                            {c.praticien_nom?.charAt(0)}
                          </div>
                          <span className="font-medium text-ink">{c.praticien_nom}</span>
                        </div>
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3">{c.praticien_specialite || '—'}</td>
                      <td className="px-s-3 py-s-3 font-medium text-ink">{c.taux_override != null ? `${c.taux_override}%` : 'Plan par défaut'}</td>
                      <td className="px-s-3 py-s-3 text-ink-3">{formatFCFA(c.tarif_conventionne ?? null)}</td>
                      <td className="px-s-3 py-s-3 text-ink-3 text-micro">
                        {format(parseISO(c.date_debut), 'd MMM yyyy', { locale: fr })}
                        {c.date_fin && <><br />→ {format(parseISO(c.date_fin), 'd MMM yyyy', { locale: fr })}</>}
                      </td>
                      <td className="px-s-3 py-s-3"><ConvBadge conv={c} /></td>
                      <td className="px-s-3 py-s-3">
                        <div className="flex gap-s-1">
                          <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                            onClick={() => { setEditConvPrat(c); setConvPratModal(true) }}>
                            Modifier
                          </Button>
                          {statutConvention(c) === 'active' && (
                            <Button variant="ghost" size="sm" leftIcon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => setTerminatePrat(c)}>
                              Résilier
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Pharmacies conventionnées ────────────────────────────────────────── */}
      {subTab === 'pharmacies' && (
        <section>
          <div className="mb-s-4 flex items-center justify-between">
            <p className="text-small text-ink-3">{convPharmas.length} convention{convPharmas.length > 1 ? 's' : ''}</p>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditConvPharma(null); setConvPharmaModal(true) }}>
              Ajouter pharmacie
            </Button>
          </div>
          {loadingPharmas ? (
            <div className="space-y-s-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : convPharmas.length === 0 ? (
            <EmptyState icon={<Pill className="h-8 w-8" />} message="Aucune pharmacie conventionnée" description="Ajoutez des pharmacies pour permettre le tiers payant médicaments." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['Pharmacie', 'Ville', 'Taux médic.', 'Plafond/mois', 'Période', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {convPharmas.map(c => (
                    <tr key={c.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-3">
                        <div className="flex items-center gap-s-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-micro font-bold">
                            <Pill className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-medium text-ink">{c.pharmacie_nom}</span>
                            {statutConvention(c) === 'active' && (
                              <span className="ml-s-2 rounded-full bg-emerald-100 px-s-1.5 py-s-0.5 text-micro font-semibold text-emerald-700">Tiers Payant Actif</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3">{c.pharmacie_ville || '—'}</td>
                      <td className="px-s-3 py-s-3 font-medium text-ink">{c.taux_medicaments != null ? `${c.taux_medicaments}%` : '—'}</td>
                      <td className="px-s-3 py-s-3 text-ink-3">{formatFCFA(c.plafond_mensuel ?? null)}</td>
                      <td className="px-s-3 py-s-3 text-ink-3 text-micro">
                        {format(parseISO(c.date_debut), 'd MMM yyyy', { locale: fr })}
                        {c.date_fin && <><br />→ {format(parseISO(c.date_fin), 'd MMM yyyy', { locale: fr })}</>}
                      </td>
                      <td className="px-s-3 py-s-3"><ConvBadge conv={c} /></td>
                      <td className="px-s-3 py-s-3">
                        <div className="flex gap-s-1">
                          <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                            onClick={() => { setEditConvPharma(c); setConvPharmaModal(true) }}>
                            Modifier
                          </Button>
                          {statutConvention(c) === 'active' && (
                            <Button variant="ghost" size="sm" leftIcon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => setTerminatePharma(c)}>
                              Résilier
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Contrats adhérents ───────────────────────────────────────────────── */}
      {subTab === 'contrats' && (
        <section>
          <div className="mb-s-3 flex flex-wrap items-center gap-s-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={searchContrat}
                onChange={e => setSearchContrat(e.target.value)}
                placeholder="N° contrat, adhérent, plan…"
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => setFilterExpiring(f => !f)}
              className={`flex items-center gap-s-2 rounded-lg border px-s-3 py-s-2 text-small font-medium transition-colors ${
                filterExpiring ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-line bg-surface text-ink-3 hover:text-ink'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Expirant &lt;30j
            </button>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportContratsCSV}>
              Exporter CSV
            </Button>
          </div>
          {loadingContrats ? (
            <div className="space-y-s-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : filteredContrats.length === 0 ? (
            <EmptyState icon={<UserCheck className="h-8 w-8" />} message="Aucun contrat" description="Les contrats des adhérents apparaissent ici." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['N° Contrat', 'Adhérent', 'Plan', 'Début', 'Fin', 'Statut', 'Action'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredContrats.map(c => {
                    const daysLeft = c.date_fin ? differenceInDays(parseISO(c.date_fin), new Date()) : null
                    const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 && c.statut === 'ACTIF'
                    const isExpired = daysLeft !== null && daysLeft < 0
                    return (
                      <tr key={c.id} className={`hover:bg-surface-2/50 ${isExpiring ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-s-3 py-s-3 font-mono text-micro text-ink-2">{c.numero_contrat}</td>
                        <td className="px-s-3 py-s-3 font-medium text-ink">{c.adherent_nom}</td>
                        <td className="px-s-3 py-s-3 text-ink-3">{c.plan_nom}</td>
                        <td className="px-s-3 py-s-3 text-ink-3">
                          {c.date_debut ? format(parseISO(c.date_debut), 'd MMM yy', { locale: fr }) : '—'}
                        </td>
                        <td className="px-s-3 py-s-3">
                          {c.date_fin ? (
                            <div>
                              <span className={isExpiring ? 'font-semibold text-amber-600' : isExpired ? 'text-red-500' : 'text-ink-3'}>
                                {format(parseISO(c.date_fin), 'd MMM yy', { locale: fr })}
                              </span>
                              {isExpiring && <p className="text-micro text-amber-600">J-{daysLeft}</p>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-s-3 py-s-3"><StatusBadge status={c.statut} size="sm" /></td>
                        <td className="px-s-3 py-s-3">
                          {(isExpiring || isExpired || c.statut === 'EXPIRÉ') && (
                            <Button variant="primary" size="sm" leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                              onClick={() => setRenewContrat(c)}>
                              Renouveler
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <PlanModal
        open={planModal}
        onOpenChange={v => { if (!v) { setPlanModal(false); setEditPlan(null) } else setPlanModal(true) }}
        plan={editPlan}
        onSaved={loadPlans}
      />

      <ConfirmModal
        open={!!archivePlan}
        onOpenChange={v => { if (!v) setArchivePlan(null) }}
        title="Archiver le plan"
        message={`Aucun nouvel adhérent ne pourra souscrire à "${archivePlan?.nom}". Les adhérents existants conservent leur couverture.`}
        confirmLabel="Archiver"
        variant="danger"
        loading={loadingArchive}
        onConfirm={handleArchivePlan}
      />

      <ConventionModal
        open={convPratModal}
        onOpenChange={v => { if (!v) { setConvPratModal(false); setEditConvPrat(null) } else setConvPratModal(true) }}
        type="praticien"
        convention={editConvPrat}
        onSaved={loadConvPrats}
      />

      <ConfirmModal
        open={!!terminatePrat}
        onOpenChange={v => { if (!v) setTerminatePrat(null) }}
        title="Résilier la convention praticien"
        message={`Résilier la convention avec ${terminatePrat?.praticien_nom} ? Le praticien sera notifié et le tiers payant direct sera désactivé.`}
        confirmLabel="Résilier"
        variant="danger"
        loading={loadingTerminate}
        onConfirm={() => terminatePrat && handleTerminate(terminatePrat, 'praticien')}
      />

      <ConventionModal
        open={convPharmaModal}
        onOpenChange={v => { if (!v) { setConvPharmaModal(false); setEditConvPharma(null) } else setConvPharmaModal(true) }}
        type="pharmacie"
        convention={editConvPharma}
        onSaved={loadConvPharmas}
      />

      <ConfirmModal
        open={!!terminatePharma}
        onOpenChange={v => { if (!v) setTerminatePharma(null) }}
        title="Résilier la convention pharmacie"
        message={`Résilier la convention avec ${terminatePharma?.pharmacie_nom} ? La pharmacie sera notifiée et le badge Tiers Payant sera retiré.`}
        confirmLabel="Résilier"
        variant="danger"
        loading={loadingTerminate}
        onConfirm={() => terminatePharma && handleTerminate(terminatePharma, 'pharmacie')}
      />

      <RenewModal
        open={!!renewContrat}
        onOpenChange={v => { if (!v) setRenewContrat(null) }}
        contrat={renewContrat}
        onSaved={loadContrats}
      />
    </div>
  )
}
