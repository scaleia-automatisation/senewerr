import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO, differenceInDays, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, AlertTriangle, Search, Download,
  Stethoscope, Pill, CreditCard, ToggleLeft, ToggleRight,
  RefreshCw, Send, Filter, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type TpStatut = 'pending' | 'approved' | 'refused' | 'regle'
type TpType = 'pharmacie' | 'praticien'

interface TpDemande {
  id: string
  numero_tp: string
  type: TpType
  prestataire_nom: string
  prestataire_id: string
  adherent_nom: string
  adherent_id: string
  numero_contrat: string
  contrat_id: string
  contrat_statut: string
  montant_total: number
  montant_mutuelle: number
  reste_a_charge: number
  statut: TpStatut
  motif_refus: string | null
  created_at: string
  traite_at: string | null
  jours_retard_cot: number
}

interface Prestataire {
  type: TpType
  id: string
  nom: string
  nb_tp: number
  montant_total: number
  montant_regle: number
  solde: number
}

interface TpStats {
  byMonth: { mois: string; nb: number; montant: number }[]
  byType: { name: string; value: number; color: string }[]
  top5: { nom: string; montant: number }[]
  tauxValidation: number
}

interface TpRules {
  bloquer_si_retard: boolean
  seuil_retard_jours: number
  confirmation_gros_montant: boolean
  seuil_confirmation_montant: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function moisLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-SN', { month: 'short', year: '2-digit' })
}

const STATUT_CFG: Record<TpStatut, { label: string; color: string }> = {
  pending:  { label: 'En attente',  color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Validée',     color: 'bg-emerald-100 text-emerald-700' },
  refused:  { label: 'Refusée',     color: 'bg-red-100 text-red-700' },
  regle:    { label: 'Réglée',      color: 'bg-sky-100 text-sky-700' },
}

// ── Modal refus ───────────────────────────────────────────────────────────────

function RefusModal({ open, onOpenChange, demande, onDone }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  demande: TpDemande | null
  onDone: () => void
}) {
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (!open) setMotif('') }, [open])

  async function handleSubmit() {
    if (!motif.trim()) { toast.error('Le motif est obligatoire'); return }
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('refuse-tiers-payant', {
        body: { demandeId: demande?.id, motif },
      })
      if (error) throw error
      toast.success('Demande refusée — patient et prestataire notifiés')
      onOpenChange(false); onDone()
    } catch { toast.error('Erreur lors du refus') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Refuser la demande TP" size="sm">
      <div className="space-y-s-3">
        {demande && (
          <div className="rounded-lg bg-surface-2 p-s-3 text-small">
            <p className="font-medium text-ink">{demande.adherent_nom} — {demande.prestataire_nom}</p>
            <p className="font-mono text-micro text-ink-3">{demande.numero_tp} — {formatFCFA(demande.montant_mutuelle)}</p>
          </div>
        )}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Motif de refus *</label>
          <textarea
            value={motif}
            onChange={e => setMotif(e.target.value)}
            rows={3}
            placeholder="Expliquez le motif du refus…"
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<XCircle className="h-4 w-4" />}>
            Refuser
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Modal règlement ───────────────────────────────────────────────────────────

function ReglementModal({ open, onOpenChange, prestataire, onDone }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  prestataire: Prestataire | null
  onDone: () => void
}) {
  const [montant, setMontant] = useState('')
  const [moyen, setMoyen] = useState<'wave' | 'virement' | 'especes'>('virement')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !prestataire) return
    setMontant(String(prestataire.solde))
    setMoyen('virement'); setReference(''); setNote('')
    setDate(new Date().toISOString().split('T')[0])
  }, [open, prestataire])

  async function handleSubmit() {
    if (!montant || Number(montant) <= 0) { toast.error('Montant invalide'); return }
    if (!prestataire) return
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('record-tp-settlement', {
        body: {
          prestataire_type: prestataire.type,
          prestataire_id: prestataire.id,
          montant: Number(montant),
          moyen_paiement: moyen,
          reference: reference.trim() || undefined,
          date_reglement: date,
          note: note.trim() || undefined,
        },
      })
      if (error) throw error
      toast.success('Règlement enregistré — prestataire notifié')
      onOpenChange(false); onDone()
    } catch { toast.error('Erreur enregistrement règlement') }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Enregistrer un règlement" size="md">
      <div className="space-y-s-4">
        {prestataire && (
          <div className="rounded-lg bg-surface-2 p-s-3 text-small">
            <p className="font-medium text-ink">{prestataire.nom}</p>
            <p className="text-micro text-ink-3">
              {prestataire.nb_tp} demande{prestataire.nb_tp !== 1 ? 's' : ''} validée{prestataire.nb_tp !== 1 ? 's' : ''}
              — Solde à régler : <span className="font-semibold text-ink">{formatFCFA(prestataire.solde)}</span>
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-s-3">
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Montant (FCFA) *</label>
            <input type="number" min="1" value={montant} onChange={e => setMontant(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Date règlement</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div>
          <label className="mb-s-2 block text-small font-medium text-ink">Moyen de paiement</label>
          <div className="flex gap-s-2">
            {(['virement', 'wave', 'especes'] as const).map(m => (
              <button key={m} onClick={() => setMoyen(m)}
                className={`rounded-full px-s-3 py-s-1.5 text-small font-medium border transition-colors ${
                  moyen === m ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-ink hover:bg-surface-2'
                }`}>
                {m === 'virement' ? 'Virement' : m === 'wave' ? 'Wave' : 'Espèces'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Référence (optionnel)</label>
          <input type="text" value={reference} onChange={e => setReference(e.target.value)}
            placeholder="N° virement, réf. Wave…"
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Note interne (optionnel)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit} leftIcon={<CheckCircle className="h-4 w-4" />}>
            Enregistrer le règlement
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleTiersPayantPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [subTab, setSubTab] = useState<'a_valider' | 'historique' | 'reglements' | 'stats'>('a_valider')

  // Demandes pending
  const [pending, setPending] = useState<TpDemande[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [confirmValidate, setConfirmValidate] = useState<TpDemande | null>(null)
  const [loadingValidate, setLoadingValidate] = useState(false)
  const [refusModal, setRefusModal] = useState<TpDemande | null>(null)

  // Historique
  const [filterType, setFilterType] = useState('all')
  const [filterStatut, setFilterStatut] = useState('all')
  const [searchHisto, setSearchHisto] = useState('')

  // Règlements
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [loadingRegl, setLoadingRegl] = useState(false)
  const [reglementModal, setReglementModal] = useState<Prestataire | null>(null)

  // Stats
  const [stats, setStats] = useState<TpStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Règles TP
  const [tpRules, setTpRules] = useState<TpRules>({
    bloquer_si_retard: true,
    seuil_retard_jours: 30,
    confirmation_gros_montant: true,
    seuil_confirmation_montant: 50000,
  })
  const [savingRules, setSavingRules] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadDemandes = useCallback(async (statutFilter?: string) => {
    if (!mutuelle?.id) return
    setLoadingPending(true)
    try {
      const query = db
        .from('tiers_payant_demandes')
        .select(`
          id, numero_tp, type, statut, montant_total, montant_mutuelle, reste_a_charge,
          created_at, traite_at, motif_refus,
          adherent_id, contrat_id,
          pharmacie_id, praticien_id,
          profiles!tiers_payant_demandes_adherent_id_fkey(full_name),
          contrats!tiers_payant_demandes_contrat_id_fkey(numero_contrat, statut)
        `)
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (statutFilter) query.eq('statut', statutFilter)

      const { data } = await query

      // Enrichir avec nom prestataire + jours retard cotisation
      const rows: TpDemande[] = await Promise.all((data ?? []).map(async (d: any) => {
        let prestataire_nom = '—'
        const prestataire_id = d.pharmacie_id ?? d.praticien_id ?? ''
        if (d.type === 'pharmacie' && d.pharmacie_id) {
          const { data: ph } = await db.from('pharmacies').select('nom').eq('id', d.pharmacie_id).single()
          prestataire_nom = ph?.nom ?? '—'
        } else if (d.type === 'praticien' && d.praticien_id) {
          const { data: pr } = await db.from('praticiens').select('nom').eq('id', d.praticien_id).single()
          prestataire_nom = pr?.nom ?? '—'
        }

        // Calcul retard cotisation
        let jours = 0
        const now = new Date()
        const moisC = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const { data: cot } = await db.from('cotisations')
          .select('mois')
          .eq('contrat_id', d.contrat_id)
          .lt('mois', moisC)
          .neq('statut', 'paye')
          .order('mois', { ascending: true })
          .limit(1)
          .single()
        if (cot) {
          const [y, m] = cot.mois.split('-').map(Number)
          jours = Math.max(0, Math.floor((now.getTime() - new Date(y, m - 1, 5).getTime()) / 86400000))
        }

        return {
          id: d.id,
          numero_tp: d.numero_tp ?? '—',
          type: d.type,
          prestataire_nom,
          prestataire_id,
          adherent_nom: d.profiles?.full_name ?? '—',
          adherent_id: d.adherent_id,
          numero_contrat: d.contrats?.numero_contrat ?? '—',
          contrat_id: d.contrat_id,
          contrat_statut: d.contrats?.statut ?? '—',
          montant_total: d.montant_total ?? 0,
          montant_mutuelle: d.montant_mutuelle ?? 0,
          reste_a_charge: d.reste_a_charge ?? 0,
          statut: d.statut,
          motif_refus: d.motif_refus ?? null,
          created_at: d.created_at,
          traite_at: d.traite_at ?? null,
          jours_retard_cot: jours,
        }
      }))
      setPending(rows)
    } finally { setLoadingPending(false) }
  }, [mutuelle?.id])

  const loadReglements = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingRegl(true)
    try {
      // Demandes approuvées groupées par prestataire
      const { data: approved } = await db
        .from('tiers_payant_demandes')
        .select('type, pharmacie_id, praticien_id, montant_mutuelle')
        .eq('mutuelle_id', mutuelle.id)
        .in('statut', ['approved'])

      // Règlements déjà effectués
      const { data: reglData } = await db
        .from('tp_reglements')
        .select('prestataire_type, prestataire_id, montant')
        .eq('mutuelle_id', mutuelle.id)

      const reglByPrest: Record<string, number> = {}
      for (const r of (reglData ?? [])) {
        const k = `${r.prestataire_type}-${r.prestataire_id}`
        reglByPrest[k] = (reglByPrest[k] ?? 0) + (r.montant ?? 0)
      }

      const prestMap: Record<string, { type: TpType; id: string; nb: number; montant: number }> = {}
      for (const d of (approved ?? [])) {
        const id = d.pharmacie_id ?? d.praticien_id
        const key = `${d.type}-${id}`
        prestMap[key] = {
          type: d.type, id,
          nb: (prestMap[key]?.nb ?? 0) + 1,
          montant: (prestMap[key]?.montant ?? 0) + (d.montant_mutuelle ?? 0),
        }
      }

      const result: Prestataire[] = await Promise.all(
        Object.entries(prestMap).map(async ([, p]) => {
          const tbl = p.type === 'pharmacie' ? 'pharmacies' : 'praticiens'
          const { data: tgt } = await db.from(tbl).select('nom').eq('id', p.id).single()
          const regle = reglByPrest[`${p.type}-${p.id}`] ?? 0
          return {
            type: p.type, id: p.id,
            nom: tgt?.nom ?? '—',
            nb_tp: p.nb,
            montant_total: p.montant,
            montant_regle: regle,
            solde: p.montant - regle,
          }
        })
      )
      setPrestataires(result.filter(p => p.solde > 0).sort((a, b) => b.solde - a.solde))
    } finally { setLoadingRegl(false) }
  }, [mutuelle?.id])

  const loadStats = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingStats(true)
    try {
      const { data: all } = await db
        .from('tiers_payant_demandes')
        .select('type, statut, montant_mutuelle, created_at, pharmacie_id, praticien_id')
        .eq('mutuelle_id', mutuelle.id)
        .gte('created_at', subMonths(new Date(), 12).toISOString())

      // Par mois
      const moisMap: Record<string, { nb: number; montant: number }> = {}
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        moisMap[k] = { nb: 0, montant: 0 }
      }
      for (const d of (all ?? [])) {
        const k = d.created_at?.slice(0, 7)
        if (moisMap[k]) { moisMap[k].nb++; moisMap[k].montant += d.montant_mutuelle ?? 0 }
      }
      const byMonth = Object.entries(moisMap).map(([mois, v]) => ({ mois, ...v }))

      // Par type
      const nbPharma = (all ?? []).filter((d: any) => d.type === 'pharmacie').length
      const nbPrat = (all ?? []).filter((d: any) => d.type === 'praticien').length
      const byType = [
        { name: 'Pharmacies', value: nbPharma, color: '#10b981' },
        { name: 'Praticiens', value: nbPrat, color: '#6366f1' },
      ]

      // Top 5 prestataires
      const prestMontants: Record<string, { nom: string; montant: number }> = {}
      for (const d of (all ?? [])) {
        const id = d.pharmacie_id ?? d.praticien_id
        if (!id) continue
        if (!prestMontants[id]) prestMontants[id] = { nom: id, montant: 0 }
        prestMontants[id].montant += d.montant_mutuelle ?? 0
      }
      const top5 = Object.values(prestMontants).sort((a, b) => b.montant - a.montant).slice(0, 5)

      // Taux validation
      const total = (all ?? []).length
      const valide = (all ?? []).filter((d: any) => ['approved', 'regle'].includes(d.statut)).length
      const tauxValidation = total > 0 ? Math.round((valide / total) * 100) : 0

      setStats({ byMonth, byType, top5, tauxValidation })
    } finally { setLoadingStats(false) }
  }, [mutuelle?.id])

  const loadTpRules = useCallback(async () => {
    if (!mutuelle?.id) return
    const { data } = await db.from('mutuelles').select('tp_rules').eq('id', mutuelle.id).single()
    if (data?.tp_rules) setTpRules(data.tp_rules)
  }, [mutuelle?.id])

  useEffect(() => {
    loadDemandes()
    loadTpRules()
  }, [loadDemandes, loadTpRules])

  useEffect(() => {
    if (subTab === 'reglements') loadReglements()
    else if (subTab === 'stats') loadStats()
  }, [subTab, loadReglements, loadStats])

  // Realtime sur tiers_payant_demandes INSERT
  useEffect(() => {
    if (!mutuelle?.id) return
    const ch = supabase.channel('tp-' + mutuelle.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tiers_payant_demandes', filter: `mutuelle_id=eq.${mutuelle.id}` },
        () => { loadDemandes(); toast.info('Nouvelle demande tiers payant reçue') })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [mutuelle?.id, loadDemandes])

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleValidate(demande: TpDemande) {
    setLoadingValidate(true)
    try {
      const { error } = await supabase.functions.invoke('validate-tiers-payant', {
        body: { demandeId: demande.id },
      })
      if (error) throw error
      toast.success('Tiers payant validé — prestataire notifié')
      setConfirmValidate(null)
      loadDemandes()
    } catch (e: any) {
      const msg = e?.message ?? 'Erreur'
      if (msg.includes('suspendu') || msg.includes('INELIGIBLE')) {
        toast.error('Adhérent suspendu — validation impossible')
      } else {
        toast.error('Erreur : ' + msg)
      }
    } finally { setLoadingValidate(false) }
  }

  async function saveRules() {
    if (!mutuelle?.id) return
    setSavingRules(true)
    try {
      await db.from('mutuelles').update({ tp_rules: tpRules }).eq('id', mutuelle.id)
      toast.success('Règles sauvegardées')
    } catch { toast.error('Erreur sauvegarde') }
    finally { setSavingRules(false) }
  }

  function exportHistoriqueCSV() {
    const rows = filteredHisto
    const headers = ['N° TP', 'Type', 'Prestataire', 'Adhérent', 'N° Contrat', 'Date', 'Montant mutuelle', 'Statut', 'Motif refus']
    const lines = rows.map(r => [
      r.numero_tp, r.type, r.prestataire_nom, r.adherent_nom, r.numero_contrat,
      format(parseISO(r.created_at), 'dd/MM/yyyy'),
      r.montant_mutuelle,
      STATUT_CFG[r.statut]?.label ?? r.statut,
      r.motif_refus ?? '',
    ].join(';'))
    const csv = '﻿' + [headers.join(';'), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `tiers-payant-${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
  }

  // ── Filtres historique ────────────────────────────────────────────────────────

  const filteredHisto = useMemo(() => {
    let rows = pending
    if (filterType !== 'all') rows = rows.filter(r => r.type === filterType)
    if (filterStatut !== 'all') rows = rows.filter(r => r.statut === filterStatut)
    const q = searchHisto.toLowerCase()
    if (q) rows = rows.filter(r =>
      r.adherent_nom.toLowerCase().includes(q) ||
      r.prestataire_nom.toLowerCase().includes(q) ||
      r.numero_tp.toLowerCase().includes(q)
    )
    return rows
  }, [pending, filterType, filterStatut, searchHisto])

  const pendingOnly = useMemo(() => pending.filter(r => r.statut === 'pending'), [pending])

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'a_valider' as const, label: 'À valider', badge: pendingOnly.length },
    { id: 'historique' as const, label: 'Historique' },
    { id: 'reglements' as const, label: 'Règlements' },
    { id: 'stats' as const, label: 'Statistiques' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      <h1 className="font-display text-h1 font-semibold text-ink">Tiers Payant</h1>

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

      {/* ─── À valider ──────────────────────────────────────────────────────── */}
      {subTab === 'a_valider' && (
        <section>
          {loadingPending ? (
            <div className="space-y-s-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : pendingOnly.length === 0 ? (
            <EmptyState icon={<CheckCircle className="h-8 w-8" />} message="Aucune demande en attente" description="Les nouvelles demandes tiers payant apparaissent ici en temps réel." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['N° TP', 'Type', 'Prestataire', 'Adhérent', 'Date', 'Montant mutuelle', 'Cot. adhérent', 'Actions'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pendingOnly.map(d => {
                    const isSuspendu = d.contrat_statut === 'SUSPENDU'
                    const cotRetard = d.jours_retard_cot > 0
                    return (
                      <tr key={d.id} className={`hover:bg-surface-2/50 ${isSuspendu ? 'bg-red-50/30' : ''}`}>
                        <td className="px-s-3 py-s-3 font-mono text-micro text-ink-2">{d.numero_tp}</td>
                        <td className="px-s-3 py-s-3">
                          <div className="flex items-center gap-s-1">
                            {d.type === 'pharmacie'
                              ? <Pill className="h-4 w-4 text-emerald-600" />
                              : <Stethoscope className="h-4 w-4 text-primary" />}
                            <span className="text-ink-3 capitalize">{d.type}</span>
                          </div>
                        </td>
                        <td className="px-s-3 py-s-3 font-medium text-ink">{d.prestataire_nom}</td>
                        <td className="px-s-3 py-s-3">
                          <p className="font-medium text-ink">{d.adherent_nom}</p>
                          <p className="font-mono text-micro text-ink-3">{d.numero_contrat}</p>
                          {isSuspendu && (
                            <span className="inline-block rounded-full bg-red-100 px-s-1.5 py-s-0.5 text-micro font-semibold text-red-700">Suspendu</span>
                          )}
                        </td>
                        <td className="px-s-3 py-s-3 text-ink-3 text-micro">
                          {format(parseISO(d.created_at), 'd MMM', { locale: fr })}
                        </td>
                        <td className="px-s-3 py-s-3 font-semibold text-ink">{formatFCFA(d.montant_mutuelle)}</td>
                        <td className="px-s-3 py-s-3">
                          {cotRetard ? (
                            <div className="group relative">
                              <span className="flex items-center gap-s-1 rounded-full bg-amber-100 px-s-2 py-s-0.5 text-micro font-semibold text-amber-700 cursor-help">
                                <AlertTriangle className="h-3 w-3" /> En retard
                              </span>
                              <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-s-1 hidden w-48 rounded-lg border border-line bg-surface p-s-2 text-micro text-ink shadow-lg group-hover:block">
                                Cotisation en retard de {d.jours_retard_cot}j. Vérifiez avant validation.
                              </div>
                            </div>
                          ) : (
                            <span className="flex items-center gap-s-1 rounded-full bg-emerald-100 px-s-2 py-s-0.5 text-micro font-semibold text-emerald-700">
                              <CheckCircle className="h-3 w-3" /> À jour
                            </span>
                          )}
                        </td>
                        <td className="px-s-3 py-s-3">
                          <div className="flex gap-s-1">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isSuspendu}
                              leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                              onClick={() => setConfirmValidate(d)}
                            >
                              Valider
                            </Button>
                            <Button variant="ghost" size="sm" leftIcon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => setRefusModal(d)}>
                              Refuser
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Règles d'éligibilité */}
          <div className="mt-s-6 rounded-xl border border-line bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-surface-2 px-s-4 py-s-3">
              <p className="font-semibold text-ink">Règles d'éligibilité automatiques</p>
              <Button variant="secondary" size="sm" loading={savingRules} onClick={saveRules} leftIcon={<CheckCircle className="h-4 w-4" />}>
                Sauvegarder
              </Button>
            </div>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between px-s-4 py-s-3">
                <div>
                  <p className="text-small font-medium text-ink">Bloquer TP si cotisation en retard</p>
                  <div className="flex items-center gap-s-2 mt-s-1">
                    <span className="text-micro text-ink-3">Seuil :</span>
                    <input type="number" min="1" value={tpRules.seuil_retard_jours}
                      onChange={e => setTpRules(r => ({ ...r, seuil_retard_jours: Number(e.target.value) }))}
                      className="w-16 rounded border border-line bg-surface px-s-2 py-s-0.5 text-micro text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-micro text-ink-3">jours</span>
                  </div>
                </div>
                <button onClick={() => setTpRules(r => ({ ...r, bloquer_si_retard: !r.bloquer_si_retard }))}>
                  {tpRules.bloquer_si_retard ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-ink-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between px-s-4 py-s-3">
                <div>
                  <p className="text-small font-medium text-ink">Confirmation manuelle si montant élevé</p>
                  <div className="flex items-center gap-s-2 mt-s-1">
                    <span className="text-micro text-ink-3">Au-dessus de :</span>
                    <input type="number" min="1000" step="1000" value={tpRules.seuil_confirmation_montant}
                      onChange={e => setTpRules(r => ({ ...r, seuil_confirmation_montant: Number(e.target.value) }))}
                      className="w-24 rounded border border-line bg-surface px-s-2 py-s-0.5 text-micro text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-micro text-ink-3">FCFA</span>
                  </div>
                </div>
                <button onClick={() => setTpRules(r => ({ ...r, confirmation_gros_montant: !r.confirmation_gros_montant }))}>
                  {tpRules.confirmation_gros_montant ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-ink-3" />}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Historique ─────────────────────────────────────────────────────── */}
      {subTab === 'historique' && (
        <section>
          <div className="mb-s-3 flex flex-wrap items-center gap-s-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input value={searchHisto} onChange={e => setSearchHisto(e.target.value)}
                placeholder="Adhérent, prestataire, N° TP…"
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-s-1">
              {[{ v: 'all', l: 'Tous' }, { v: 'pharmacie', l: 'Pharmacie' }, { v: 'praticien', l: 'Praticien' }].map(f => (
                <button key={f.v} onClick={() => setFilterType(f.v)}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium ${filterType === f.v ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <div className="flex gap-s-1">
              {[{ v: 'all', l: 'Tous' }, { v: 'pending', l: 'Attente' }, { v: 'approved', l: 'Validée' }, { v: 'refused', l: 'Refusée' }, { v: 'regle', l: 'Réglée' }].map(f => (
                <button key={f.v} onClick={() => setFilterStatut(f.v)}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium ${filterStatut === f.v ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'}`}>
                  {f.l}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportHistoriqueCSV}>
              Exporter CSV
            </Button>
          </div>
          {filteredHisto.length === 0 ? (
            <EmptyState icon={<Eye className="h-8 w-8" />} message="Aucun résultat" description="Ajustez les filtres." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['N° TP', 'Type', 'Prestataire', 'Adhérent', 'Date', 'Montant mutuelle', 'Statut'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredHisto.map(d => (
                    <tr key={d.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-3 font-mono text-micro text-ink-2">{d.numero_tp}</td>
                      <td className="px-s-3 py-s-3">
                        <div className="flex items-center gap-s-1">
                          {d.type === 'pharmacie' ? <Pill className="h-4 w-4 text-emerald-600" /> : <Stethoscope className="h-4 w-4 text-primary" />}
                          <span className="text-ink-3 capitalize">{d.type}</span>
                        </div>
                      </td>
                      <td className="px-s-3 py-s-3 font-medium text-ink">{d.prestataire_nom}</td>
                      <td className="px-s-3 py-s-3">
                        <p className="font-medium text-ink">{d.adherent_nom}</p>
                        <p className="font-mono text-micro text-ink-3">{d.numero_contrat}</p>
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3 text-micro">{format(parseISO(d.created_at), 'd MMM yyyy', { locale: fr })}</td>
                      <td className="px-s-3 py-s-3 font-semibold text-ink">{formatFCFA(d.montant_mutuelle)}</td>
                      <td className="px-s-3 py-s-3">
                        <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${STATUT_CFG[d.statut]?.color ?? ''}`}>
                          {STATUT_CFG[d.statut]?.label ?? d.statut}
                        </span>
                        {d.motif_refus && <p className="text-micro text-ink-3 mt-s-0.5 truncate max-w-[120px]">{d.motif_refus}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Règlements ─────────────────────────────────────────────────────── */}
      {subTab === 'reglements' && (
        <section>
          {loadingRegl ? (
            <div className="space-y-s-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : prestataires.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-8 w-8" />} message="Aucun règlement en attente" description="Les montants à régler aux prestataires apparaissent ici après validation des demandes TP." />
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['Prestataire', 'Type', 'Demandes TP', 'Montant total', 'Déjà réglé', 'Solde restant', 'Action'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {prestataires.map(p => (
                    <tr key={p.id} className="hover:bg-surface-2/50">
                      <td className="px-s-3 py-s-3 font-medium text-ink">{p.nom}</td>
                      <td className="px-s-3 py-s-3">
                        <div className="flex items-center gap-s-1">
                          {p.type === 'pharmacie' ? <Pill className="h-4 w-4 text-emerald-600" /> : <Stethoscope className="h-4 w-4 text-primary" />}
                          <span className="text-ink-3 capitalize">{p.type}</span>
                        </div>
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3">{p.nb_tp}</td>
                      <td className="px-s-3 py-s-3 font-semibold text-ink">{formatFCFA(p.montant_total)}</td>
                      <td className="px-s-3 py-s-3 text-emerald-600">{formatFCFA(p.montant_regle)}</td>
                      <td className="px-s-3 py-s-3">
                        <span className="font-bold text-amber-600">{formatFCFA(p.solde)}</span>
                      </td>
                      <td className="px-s-3 py-s-3">
                        <Button variant="primary" size="sm" leftIcon={<Send className="h-3.5 w-3.5" />}
                          onClick={() => setReglementModal(p)}>
                          Régler
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ─── Statistiques ───────────────────────────────────────────────────── */}
      {subTab === 'stats' && (
        <section className="space-y-s-6">
          {loadingStats ? (
            <div className="h-64 rounded-xl bg-surface-2 animate-pulse" />
          ) : stats ? (
            <>
              {/* Taux validation */}
              <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="text-micro text-ink-3">Taux de validation</p>
                  <p className="mt-s-1 text-h2 font-bold text-emerald-600">{stats.tauxValidation}%</p>
                  <div className="mt-s-2 h-1.5 rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${stats.tauxValidation}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="text-micro text-ink-3">Total demandes (12 mois)</p>
                  <p className="mt-s-1 text-h2 font-bold text-ink">{stats.byMonth.reduce((a, b) => a + b.nb, 0)}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="text-micro text-ink-3">Volume total (12 mois)</p>
                  <p className="mt-s-1 text-h2 font-bold text-primary">{formatFCFA(stats.byMonth.reduce((a, b) => a + b.montant, 0))}</p>
                </div>
              </div>

              <div className="grid gap-s-4 lg:grid-cols-2">
                {/* BarChart volume par mois */}
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="mb-s-4 font-semibold text-ink">Volume TP par mois</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.byMonth} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                      <XAxis dataKey="mois" tickFormatter={moisLabel} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={v => new Intl.NumberFormat('fr-SN', { notation: 'compact' }).format(v)} tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }} />
                      <Tooltip formatter={(v: any, name: string) => name === 'Montant' ? formatFCFA(Number(v)) : v} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="nb" name="Nb demandes" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="montant" name="Montant" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* PieChart répartition */}
                <div className="rounded-xl border border-line bg-surface p-s-4">
                  <p className="mb-s-4 font-semibold text-ink">Répartition par type</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.byType}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} ${Math.round(percent * 100)}%`}
                        labelLine={false}
                      >
                        {stats.byType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Demandes']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 prestataires */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
                  <p className="font-semibold text-ink">Top 5 prestataires par volume TP (trimestre)</p>
                </div>
                <div className="divide-y divide-line">
                  {stats.top5.length === 0 ? (
                    <p className="p-s-4 text-small text-ink-3">Aucun prestataire ce trimestre</p>
                  ) : stats.top5.map((p, i) => (
                    <div key={p.nom} className="flex items-center gap-s-3 px-s-4 py-s-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-micro font-bold text-primary">{i + 1}</span>
                      <p className="flex-1 text-small font-medium text-ink truncate">{p.nom}</p>
                      <span className="font-semibold text-ink">{formatFCFA(p.montant)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!confirmValidate}
        onOpenChange={v => { if (!v) setConfirmValidate(null) }}
        title="Valider le tiers payant"
        message={confirmValidate
          ? `Valider la demande ${confirmValidate.numero_tp} de ${confirmValidate.adherent_nom} auprès de ${confirmValidate.prestataire_nom} pour ${formatFCFA(confirmValidate.montant_mutuelle)} ? Le prestataire sera notifié.`
          : ''
        }
        confirmLabel="Valider"
        variant="primary"
        loading={loadingValidate}
        onConfirm={() => confirmValidate && handleValidate(confirmValidate)}
      />

      <RefusModal
        open={!!refusModal}
        onOpenChange={v => { if (!v) setRefusModal(null) }}
        demande={refusModal}
        onDone={() => loadDemandes()}
      />

      <ReglementModal
        open={!!reglementModal}
        onOpenChange={v => { if (!v) setReglementModal(null) }}
        prestataire={reglementModal}
        onDone={loadReglements}
      />
    </div>
  )
}
