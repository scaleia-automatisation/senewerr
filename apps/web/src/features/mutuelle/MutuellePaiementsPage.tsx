import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO, differenceInBusinessDays, subMonths, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CheckCircle, AlertTriangle, Download, Search, CreditCard,
  TrendingUp, TrendingDown, ToggleLeft, ToggleRight, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type ModeRemb = 'wave' | 'orange_money' | 'virement' | 'especes'

interface DemandeAPayer {
  id: string
  numero_demande: string
  adherent_nom: string
  adherent_tel: string | null
  adherent_wave: string | null
  montant_approuve: number
  date_approbation: string
  jours_ouvrables: number
  mode_prefere: string | null
}

interface MouvementFinancier {
  id: string
  date: string
  type: 'entrant' | 'sortant'
  libelle: string
  sous_type: string
  montant: number
  mode: string | null
  reference: string | null
}

interface TresoData {
  mois: string
  entrees: number
  sorties: number
  solde: number
}

interface PaiementConfig {
  delai_cible_jours: number
  mode_defaut: ModeRemb
  wave_auto: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function moisLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('fr-SN', { month: 'short', year: '2-digit' })
}

const MODES: { value: ModeRemb; label: string }[] = [
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'virement', label: 'Virement' },
  { value: 'especes', label: 'Espèces' },
]

// ── Modal remboursement individuel ────────────────────────────────────────────

function RemboursementModal({ open, onOpenChange, demande, onDone }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  demande: DemandeAPayer | null
  onDone: () => void
}) {
  const [mode, setMode] = useState<ModeRemb>('wave')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !demande) return
    const prefered = demande.mode_prefere as ModeRemb | null
    setMode(prefered ?? 'wave')
    setReference(''); setDate(new Date().toISOString().split('T')[0])
  }, [open, demande])

  async function handleSubmit() {
    if (!demande) return
    if (!reference.trim() && mode !== 'especes') { toast.error('Référence obligatoire pour ce mode'); return }
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('record-remboursement-effectue', {
        body: { demandeId: demande.id, modePaiement: mode, reference: reference.trim() || undefined, dateEffective: date },
      })
      if (error) throw error
      toast.success('Remboursement enregistré — patient notifié')
      onOpenChange(false); onDone()
    } catch { toast.error('Erreur enregistrement remboursement') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Marquer comme remboursé" size="sm">
      <div className="space-y-s-4">
        {demande && (
          <div className="rounded-lg bg-surface-2 p-s-3 text-small">
            <p className="font-medium text-ink">{demande.adherent_nom}</p>
            <p className="font-mono text-micro text-ink-3">{demande.numero_demande} — <span className="font-semibold text-ink">{formatFCFA(demande.montant_approuve)}</span></p>
          </div>
        )}
        <div>
          <label className="mb-s-2 block text-small font-medium text-ink">Mode de paiement effectif</label>
          <div className="flex flex-wrap gap-s-2">
            {MODES.map(m => (
              <button key={m.value} onClick={() => setMode(m.value)}
                className={`rounded-full px-s-3 py-s-1.5 text-small font-medium border transition-colors ${
                  mode === m.value ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-s-3">
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">
              Référence {mode !== 'especes' && <span className="text-red-500">*</span>}
            </label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder={mode === 'wave' ? 'Réf. Wave…' : mode === 'orange_money' ? 'Réf. OM…' : 'N° virement…'}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Date effective</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            Confirmer le remboursement
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuellePaiementsPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [subTab, setSubTab] = useState<'a_payer' | 'historique' | 'tresorerie'>('a_payer')

  // À payer
  const [aPayer, setAPayer] = useState<DemandeAPayer[]>([])
  const [loadingAPayer, setLoadingAPayer] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [remboursementModal, setRemboursementModal] = useState<DemandeAPayer | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchModal, setBatchModal] = useState(false)
  const [batchMode, setBatchMode] = useState<ModeRemb>('virement')
  const [batchRef, setBatchRef] = useState('')
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0])

  // Historique
  const [mouvements, setMouvements] = useState<MouvementFinancier[]>([])
  const [loadingHisto, setLoadingHisto] = useState(false)
  const [filterPeriode, setFilterPeriode] = useState('3')
  const [filterType, setFilterType] = useState('all')
  const [searchHisto, setSearchHisto] = useState('')

  // Trésorerie
  const [tresoData, setTresoData] = useState<TresoData[]>([])
  const [loadingTreso, setLoadingTreso] = useState(false)
  const [previsionnel, setPrevisionnel] = useState<{ attendu: number; sorties: number; soldePrevu: number } | null>(null)
  const [soldeActuel, setSoldeActuel] = useState(0)
  const [reserveMois, setReserveMois] = useState(0)

  // Config
  const [config, setConfig] = useState<PaiementConfig>({ delai_cible_jours: 5, mode_defaut: 'wave', wave_auto: false })
  const [savingConfig, setSavingConfig] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadAPayer = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingAPayer(true)
    try {
      const { data } = await db
        .from('remboursement_demandes')
        .select(`
          id, numero_demande, statut, montant_approuve, montant_demande,
          date_approbation, updated_at,
          adherent_id,
          profiles!remboursement_demandes_adherent_id_fkey(full_name)
        `)
        .eq('mutuelle_id', mutuelle.id)
        .eq('statut', 'approuve')
        .order('date_approbation', { ascending: true })
        .limit(200)

      const now = new Date()
      const rows: DemandeAPayer[] = (data ?? []).map((d: any) => {
        const dateApp = d.date_approbation ? parseISO(d.date_approbation) : now
        const joursOuvr = differenceInBusinessDays(now, dateApp)
        return {
          id: d.id,
          numero_demande: d.numero_demande ?? '—',
          adherent_nom: d.profiles?.full_name ?? '—',
          adherent_tel: null,
          adherent_wave: null,
          montant_approuve: d.montant_approuve ?? d.montant_demande ?? 0,
          date_approbation: d.date_approbation ?? d.updated_at ?? now.toISOString(),
          jours_ouvrables: Math.max(0, joursOuvr),
          mode_prefere: null,
        }
      })
      setAPayer(rows)
    } finally { setLoadingAPayer(false) }
  }, [mutuelle?.id])

  const loadHistorique = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingHisto(true)
    try {
      const moisBack = parseInt(filterPeriode, 10)
      const since = subMonths(new Date(), moisBack).toISOString()

      // Cotisations reçues (ENTRANT)
      const { data: cots } = await db
        .from('cotisations')
        .select('id, created_at, montant, mode_paiement, reference_paiement, contrat_id')
        .eq('mutuelle_id', mutuelle.id)
        .eq('statut', 'paye')
        .gte('date_paiement', since)
        .order('date_paiement', { ascending: false })
        .limit(500)

      // Remboursements effectués (SORTANT)
      const { data: rembs } = await db
        .from('remboursement_demandes')
        .select('id, numero_demande, montant_approuve, date_remboursement, mode_remboursement, reference_remboursement')
        .eq('mutuelle_id', mutuelle.id)
        .eq('statut', 'rembourse')
        .gte('date_remboursement', since.split('T')[0])
        .order('date_remboursement', { ascending: false })
        .limit(500)

      // Règlements TP (SORTANT)
      const { data: tpRegl } = await db
        .from('tp_reglements')
        .select('id, date_reglement, montant, moyen_paiement, reference')
        .eq('mutuelle_id', mutuelle.id)
        .gte('date_reglement', since.split('T')[0])
        .order('date_reglement', { ascending: false })
        .limit(500)

      const rows: MouvementFinancier[] = [
        ...(cots ?? []).map((c: any) => ({
          id: c.id,
          date: c.created_at ?? '',
          type: 'entrant' as const,
          libelle: 'Cotisation',
          sous_type: 'cotisation',
          montant: c.montant ?? 0,
          mode: c.mode_paiement ?? null,
          reference: c.reference_paiement ?? null,
        })),
        ...(rembs ?? []).map((r: any) => ({
          id: r.id,
          date: r.date_remboursement ?? '',
          type: 'sortant' as const,
          libelle: `Remboursement ${r.numero_demande ?? ''}`,
          sous_type: 'remboursement',
          montant: r.montant_approuve ?? 0,
          mode: r.mode_remboursement ?? null,
          reference: r.reference_remboursement ?? null,
        })),
        ...(tpRegl ?? []).map((t: any) => ({
          id: t.id,
          date: t.date_reglement ?? '',
          type: 'sortant' as const,
          libelle: 'Règlement Tiers Payant',
          sous_type: 'tp',
          montant: t.montant ?? 0,
          mode: t.moyen_paiement ?? null,
          reference: t.reference ?? null,
        })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      setMouvements(rows)
    } finally { setLoadingHisto(false) }
  }, [mutuelle?.id, filterPeriode])

  const loadTresorerie = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingTreso(true)
    try {
      const data: TresoData[] = []
      let solde = 0

      for (let i = 11; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const debut = `${mois}-01`
        const finD = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const fin = `${mois}-${String(finD.getDate()).padStart(2, '0')}`

        const [{ data: cotsM }, { data: rembsM }, { data: tpM }] = await Promise.all([
          db.from('cotisations').select('montant').eq('mutuelle_id', mutuelle.id)
            .eq('statut', 'paye').gte('date_paiement', debut).lte('date_paiement', fin),
          db.from('remboursement_demandes').select('montant_approuve').eq('mutuelle_id', mutuelle.id)
            .eq('statut', 'rembourse').gte('date_remboursement', debut).lte('date_remboursement', fin),
          db.from('tp_reglements').select('montant').eq('mutuelle_id', mutuelle.id)
            .gte('date_reglement', debut).lte('date_reglement', fin),
        ])

        const entrees = (cotsM ?? []).reduce((s: number, c: any) => s + (c.montant ?? 0), 0)
        const sorties = (rembsM ?? []).reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)
          + (tpM ?? []).reduce((s: number, t: any) => s + (t.montant ?? 0), 0)
        solde += entrees - sorties
        data.push({ mois, entrees, sorties, solde })
      }

      setTresoData(data)
      setSoldeActuel(solde)

      // Cotisations attendues mois prochain
      const nextMonth = addMonths(new Date(), 1)
      const nm = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
      const { data: contrats } = await db.from('contrats').select('cotisation_mensuelle').eq('mutuelle_id', mutuelle.id).eq('statut', 'ACTIF')
      const attenduNext = (contrats ?? []).reduce((s: number, c: any) => s + (c.cotisation_mensuelle ?? 0), 0)

      // Remboursements en file (approuvés non remboursés)
      const { data: rembFile } = await db.from('remboursement_demandes').select('montant_approuve').eq('mutuelle_id', mutuelle.id).eq('statut', 'approuve')
      const sortiesNext = (rembFile ?? []).reduce((s: number, r: any) => s + (r.montant_approuve ?? 0), 0)

      setPrevisionnel({ attendu: attenduNext, sorties: sortiesNext, soldePrevu: solde + attenduNext - sortiesNext })

      // Réserve en nombre de mois de cotisations
      const cotMoyenne = data.slice(-3).reduce((s, d) => s + d.entrees, 0) / 3
      setReserveMois(cotMoyenne > 0 ? solde / cotMoyenne : 0)
    } finally { setLoadingTreso(false) }
  }, [mutuelle?.id])

  const loadConfig = useCallback(async () => {
    if (!mutuelle?.id) return
    const { data } = await db.from('mutuelles').select('paiement_config').eq('id', mutuelle.id).single()
    if (data?.paiement_config) setConfig(data.paiement_config)
  }, [mutuelle?.id])

  useEffect(() => {
    loadAPayer(); loadConfig()
  }, [loadAPayer, loadConfig])

  useEffect(() => {
    if (subTab === 'historique') loadHistorique()
    else if (subTab === 'tresorerie') loadTresorerie()
  }, [subTab, loadHistorique, loadTresorerie, filterPeriode])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleBatchRembourser() {
    if (selected.size === 0) return
    if (!batchRef.trim() && batchMode !== 'especes') { toast.error('Référence obligatoire'); return }
    setBatchLoading(true)
    try {
      const items = Array.from(selected).map(id => ({
        demandeId: id, modePaiement: batchMode,
        reference: batchRef.trim() || undefined, dateEffective: batchDate,
      }))
      const { error, data: resp } = await supabase.functions.invoke('record-remboursement-effectue', {
        body: items,
      })
      if (error) throw error
      const { nbSuccess, nbError } = resp as any
      if (nbError > 0) toast.warning(`${nbSuccess} remboursés, ${nbError} erreurs`)
      else toast.success(`${nbSuccess} remboursement(s) enregistrés — patients notifiés`)
      setSelected(new Set()); setBatchModal(false); loadAPayer()
    } catch { toast.error('Erreur batch remboursements') }
    finally { setBatchLoading(false) }
  }

  async function saveConfig() {
    if (!mutuelle?.id) return
    setSavingConfig(true)
    try {
      await db.from('mutuelles').update({ paiement_config: config }).eq('id', mutuelle.id)
      toast.success('Configuration sauvegardée')
    } catch { toast.error('Erreur sauvegarde') }
    finally { setSavingConfig(false) }
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    setSelected(s => s.size === aPayer.length ? new Set() : new Set(aPayer.map(d => d.id)))
  }

  // ── Filtres historique ────────────────────────────────────────────────────────

  const filteredMouvements = useMemo(() => {
    let rows = mouvements
    if (filterType !== 'all') rows = rows.filter(r => r.type === filterType)
    const q = searchHisto.toLowerCase()
    if (q) rows = rows.filter(r => r.libelle.toLowerCase().includes(q) || (r.reference ?? '').toLowerCase().includes(q))
    return rows
  }, [mouvements, filterType, searchHisto])

  const soldeNet = useMemo(() => {
    const entrees = filteredMouvements.filter(m => m.type === 'entrant').reduce((s, m) => s + m.montant, 0)
    const sorties = filteredMouvements.filter(m => m.type === 'sortant').reduce((s, m) => s + m.montant, 0)
    return { entrees, sorties, net: entrees - sorties }
  }, [filteredMouvements])

  function exportHistoriqueCSV() {
    const headers = ['Date', 'Type', 'Libellé', 'Montant FCFA', 'Mode', 'Référence']
    const lines = filteredMouvements.map(m => [
      m.date ? format(m.date.length > 10 ? parseISO(m.date) : new Date(m.date), 'dd/MM/yyyy') : '',
      m.type === 'entrant' ? 'ENTRANT' : 'SORTANT',
      m.libelle, m.montant, m.mode ?? '', m.reference ?? '',
    ].join(';'))
    const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `historique-paiements-${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'a_payer' as const, label: 'À rembourser', badge: aPayer.length },
    { id: 'historique' as const, label: 'Historique' },
    { id: 'tresorerie' as const, label: 'Trésorerie' },
  ]

  const retardCount = aPayer.filter(d => d.jours_ouvrables > config.delai_cible_jours).length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      <h1 className="font-display text-h1 font-semibold text-ink">Paiements & Remboursements</h1>

      {retardCount > 0 && (
        <div className="flex items-center gap-s-2 rounded-xl border border-amber-200 bg-amber-50 px-s-4 py-s-3 text-small text-amber-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>{retardCount} remboursement{retardCount > 1 ? 's' : ''}</strong> dépasse{retardCount === 1 ? '' : 'nt'} le délai cible de {config.delai_cible_jours} jours ouvrés.</span>
        </div>
      )}

      {/* Sous-onglets */}
      <div className="flex gap-s-1 overflow-x-auto border-b border-line">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex shrink-0 items-center gap-s-2 border-b-2 -mb-px px-s-4 py-s-2.5 text-small font-medium transition-colors ${
              subTab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'
            }`}>
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="rounded-full bg-red-100 px-s-1.5 py-s-0.5 text-micro font-bold text-red-700">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── À rembourser ─────────────────────────────────────────────────── */}
      {subTab === 'a_payer' && (
        <section>
          {/* Actions groupées */}
          <div className="mb-s-3 flex flex-wrap items-center gap-s-2">
            {selected.size > 0 && (
              <Button variant="primary" size="sm" leftIcon={<CheckCircle className="h-4 w-4" />}
                onClick={() => setBatchModal(true)}>
                Marquer {selected.size} comme remboursé{selected.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {loadingAPayer ? (
            <div className="space-y-s-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : aPayer.length === 0 ? (
            <EmptyState icon={<CheckCircle className="h-8 w-8" />} message="Aucun remboursement en attente" description="Toutes les demandes approuvées ont été versées." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    <th className="px-s-3 py-s-3 text-left">
                      <input type="checkbox" checked={selected.size === aPayer.length && aPayer.length > 0}
                        onChange={toggleAll} className="rounded border-line" />
                    </th>
                    {['N° demande', 'Adhérent', 'Montant', 'Date approbation', 'Délai', 'Mode préféré', 'Action'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {aPayer.map(d => {
                    const enRetard = d.jours_ouvrables > config.delai_cible_jours
                    return (
                      <tr key={d.id} className={`hover:bg-surface-2/50 ${enRetard ? 'bg-red-50/30' : ''}`}>
                        <td className="px-s-3 py-s-3">
                          <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} className="rounded border-line" />
                        </td>
                        <td className="px-s-3 py-s-3 font-mono text-micro text-ink-2">{d.numero_demande}</td>
                        <td className="px-s-3 py-s-3">
                          <p className="font-medium text-ink">{d.adherent_nom}</p>
                          {d.adherent_tel && <p className="text-micro text-ink-3">{d.adherent_tel}</p>}
                        </td>
                        <td className="px-s-3 py-s-3 font-semibold text-ink">{formatFCFA(d.montant_approuve)}</td>
                        <td className="px-s-3 py-s-3 text-micro text-ink-3">
                          {d.date_approbation ? format(parseISO(d.date_approbation), 'd MMM', { locale: fr }) : '—'}
                        </td>
                        <td className="px-s-3 py-s-3">
                          <span className={`font-semibold ${enRetard ? 'text-red-600' : 'text-ink'}`}>
                            {enRetard && <AlertTriangle className="inline h-3.5 w-3.5 mr-s-0.5" />}
                            J+{d.jours_ouvrables}
                          </span>
                        </td>
                        <td className="px-s-3 py-s-3 text-ink-3 capitalize">{d.mode_prefere ?? config.mode_defaut}</td>
                        <td className="px-s-3 py-s-3">
                          <Button variant="primary" size="sm" leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                            onClick={() => setRemboursementModal(d)}>
                            Rembourser
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Intégration Wave */}
          <div className="mt-s-6 rounded-xl border border-line bg-surface overflow-hidden">
            <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
              <p className="font-semibold text-ink">Intégrations & Configuration</p>
            </div>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between px-s-4 py-s-3">
                <div>
                  <p className="text-small font-medium text-ink">Remboursements Wave automatiques</p>
                  <p className="text-micro text-ink-3">Virement Wave déclenché automatiquement à l'approbation si numéro Wave disponible</p>
                </div>
                <button onClick={() => setConfig(c => ({ ...c, wave_auto: !c.wave_auto }))}>
                  {config.wave_auto ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-ink-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between px-s-4 py-s-3">
                <div>
                  <p className="text-small font-medium text-ink">Délai cible de remboursement</p>
                  <p className="text-micro text-ink-3">Alerte si dépassé (jours ouvrés)</p>
                </div>
                <div className="flex items-center gap-s-2">
                  <input type="number" min="1" max="30" value={config.delai_cible_jours}
                    onChange={e => setConfig(c => ({ ...c, delai_cible_jours: Number(e.target.value) }))}
                    className="w-16 rounded border border-line bg-surface px-s-2 py-s-1 text-small text-center text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                  <span className="text-micro text-ink-3">j. ouvrés</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-s-4 py-s-3">
                <div>
                  <p className="text-small font-medium text-ink">Mode par défaut si non renseigné</p>
                </div>
                <div className="flex gap-s-1">
                  {MODES.map(m => (
                    <button key={m.value} onClick={() => setConfig(c => ({ ...c, mode_defaut: m.value }))}
                      className={`rounded-full px-s-3 py-s-1 text-micro font-medium ${config.mode_defaut === m.value ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-s-4 py-s-3 flex justify-end">
                <Button variant="secondary" size="sm" loading={savingConfig} onClick={saveConfig} leftIcon={<CheckCircle className="h-4 w-4" />}>
                  Sauvegarder
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Historique ─────────────────────────────────────────────────────── */}
      {subTab === 'historique' && (
        <section>
          {/* Solde net */}
          <div className="mb-s-4 grid grid-cols-3 gap-s-3">
            <div className="rounded-xl border border-line bg-surface p-s-3">
              <div className="flex items-center gap-s-2">
                <ArrowUpCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-micro text-ink-3">Entrées</p>
              </div>
              <p className="mt-s-1 font-bold text-emerald-600">{formatFCFA(soldeNet.entrees)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-s-3">
              <div className="flex items-center gap-s-2">
                <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-micro text-ink-3">Sorties</p>
              </div>
              <p className="mt-s-1 font-bold text-red-500">{formatFCFA(soldeNet.sorties)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-s-3">
              <div className="flex items-center gap-s-2">
                <CreditCard className="h-5 w-5 text-primary shrink-0" />
                <p className="text-micro text-ink-3">Solde net période</p>
              </div>
              <p className={`mt-s-1 font-bold ${soldeNet.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatFCFA(soldeNet.net)}</p>
            </div>
          </div>

          <div className="mb-s-3 flex flex-wrap items-center gap-s-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input value={searchHisto} onChange={e => setSearchHisto(e.target.value)} placeholder="Libellé, référence…"
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-s-1">
              {[{ v: '1', l: '1 mois' }, { v: '3', l: '3 mois' }, { v: '6', l: '6 mois' }, { v: '12', l: '1 an' }].map(f => (
                <button key={f.v} onClick={() => setFilterPeriode(f.v)}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium ${filterPeriode === f.v ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex gap-s-1">
              {[{ v: 'all', l: 'Tous' }, { v: 'entrant', l: '↑ Entrant' }, { v: 'sortant', l: '↓ Sortant' }].map(f => (
                <button key={f.v} onClick={() => setFilterType(f.v)}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium ${filterType === f.v ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportHistoriqueCSV}>
              CSV
            </Button>
          </div>

          {loadingHisto ? (
            <div className="space-y-s-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : filteredMouvements.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-8 w-8" />} message="Aucun mouvement" description="Ajustez la période ou les filtres." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['Date', 'Type', 'Libellé', 'Montant', 'Mode', 'Référence'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredMouvements.map(m => (
                    <tr key={m.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-3 text-micro text-ink-3 whitespace-nowrap">
                        {m.date ? format(m.date.length > 10 ? parseISO(m.date) : new Date(m.date + 'T00:00'), 'd MMM yyyy', { locale: fr }) : '—'}
                      </td>
                      <td className="px-s-3 py-s-3">
                        {m.type === 'entrant'
                          ? <span className="flex items-center gap-s-1 text-emerald-600 font-medium"><ArrowUpCircle className="h-4 w-4" /> ENTRANT</span>
                          : <span className="flex items-center gap-s-1 text-red-500 font-medium"><ArrowDownCircle className="h-4 w-4" /> SORTANT</span>}
                      </td>
                      <td className="px-s-3 py-s-3 text-ink">{m.libelle}</td>
                      <td className={`px-s-3 py-s-3 font-semibold ${m.type === 'entrant' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.type === 'entrant' ? '+' : '-'}{formatFCFA(m.montant)}
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3 capitalize">{m.mode ?? '—'}</td>
                      <td className="px-s-3 py-s-3 font-mono text-micro text-ink-3">{m.reference ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Trésorerie ─────────────────────────────────────────────────────── */}
      {subTab === 'tresorerie' && (
        <section className="space-y-s-6">
          {loadingTreso ? (
            <div className="h-64 rounded-xl bg-surface-2 animate-pulse" />
          ) : (
            <>
              {/* Indicateurs */}
              <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="text-micro text-ink-3">Solde actuel (12 mois)</p>
                  <p className={`mt-s-1 text-h2 font-bold ${soldeActuel >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatFCFA(soldeActuel)}</p>
                </div>
                <div className={`rounded-xl border p-s-4 ${reserveMois < 2 ? 'border-red-200 bg-red-50' : 'border-line bg-surface'}`}>
                  <p className="text-micro text-ink-3">Réserve</p>
                  <p className={`mt-s-1 text-h2 font-bold ${reserveMois < 2 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {reserveMois.toFixed(1)} mois
                  </p>
                  {reserveMois < 2 && <p className="text-micro text-red-600 mt-s-1">Réserve insuffisante (&lt; 2 mois)</p>}
                </div>
                {previsionnel && (
                  <div className="rounded-xl border border-line bg-surface p-s-4">
                    <p className="text-micro text-ink-3">Prévisionnel mois suivant</p>
                    <p className={`mt-s-1 text-h2 font-bold ${previsionnel.soldePrevu >= soldeActuel ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatFCFA(previsionnel.soldePrevu)}
                    </p>
                    <p className="text-micro text-ink-3 mt-s-1">
                      +{formatFCFA(previsionnel.attendu)} / -{formatFCFA(previsionnel.sorties)}
                    </p>
                  </div>
                )}
              </div>

              {/* Graphes */}
              <div className="rounded-xl border border-line bg-surface p-s-4">
                <p className="mb-s-4 font-semibold text-ink">Entrées vs Sorties — 12 mois</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={tresoData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis dataKey="mois" tickFormatter={moisLabel} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                    <YAxis tickFormatter={v => new Intl.NumberFormat('fr-SN', { notation: 'compact' }).format(v)} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                    <Tooltip formatter={(v: any, name: string) => [formatFCFA(Number(v)), name]} />
                    <Legend />
                    <Bar dataKey="entrees" name="Entrées (cot.)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sorties" name="Sorties (remb.+TP)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-line bg-surface p-s-4">
                <p className="mb-s-4 font-semibold text-ink">Solde cumulé</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={tresoData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis dataKey="mois" tickFormatter={moisLabel} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                    <YAxis tickFormatter={v => new Intl.NumberFormat('fr-SN', { notation: 'compact' }).format(v)} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                    <Tooltip formatter={(v: any) => [formatFCFA(Number(v)), 'Solde cumulé']} />
                    <Line type="monotone" dataKey="solde" name="Solde" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Prévisionnel détaillé */}
              {previsionnel && (
                <div className="rounded-xl border border-line bg-surface overflow-hidden">
                  <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
                    <p className="font-semibold text-ink">Prévisionnel mois prochain</p>
                  </div>
                  <div className="divide-y divide-line">
                    <div className="flex items-center justify-between px-s-4 py-s-3 text-small">
                      <span className="text-ink-3">Cotisations attendues</span>
                      <span className="font-semibold text-emerald-600">+{formatFCFA(previsionnel.attendu)}</span>
                    </div>
                    <div className="flex items-center justify-between px-s-4 py-s-3 text-small">
                      <span className="text-ink-3">Remboursements en file</span>
                      <span className="font-semibold text-red-500">-{formatFCFA(previsionnel.sorties)}</span>
                    </div>
                    <div className="flex items-center justify-between px-s-4 py-s-3 text-small">
                      <span className="font-semibold text-ink">Solde estimé fin de mois</span>
                      <span className={`font-bold ${previsionnel.soldePrevu >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatFCFA(previsionnel.soldePrevu)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <RemboursementModal
        open={!!remboursementModal}
        onOpenChange={v => { if (!v) setRemboursementModal(null) }}
        demande={remboursementModal}
        onDone={() => { setRemboursementModal(null); loadAPayer() }}
      />

      {/* Batch modal */}
      <Modal open={batchModal} onOpenChange={setBatchModal} title={`Rembourser ${selected.size} demande${selected.size > 1 ? 's' : ''}`} size="sm">
        <div className="space-y-s-4">
          <p className="text-small text-ink-3">Mode et référence appliqués à toutes les demandes sélectionnées.</p>
          <div>
            <label className="mb-s-2 block text-small font-medium text-ink">Mode de paiement</label>
            <div className="flex flex-wrap gap-s-2">
              {MODES.map(m => (
                <button key={m.value} onClick={() => setBatchMode(m.value)}
                  className={`rounded-full px-s-3 py-s-1.5 text-small font-medium border transition-colors ${
                    batchMode === m.value ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-s-3">
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">
                Référence {batchMode !== 'especes' && <span className="text-red-500">*</span>}
              </label>
              <input type="text" value={batchRef} onChange={e => setBatchRef(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Date</label>
              <input type="date" value={batchDate} onChange={e => setBatchDate(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setBatchModal(false)}>Annuler</Button>
            <Button variant="primary" loading={batchLoading} onClick={handleBatchRembourser}
              leftIcon={<CheckCircle className="h-4 w-4" />}>
              Confirmer {selected.size} remboursement{selected.size > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
