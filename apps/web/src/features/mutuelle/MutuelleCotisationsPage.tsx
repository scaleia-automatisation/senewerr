import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO, differenceInDays, startOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, AlertTriangle, Search, Download, Bell,
  CreditCard, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Clock, TrendingUp, TrendingDown, Send, X, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatutCot = 'paye' | 'en_retard' | 'tres_en_retard' | 'impaye'
type MoyenPaiement = 'wave' | 'orange_money' | 'especes' | 'virement' | 'stripe'

interface CotisationRow {
  id: string
  contrat_id: string
  adherent_nom: string
  numero_contrat: string
  plan_nom: string
  montant_du: number
  montant_paye: number | null
  date_paiement: string | null
  moyen_paiement: MoyenPaiement | null
  statut: StatutCot
  mois: string
  adherent_id: string
  jours_retard: number
}

interface Kpis {
  attenduMois: number
  encaisseMois: number
  tauxRecouvrement: number
  montantEnRetard: number
  nbAdherents: number
  nbEnRetard: number
}

interface MonthlyDatum {
  mois: string
  attendu: number
  encaisse: number
  retards: number
}

interface Top10Item {
  contratId: string
  nbRetards: number
  adherentNom: string
  numeroContrat: string
}

interface RelanceConfig {
  actif: boolean
  j5: boolean
  j15: boolean
  j30: boolean
  j60suspension: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MOYENS: { value: MoyenPaiement; label: string }[] = [
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'especes', label: 'Espèces' },
  { value: 'virement', label: 'Virement' },
  { value: 'stripe', label: 'Stripe/CB' },
]

function formatFCFA(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function moisLabel(mois: string) {
  const [y, m] = mois.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-SN', { month: 'short', year: '2-digit' })
}

function moisLong(mois: string) {
  const [y, m] = mois.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-SN', { month: 'long', year: 'numeric' })
}

// ── Statut cotisation ─────────────────────────────────────────────────────────

function statutCotisation(mois: string, statut: string): StatutCot {
  if (statut === 'paye') return 'paye'
  const [y, m] = mois.split('-').map(Number)
  const echeance = new Date(y, m - 1, 5) // 5 du mois
  const jours = differenceInDays(new Date(), echeance)
  if (jours >= 60) return 'tres_en_retard'
  if (jours >= 15) return 'en_retard'
  return 'impaye'
}

const STATUT_CFG: Record<StatutCot, { label: string; color: string; icon: string }> = {
  paye:           { label: 'Payée',          color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  en_retard:      { label: 'En retard',       color: 'bg-amber-100 text-amber-700',    icon: '🟠' },
  tres_en_retard: { label: 'Très en retard',  color: 'bg-red-100 text-red-700',        icon: '🔴' },
  impaye:         { label: 'Impayée',         color: 'bg-surface-2 text-ink-3',        icon: '⬜' },
}

// ── Modal paiement ────────────────────────────────────────────────────────────

function PaiementModal({ open, onOpenChange, row, allContrats, onSaved }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row?: CotisationRow | null
  allContrats: { id: string; adherent_nom: string; numero_contrat: string; plan_nom: string; montant_cotisation: number }[]
  onSaved: () => void
}) {
  const [contratId, setContratId] = useState(row?.contrat_id ?? '')
  const [moisSelected, setMoisSelected] = useState<string[]>(row?.mois ? [row.mois] : [])
  const [montant, setMontant] = useState(String(row?.montant_du ?? ''))
  const [moyen, setMoyen] = useState<MoyenPaiement>('wave')
  const [reference, setReference] = useState('')
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [searchAdherent, setSearchAdherent] = useState('')

  // Générer les 12 derniers mois pour le sélecteur
  const moisOptions = useMemo(() => {
    const opts: string[] = []
    for (let i = 0; i < 12; i++) {
      const d = subMonths(new Date(), i)
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return opts
  }, [])

  useEffect(() => {
    if (!open) return
    setContratId(row?.contrat_id ?? '')
    setMoisSelected(row?.mois ? [row.mois] : [])
    setMontant(String(row?.montant_du ?? ''))
    setMoyen('wave'); setReference(''); setSearchAdherent('')
    setDatePaiement(new Date().toISOString().split('T')[0])
  }, [open, row])

  const filteredContrats = useMemo(() => {
    const q = searchAdherent.toLowerCase()
    if (!q) return allContrats.slice(0, 10)
    return allContrats.filter(c =>
      c.adherent_nom.toLowerCase().includes(q) || c.numero_contrat.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [allContrats, searchAdherent])

  const selectedContrat = allContrats.find(c => c.id === contratId)

  function toggleMois(m: string) {
    setMoisSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function handleSubmit() {
    if (!contratId) { toast.error('Sélectionnez un contrat'); return }
    if (!moisSelected.length) { toast.error('Sélectionnez au moins un mois'); return }
    if (!montant || Number(montant) <= 0) { toast.error('Montant invalide'); return }
    if (['wave', 'orange_money'].includes(moyen) && !reference.trim()) {
      toast.error('Référence de transaction obligatoire pour Wave/Orange Money'); return
    }
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('record-cotisation', {
        body: {
          contratId,
          mois: moisSelected,
          montant: Number(montant),
          moyenPaiement: moyen,
          referenceTransaction: reference.trim() || undefined,
          datePaiement,
        },
      })
      if (error) throw error
      toast.success('Cotisation enregistrée — adhérent notifié')
      onOpenChange(false); onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur enregistrement')
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Enregistrer un paiement" size="lg">
      <div className="space-y-s-4 max-h-[80vh] overflow-y-auto pr-s-1">

        {/* Sélection adhérent (si pas pré-rempli) */}
        {!row && (
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Adhérent *</label>
            <div className="relative mb-s-1">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                value={searchAdherent}
                onChange={e => setSearchAdherent(e.target.value)}
                placeholder="Nom ou N° contrat…"
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-surface">
              {filteredContrats.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setContratId(c.id); setMontant(String(c.montant_cotisation)) }}
                  className={`flex w-full items-center gap-s-3 px-s-3 py-s-2 text-left hover:bg-surface-2 ${contratId === c.id ? 'bg-primary/5' : ''}`}
                >
                  {contratId === c.id && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-small font-medium text-ink truncate">{c.adherent_nom}</p>
                    <p className="text-micro text-ink-3 font-mono">{c.numero_contrat} — {c.plan_nom}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {row && (
          <div className="rounded-lg bg-surface-2 p-s-3 text-small">
            <p className="font-medium text-ink">{row.adherent_nom}</p>
            <p className="font-mono text-micro text-ink-3">{row.numero_contrat} — {row.plan_nom}</p>
          </div>
        )}

        {/* Mois */}
        <div>
          <label className="mb-s-2 block text-small font-medium text-ink">Mois à payer *</label>
          <div className="flex flex-wrap gap-s-2">
            {moisOptions.map(m => (
              <button
                key={m}
                onClick={() => toggleMois(m)}
                className={`rounded-full px-s-3 py-s-1 text-micro font-medium transition-colors ${
                  moisSelected.includes(m) ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'
                }`}
              >
                {moisLong(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Montant */}
        <div className="grid grid-cols-2 gap-s-3">
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Montant (FCFA) *</label>
            <input
              type="number"
              min="1"
              value={montant}
              onChange={e => setMontant(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {selectedContrat && (
              <p className="mt-s-0.5 text-micro text-ink-3">Cotisation plan : {formatFCFA(selectedContrat.montant_cotisation)}/mois</p>
            )}
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Date de paiement *</label>
            <input
              type="date"
              value={datePaiement}
              onChange={e => setDatePaiement(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Moyen */}
        <div>
          <label className="mb-s-2 block text-small font-medium text-ink">Moyen de paiement *</label>
          <div className="flex flex-wrap gap-s-2">
            {MOYENS.map(m => (
              <button
                key={m.value}
                onClick={() => setMoyen(m.value)}
                className={`rounded-full px-s-3 py-s-1.5 text-small font-medium border transition-colors ${
                  moyen === m.value ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Référence */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">
            Référence transaction
            {['wave', 'orange_money'].includes(moyen) && <span className="text-red-500 ml-s-1">*</span>}
          </label>
          <input
            type="text"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="Ex. WAVE-2024-XXXXXX"
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end gap-s-2 pt-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal relances ─────────────────────────────────────────────────────────────

function RelancesModal({ open, onOpenChange, contratIds }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  contratIds: string[]
}) {
  const [niveau, setNiveau] = useState<'doux' | 'ferme' | 'urgent' | 'suspension'>('ferme')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-relances', {
        body: { contratIds: contratIds.length ? contratIds : undefined, niveau },
      })
      if (error) throw error
      const r = data?.data ?? data
      toast.success(`Relances envoyées à ${r?.sent ?? '?'} adhérents`)
      if (r?.suspendus > 0) toast.warning(`${r.suspendus} contrat(s) suspendus`)
      onOpenChange(false)
    } catch { toast.error('Erreur envoi relances') }
    finally { setLoading(false) }
  }

  const niveaux = [
    { value: 'doux', label: 'J+5 — Rappel doux', desc: 'Notification simple de rappel' },
    { value: 'ferme', label: 'J+15 — Rappel ferme', desc: 'Notification urgente de mise en demeure' },
    { value: 'urgent', label: 'J+30 — Suspension imminente', desc: 'Alerte critique — couverture menacée' },
    { value: 'suspension', label: 'J+60 — Suspension automatique', desc: '⚠️ Suspendra les contrats en retard' },
  ] as const

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Envoyer des relances" size="md">
      <div className="space-y-s-4">
        <p className="text-small text-ink-3">
          {contratIds.length ? `Envoi vers ${contratIds.length} adhérent(s) sélectionné(s)` : 'Envoi vers tous les adhérents en retard'}
        </p>
        <div className="space-y-s-2">
          {niveaux.map(n => (
            <button
              key={n.value}
              onClick={() => setNiveau(n.value)}
              className={`flex w-full items-start gap-s-3 rounded-lg border p-s-3 text-left transition-colors ${
                niveau === n.value ? 'border-primary bg-primary/5' : 'border-line bg-surface hover:bg-surface-2'
              }`}
            >
              <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${niveau === n.value ? 'border-primary bg-primary' : 'border-line'}`}>
                {niveau === n.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-small font-medium text-ink">{n.label}</p>
                <p className="text-micro text-ink-3">{n.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant={niveau === 'suspension' ? 'danger' : 'primary'}
            loading={loading}
            onClick={handleSend}
            leftIcon={<Send className="h-4 w-4" />}
          >
            Envoyer les relances
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleCotisationsPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [activeSection, setActiveSection] = useState<'tableau' | 'relances' | 'historique' | 'stats'>('tableau')

  // KPIs
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthlyDatum[]>([])
  const [top10, setTop10] = useState<Top10Item[]>([])
  const [loadingKpis, setLoadingKpis] = useState(true)

  // Tableau mensuel
  const [selectedMois, setSelectedMois] = useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [rows, setRows] = useState<CotisationRow[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [sortCol, setSortCol] = useState<string>('adherent_nom')
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [paiementRow, setPaiementRow] = useState<CotisationRow | null>(null)
  const [paiementOpen, setPaiementOpen] = useState(false)
  const [relancesOpen, setRelancesOpen] = useState(false)

  // Contrats actifs (pour modal paiement sans row)
  const [allContrats, setAllContrats] = useState<{ id: string; adherent_nom: string; numero_contrat: string; plan_nom: string; montant_cotisation: number }[]>([])

  // Relances config (persiste localement, idéalement en DB)
  const [relanceConfig, setRelanceConfig] = useState<RelanceConfig>({
    actif: true, j5: true, j15: true, j30: true, j60suspension: false,
  })

  // Matrice historique (12 mois × adhérents)
  const [matrice, setMatrice] = useState<{ mois: string[]; adherents: { nom: string; contratId: string; statuts: Record<string, string> }[] } | null>(null)
  const [loadingMatrice, setLoadingMatrice] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadKpis = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingKpis(true)
    try {
      const { data } = await supabase.functions.invoke('get-cotisations-kpis')
      const r = data?.data ?? data
      setKpis(r?.kpis)
      setMonthlyData(r?.monthlyData ?? [])
      setTop10(r?.top10Retards ?? [])
    } finally { setLoadingKpis(false) }
  }, [mutuelle?.id])

  const loadRows = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingRows(true)
    try {
      // Récupérer les contrats actifs avec plan
      const { data: contratsData } = await db
        .from('contrats')
        .select('id, adherent_id, numero_contrat, plans_mutuelle!contrats_plan_id_fkey(nom, montant_cotisation), profiles!contrats_adherent_id_fkey(full_name)')
        .eq('mutuelle_id', mutuelle.id)
        .eq('statut', 'ACTIF')

      // Récupérer les cotisations du mois
      const { data: cotsData } = await db
        .from('cotisations')
        .select('id, contrat_id, mois, montant, date_paiement, moyen_paiement, statut')
        .eq('mutuelle_id', mutuelle.id)
        .eq('mois', selectedMois)

      const cotsByContrat: Record<string, any> = {}
      for (const c of (cotsData ?? [])) cotsByContrat[c.contrat_id] = c

      const result: CotisationRow[] = (contratsData ?? []).map((c: any) => {
        const cot = cotsByContrat[c.id]
        const montantDu = c.plans_mutuelle?.montant_cotisation ?? 0
        const statut = cot ? (cot.statut === 'paye' ? 'paye' : statutCotisation(selectedMois, cot.statut)) : statutCotisation(selectedMois, 'impaye')
        const [y, m] = selectedMois.split('-').map(Number)
        const echeance = new Date(y, m - 1, 5)
        const joursRetard = cot?.statut === 'paye' ? 0 : Math.max(0, differenceInDays(new Date(), echeance))
        return {
          id: cot?.id ?? `${c.id}-${selectedMois}`,
          contrat_id: c.id,
          adherent_nom: c.profiles?.full_name ?? '—',
          numero_contrat: c.numero_contrat,
          plan_nom: c.plans_mutuelle?.nom ?? '—',
          montant_du: montantDu,
          montant_paye: cot?.montant ?? null,
          date_paiement: cot?.date_paiement ?? null,
          moyen_paiement: cot?.moyen_paiement ?? null,
          statut,
          mois: selectedMois,
          adherent_id: c.adherent_id,
          jours_retard: joursRetard,
        }
      })
      setRows(result)

      // Aussi charger tous les contrats pour le modal libre
      setAllContrats((contratsData ?? []).map((c: any) => ({
        id: c.id,
        adherent_nom: c.profiles?.full_name ?? '—',
        numero_contrat: c.numero_contrat,
        plan_nom: c.plans_mutuelle?.nom ?? '—',
        montant_cotisation: c.plans_mutuelle?.montant_cotisation ?? 0,
      })))
    } finally { setLoadingRows(false) }
  }, [mutuelle?.id, selectedMois])

  const loadMatrice = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingMatrice(true)
    try {
      const moisList: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        moisList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }

      const { data: contratsData } = await db
        .from('contrats')
        .select('id, numero_contrat, profiles!contrats_adherent_id_fkey(full_name)')
        .eq('mutuelle_id', mutuelle.id)
        .eq('statut', 'ACTIF')
        .limit(100)

      const contratIds = (contratsData ?? []).map((c: any) => c.id)
      if (!contratIds.length) { setMatrice({ mois: moisList, adherents: [] }); return }

      const { data: cotsData } = await db
        .from('cotisations')
        .select('contrat_id, mois, statut, date_paiement, montant')
        .in('contrat_id', contratIds)
        .in('mois', moisList)

      const cotMap: Record<string, Record<string, any>> = {}
      for (const c of (cotsData ?? [])) {
        if (!cotMap[c.contrat_id]) cotMap[c.contrat_id] = {}
        cotMap[c.contrat_id][c.mois] = c
      }

      const adherents = (contratsData ?? []).map((c: any) => {
        const statuts: Record<string, string> = {}
        for (const m of moisList) {
          const cot = cotMap[c.id]?.[m]
          if (!cot) statuts[m] = 'absent'
          else if (cot.statut === 'paye') statuts[m] = 'paye'
          else statuts[m] = statutCotisation(m, cot.statut)
        }
        return { nom: c.profiles?.full_name ?? '—', contratId: c.id, statuts }
      })
      setMatrice({ mois: moisList, adherents })
    } finally { setLoadingMatrice(false) }
  }, [mutuelle?.id])

  useEffect(() => { loadKpis() }, [loadKpis])
  useEffect(() => { if (activeSection === 'tableau') loadRows() }, [activeSection, loadRows])
  useEffect(() => { if (activeSection === 'historique') loadMatrice() }, [activeSection, loadMatrice])

  // ── Filtres et tri ────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let r = rows
    if (filterStatut !== 'all') r = r.filter(row => row.statut === filterStatut)
    r = [...r].sort((a, b) => {
      const av = (a as any)[sortCol] ?? ''
      const bv = (b as any)[sortCol] ?? ''
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return r
  }, [rows, filterStatut, sortCol, sortAsc])

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  function prevMois() {
    const [y, m] = selectedMois.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setSelectedMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMois() {
    const [y, m] = selectedMois.split('-').map(Number)
    const d = new Date(y, m, 1)
    setSelectedMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── Export matrice CSV ────────────────────────────────────────────────────────

  function exportMatriceCSV() {
    if (!matrice) return
    const headers = ['Adhérent', ...matrice.mois.map(m => moisLong(m))]
    const statLabels: Record<string, string> = {
      paye: 'Payée', en_retard: 'Payée en retard', tres_en_retard: 'Non payée',
      impaye: 'Impayée', absent: '',
    }
    const lines = matrice.adherents.map(a =>
      [a.nom, ...matrice.mois.map(m => statLabels[a.statuts[m]] ?? '')].join(';')
    )
    const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const el = document.createElement('a')
    el.href = URL.createObjectURL(blob)
    el.download = `cotisations-${new Date().getFullYear()}.csv`
    el.click()
  }

  // ── Sections nav ──────────────────────────────────────────────────────────────

  const SECTIONS = [
    { id: 'tableau' as const, label: 'Tableau mensuel' },
    { id: 'relances' as const, label: 'Relances' },
    { id: 'historique' as const, label: 'Historique 12 mois' },
    { id: 'stats' as const, label: 'Statistiques' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      {/* Header */}
      <h1 className="font-display text-h1 font-semibold text-ink">Cotisations</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-s-3 lg:grid-cols-4">
        {loadingKpis ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-surface-2 animate-pulse" />)
        ) : kpis ? (
          <>
            <div className="rounded-xl border border-line bg-surface p-s-4">
              <p className="text-micro font-medium text-ink-3">Attendu ce mois</p>
              <p className="mt-s-1 text-h2 font-bold text-ink">{formatFCFA(kpis.attenduMois)}</p>
              <p className="text-micro text-ink-3">{kpis.nbAdherents} adhérents actifs</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-s-4">
              <p className="text-micro font-medium text-ink-3">Encaissé</p>
              <p className="mt-s-1 text-h2 font-bold text-emerald-600">{formatFCFA(kpis.encaisseMois)}</p>
              <div className="mt-s-2 h-1.5 rounded-full bg-surface-2">
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${kpis.tauxRecouvrement}%` }} />
              </div>
              <p className="mt-s-1 text-micro text-ink-3">{kpis.tauxRecouvrement}% de recouvrement</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-s-4">
              <p className="text-micro font-medium text-ink-3">Taux recouvrement</p>
              <p className={`mt-s-1 text-h2 font-bold ${kpis.tauxRecouvrement >= 80 ? 'text-emerald-600' : kpis.tauxRecouvrement >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {kpis.tauxRecouvrement}%
              </p>
              <div className="mt-s-2 h-1.5 rounded-full bg-surface-2">
                <div
                  className={`h-1.5 rounded-full transition-all ${kpis.tauxRecouvrement >= 80 ? 'bg-emerald-500' : kpis.tauxRecouvrement >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${kpis.tauxRecouvrement}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-s-4">
              <p className="text-micro font-medium text-ink-3">En retard</p>
              <p className="mt-s-1 text-h2 font-bold text-red-600">{formatFCFA(kpis.montantEnRetard)}</p>
              <p className="text-micro text-ink-3">{kpis.nbEnRetard} contrat{kpis.nbEnRetard !== 1 ? 's' : ''} en retard</p>
            </div>
          </>
        ) : null}
      </div>

      {/* Sous-nav */}
      <div className="flex gap-s-1 overflow-x-auto border-b border-line">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`shrink-0 border-b-2 -mb-px px-s-4 py-s-2.5 text-small font-medium transition-colors ${
              activeSection === s.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ─── Tableau mensuel ──────────────────────────────────────────────────── */}
      {activeSection === 'tableau' && (
        <section>
          {/* Contrôles */}
          <div className="mb-s-4 flex flex-wrap items-center gap-s-3">
            {/* Sélecteur mois */}
            <div className="flex items-center gap-s-1 rounded-lg border border-line bg-surface px-s-2 py-s-1.5">
              <button onClick={prevMois} className="rounded p-s-1 hover:bg-surface-2"><ChevronLeft className="h-4 w-4 text-ink-3" /></button>
              <span className="min-w-[120px] text-center text-small font-medium text-ink">{moisLong(selectedMois)}</span>
              <button onClick={nextMois} className="rounded p-s-1 hover:bg-surface-2"><ChevronRight className="h-4 w-4 text-ink-3" /></button>
            </div>
            {/* Filtre statut */}
            <div className="flex gap-s-1">
              {[
                { value: 'all', label: 'Tous' },
                { value: 'paye', label: '✅ Payées' },
                { value: 'en_retard', label: '🟠 En retard' },
                { value: 'tres_en_retard', label: '🔴 > 60j' },
                { value: 'impaye', label: '⬜ Impayées' },
              ].map(f => (
                <button key={f.value} onClick={() => setFilterStatut(f.value)}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium transition-colors ${
                    filterStatut === f.value ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-s-2">
              {selected.size > 0 && (
                <Button variant="secondary" size="sm" leftIcon={<Bell className="h-4 w-4" />} onClick={() => setRelancesOpen(true)}>
                  Relancer ({selected.size})
                </Button>
              )}
              <Button variant="primary" size="sm" leftIcon={<CreditCard className="h-4 w-4" />} onClick={() => { setPaiementRow(null); setPaiementOpen(true) }}>
                Enregistrer paiement
              </Button>
            </div>
          </div>

          {loadingRows ? (
            <div className="space-y-s-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : filteredRows.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-8 w-8" />} message="Aucune cotisation ce mois" description="Les cotisations des adhérents actifs apparaissent ici." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    <th className="px-s-3 py-s-3 w-10">
                      <input type="checkbox"
                        checked={selected.size === filteredRows.length && filteredRows.length > 0}
                        onChange={e => setSelected(e.target.checked ? new Set(filteredRows.map(r => r.contrat_id)) : new Set())}
                        className="h-4 w-4 rounded border-line text-primary"
                      />
                    </th>
                    {[
                      { col: 'adherent_nom', label: 'Adhérent' },
                      { col: 'plan_nom', label: 'Plan' },
                      { col: 'montant_du', label: 'Dû' },
                      { col: 'montant_paye', label: 'Payé' },
                      { col: 'date_paiement', label: 'Date' },
                      { col: 'moyen_paiement', label: 'Moyen' },
                      { col: 'statut', label: 'Statut' },
                    ].map(h => (
                      <th key={h.col}
                        onClick={() => toggleSort(h.col)}
                        className="cursor-pointer px-s-3 py-s-3 text-left font-semibold text-ink-3 hover:text-ink select-none"
                      >
                        {h.label} {sortCol === h.col ? (sortAsc ? '↑' : '↓') : ''}
                      </th>
                    ))}
                    <th className="px-s-3 py-s-3 text-left font-semibold text-ink-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRows.map(row => {
                    const cfg = STATUT_CFG[row.statut]
                    const isTresRetard = row.statut === 'tres_en_retard'
                    return (
                      <tr key={row.id} className={`hover:bg-surface-2/50 ${isTresRetard ? 'bg-red-50/30' : ''}`}>
                        <td className="px-s-3 py-s-3">
                          <input type="checkbox"
                            checked={selected.has(row.contrat_id)}
                            onChange={e => setSelected(prev => {
                              const s = new Set(prev)
                              e.target.checked ? s.add(row.contrat_id) : s.delete(row.contrat_id)
                              return s
                            })}
                            className="h-4 w-4 rounded border-line text-primary"
                          />
                        </td>
                        <td className="px-s-3 py-s-3">
                          <p className="font-medium text-ink">{row.adherent_nom}</p>
                          <p className="font-mono text-micro text-ink-3">{row.numero_contrat}</p>
                        </td>
                        <td className="px-s-3 py-s-3 text-ink-3">{row.plan_nom}</td>
                        <td className="px-s-3 py-s-3 font-semibold text-ink">{formatFCFA(row.montant_du)}</td>
                        <td className="px-s-3 py-s-3 text-ink-3">{row.montant_paye != null ? formatFCFA(row.montant_paye) : '—'}</td>
                        <td className="px-s-3 py-s-3 text-ink-3">
                          {row.date_paiement ? format(parseISO(row.date_paiement), 'd MMM', { locale: fr }) : '—'}
                        </td>
                        <td className="px-s-3 py-s-3">
                          {row.moyen_paiement
                            ? <span className="capitalize text-ink-3">{MOYENS.find(m => m.value === row.moyen_paiement)?.label ?? row.moyen_paiement}</span>
                            : '—'}
                        </td>
                        <td className="px-s-3 py-s-3">
                          <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {row.jours_retard > 0 && row.statut !== 'paye' && (
                            <p className="text-micro text-ink-3">J+{row.jours_retard}</p>
                          )}
                        </td>
                        <td className="px-s-3 py-s-3">
                          {row.statut !== 'paye' && (
                            <Button variant="primary" size="sm" leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                              onClick={() => { setPaiementRow(row); setPaiementOpen(true) }}>
                              Payer
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

      {/* ─── Relances ─────────────────────────────────────────────────────────── */}
      {activeSection === 'relances' && (
        <section className="space-y-s-4">
          {/* Toggle global */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-s-4">
            <div>
              <p className="font-semibold text-ink">Relances automatiques</p>
              <p className="text-small text-ink-3">Envoyer automatiquement des notifications aux adhérents en retard</p>
            </div>
            <button onClick={() => setRelanceConfig(c => ({ ...c, actif: !c.actif }))}>
              {relanceConfig.actif
                ? <ToggleRight className="h-8 w-8 text-primary" />
                : <ToggleLeft className="h-8 w-8 text-ink-3" />}
            </button>
          </div>

          {/* Règles */}
          <div className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
              <p className="font-semibold text-ink">Règles de relance</p>
            </div>
            {[
              { key: 'j5' as keyof RelanceConfig, label: 'J+5 après échéance', desc: 'SMS rappel doux' },
              { key: 'j15' as keyof RelanceConfig, label: 'J+15 après échéance', desc: 'SMS + email rappel ferme' },
              { key: 'j30' as keyof RelanceConfig, label: 'J+30 après échéance', desc: 'SMS + email + push — couverture menacée' },
              { key: 'j60suspension' as keyof RelanceConfig, label: 'J+60 — Suspension automatique', desc: '⚠️ Suspend les contrats automatiquement' },
            ].map(r => (
              <div key={r.key} className="flex items-center justify-between border-b border-line px-s-4 py-s-3 last:border-0">
                <div>
                  <p className="text-small font-medium text-ink">{r.label}</p>
                  <p className="text-micro text-ink-3">{r.desc}</p>
                </div>
                <button
                  disabled={!relanceConfig.actif}
                  onClick={() => setRelanceConfig(c => ({ ...c, [r.key]: !c[r.key] }))}
                  className="disabled:opacity-40"
                >
                  {relanceConfig[r.key]
                    ? <ToggleRight className="h-6 w-6 text-primary" />
                    : <ToggleLeft className="h-6 w-6 text-ink-3" />}
                </button>
              </div>
            ))}
          </div>

          {/* Relance manuelle */}
          <div className="rounded-xl border border-line bg-surface p-s-4">
            <p className="mb-s-1 font-semibold text-ink">Relance manuelle</p>
            <p className="mb-s-3 text-small text-ink-3">Envoyer immédiatement des notifications aux adhérents en retard</p>
            <Button variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={() => setRelancesOpen(true)}>
              Envoyer relance maintenant
            </Button>
          </div>
        </section>
      )}

      {/* ─── Historique matrice ────────────────────────────────────────────────── */}
      {activeSection === 'historique' && (
        <section>
          <div className="mb-s-3 flex justify-end">
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportMatriceCSV}>
              Exporter CSV/Excel
            </Button>
          </div>
          {loadingMatrice ? (
            <div className="h-64 rounded-xl bg-surface-2 animate-pulse" />
          ) : !matrice || matrice.adherents.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} message="Aucun adhérent actif" description="La matrice apparaît dès que des adhérents sont actifs." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="text-micro">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    <th className="sticky left-0 bg-surface-2 px-s-3 py-s-2 text-left font-semibold text-ink-3 min-w-[160px]">Adhérent</th>
                    {matrice.mois.map(m => (
                      <th key={m} className="px-s-2 py-s-2 font-semibold text-ink-3 text-center whitespace-nowrap min-w-[60px]">{moisLabel(m)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {matrice.adherents.map(a => (
                    <tr key={a.contratId} className="hover:bg-surface-2/50">
                      <td className="sticky left-0 bg-surface px-s-3 py-s-2 font-medium text-ink truncate max-w-[160px]">{a.nom}</td>
                      {matrice.mois.map(m => {
                        const s = a.statuts[m]
                        const cellCfg: Record<string, { bg: string; title: string }> = {
                          paye:           { bg: 'bg-emerald-100', title: 'Payée' },
                          en_retard:      { bg: 'bg-amber-100',   title: 'Payée en retard' },
                          tres_en_retard: { bg: 'bg-red-200',     title: 'Non payée' },
                          impaye:         { bg: 'bg-red-100',     title: 'Impayée' },
                          absent:         { bg: 'bg-surface-2',   title: '—' },
                        }
                        const cc = cellCfg[s] ?? cellCfg.absent
                        return (
                          <td key={m} className="px-s-2 py-s-2 text-center">
                            <div className={`mx-auto h-6 w-6 rounded-full ${cc.bg}`} title={cc.title} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Légende */}
          <div className="mt-s-3 flex flex-wrap gap-s-3">
            {[
              { bg: 'bg-emerald-100', label: 'Payée dans les temps' },
              { bg: 'bg-amber-100', label: 'Payée en retard' },
              { bg: 'bg-red-100', label: 'Impayée' },
              { bg: 'bg-surface-2', label: 'Absent / N/A' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-s-2">
                <div className={`h-4 w-4 rounded-full ${l.bg}`} />
                <span className="text-micro text-ink-3">{l.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Statistiques ────────────────────────────────────────────────────── */}
      {activeSection === 'stats' && (
        <section className="space-y-s-6">
          {/* LineChart attendu vs encaissé */}
          <div className="rounded-xl border border-line bg-surface p-s-4">
            <p className="mb-s-4 font-semibold text-ink">Attendu vs Encaissé sur 12 mois</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="mois" tickFormatter={moisLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
                <YAxis tickFormatter={v => new Intl.NumberFormat('fr-SN', { notation: 'compact' }).format(v)} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
                <Tooltip formatter={(v: any) => formatFCFA(Number(v))} labelFormatter={(l: any) => moisLong(String(l))} />
                <Legend />
                <Line type="monotone" dataKey="attendu" name="Attendu" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="encaisse" name="Encaissé" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* BarChart retards */}
          <div className="rounded-xl border border-line bg-surface p-s-4">
            <p className="mb-s-4 font-semibold text-ink">Retards par mois</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="mois" tickFormatter={moisLabel} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
                <YAxis tickFormatter={v => new Intl.NumberFormat('fr-SN', { notation: 'compact' }).format(v)} tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
                <Tooltip formatter={(v: any) => formatFCFA(Number(v))} labelFormatter={(l: any) => moisLong(String(l))} />
                <Bar dataKey="retards" name="Retards" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 retards */}
          <div className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
              <p className="font-semibold text-ink">Top 10 adhérents avec le plus de retards</p>
            </div>
            {top10.length === 0 ? (
              <p className="p-s-4 text-small text-ink-3">Aucun retard 🎉</p>
            ) : (
              <div className="divide-y divide-line">
                {top10.map((item, idx) => (
                  <div key={item.contratId} className="flex items-center gap-s-3 px-s-4 py-s-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-micro font-bold text-ink-3">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-small font-medium text-ink truncate">{item.adherentNom}</p>
                      <p className="font-mono text-micro text-ink-3">{item.numeroContrat}</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-s-2 py-s-0.5 text-micro font-semibold text-red-700">
                      {item.nbRetards} mois en retard
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <PaiementModal
        open={paiementOpen}
        onOpenChange={v => { if (!v) { setPaiementOpen(false); setPaiementRow(null) } else setPaiementOpen(true) }}
        row={paiementRow}
        allContrats={allContrats}
        onSaved={() => { loadRows(); loadKpis() }}
      />

      <RelancesModal
        open={relancesOpen}
        onOpenChange={setRelancesOpen}
        contratIds={[...selected]}
      />
    </div>
  )
}
