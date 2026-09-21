import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  differenceInDays, parseISO, format, startOfWeek, startOfMonth,
  startOfDay, endOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Upload, Edit2, PackagePlus, PackageMinus,
  Skull, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Download,
  X, Loader2, Package, BarChart3, ChevronRight, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string
  medicament_id: string | null
  nom: string
  dci: string | null
  forme: string | null
  dosage: string | null
  quantite: number
  seuil_alerte: number
  prix_unitaire_vente: number | null
  prix_achat: number | null
  date_peremption: string | null
  lot_numero: string | null
  fournisseur_id: string | null
}

interface Mouvement {
  id: string
  medicament_id: string
  type: 'entree' | 'sortie' | 'ajustement' | 'peremption'
  quantite: number
  motif: string | null
  reference_dispensation_id: string | null
  reference_commande_id: string | null
  pharmacien_id: string | null
  created_at: string
  medicament_nom?: string
  pharmacien_nom?: string
}

interface CatalogueItem {
  id: string
  nom_commercial: string
  dci: string | null
  forme: string | null
  dosage: string | null
  categorie: string | null
  prix_reference: number | null
  remboursable_ss: boolean
}

type SortCol = keyof Pick<StockItem, 'nom' | 'dci' | 'forme' | 'quantite' | 'seuil_alerte' | 'prix_unitaire_vente' | 'date_peremption' | 'lot_numero'>
type FilterType = 'all' | 'alerte' | 'rupture' | 'peremption'
type TabType = 'stock' | 'mouvements' | 'rapports'
type MvtType = '' | 'entree' | 'sortie' | 'ajustement' | 'peremption'
type MvtPeriod = 'week' | 'month' | 'trimestre' | 'custom'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIM_DAYS = 30

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
}

function rowStyle(item: StockItem): string {
  if (item.quantite === 0) return 'border-l-4 border-l-red-500 bg-red-500/5'
  if (item.quantite <= item.seuil_alerte) return 'border-l-4 border-l-amber-500 bg-amber-500/5'
  if (item.date_peremption) {
    const days = differenceInDays(parseISO(item.date_peremption), new Date())
    if (days >= 0 && days < PERIM_DAYS) return 'border-l-4 border-l-yellow-500 bg-yellow-500/5'
  }
  return 'border-l-4 border-l-transparent'
}

function mvtTypeLabel(t: string) {
  const m: Record<string, string> = {
    entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement', peremption: 'Périmé',
  }
  return m[t] ?? t
}

function mvtTypeBadge(t: string) {
  const classes: Record<string, string> = {
    entree: 'bg-green-100 text-green-700',
    sortie: 'bg-blue-100 text-blue-700',
    ajustement: 'bg-purple-100 text-purple-700',
    peremption: 'bg-red-100 text-red-700',
  }
  return classes[t] ?? 'bg-ink/10 text-ink'
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].replace(/^﻿/, '').split(';').map(h => h.trim().toLowerCase().replace(/"/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function getPeriodBounds(period: MvtPeriod, custom: { start: string; end: string }) {
  const now = new Date()
  if (period === 'week') return { start: startOfDay(startOfWeek(now, { weekStartsOn: 1 })).toISOString(), end: endOfDay(now).toISOString() }
  if (period === 'month') return { start: startOfDay(startOfMonth(now)).toISOString(), end: endOfDay(now).toISOString() }
  if (period === 'trimestre') {
    const s = new Date(now); s.setMonth(s.getMonth() - 3)
    return { start: startOfDay(s).toISOString(), end: endOfDay(now).toISOString() }
  }
  return { start: custom.start, end: custom.end }
}

// ─── Drawer component ──────────────────────────────────────────────────────────

function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--ink)_40%,transparent)]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between border-b border-line px-s-6 py-s-4">
              <h2 className="font-semibold text-ink text-large">{title}</h2>
              <button onClick={onClose} className="rounded p-s-1 hover:bg-surface-2">
                <X className="h-5 w-5 text-ink-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-s-6 py-s-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PharmacyStockPage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<TabType>('stock')

  // ── Stock state ─────────────────────────────────────────────────────────────
  const [stock, setStock] = useState<StockItem[]>([])
  const [loadingStock, setLoadingStock] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortCol, setSortCol] = useState<SortCol>('nom')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [entreeItem, setEntreeItem] = useState<StockItem | null>(null)
  const [entreeQty, setEntreeQty] = useState('')
  const [entreeLot, setEntreeLot] = useState('')
  const [entreeMotif, setEntreeMotif] = useState('')
  const [savingEntree, setSavingEntree] = useState(false)

  const [sortieItem, setSortieItem] = useState<StockItem | null>(null)
  const [sortieQty, setSortieQty] = useState('')
  const [sortieMotif, setSortieMotif] = useState('')
  const [savingSortie, setSavingSortie] = useState(false)

  const [perimItem, setPerimItem] = useState<StockItem | null>(null)
  const [savingPerim, setSavingPerim] = useState(false)

  // ── Edit drawer ────────────────────────────────────────────────────────────
  const [editItem, setEditItem] = useState<StockItem | null>(null)
  const [editPrixVente, setEditPrixVente] = useState('')
  const [editPrixAchat, setEditPrixAchat] = useState('')
  const [editSeuil, setEditSeuil] = useState('')
  const [editPeremption, setEditPeremption] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Add drawer ─────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState<CatalogueItem[]>([])
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogueItem | null>(null)
  const [addNom, setAddNom] = useState('')
  const [addDci, setAddDci] = useState('')
  const [addForme, setAddForme] = useState('')
  const [addDosage, setAddDosage] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addPrixVente, setAddPrixVente] = useState('')
  const [addPrixAchat, setAddPrixAchat] = useState('')
  const [addSeuil, setAddSeuil] = useState('5')
  const [addLot, setAddLot] = useState('')
  const [addPeremption, setAddPeremption] = useState('')
  const [addAdminNote, setAddAdminNote] = useState(false)
  const [savingAdd, setSavingAdd] = useState(false)

  // ── CSV import ─────────────────────────────────────────────────────────────
  const [showCsv, setShowCsv] = useState(false)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [csvError, setCsvError] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Mouvements state ───────────────────────────────────────────────────────
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [loadingMvt, setLoadingMvt] = useState(false)
  const [mvtPeriod, setMvtPeriod] = useState<MvtPeriod>('month')
  const [mvtCustom, setMvtCustom] = useState({ start: '', end: '' })
  const [mvtType, setMvtType] = useState<MvtType>('')
  const [mvtSearch, setMvtSearch] = useState('')

  // ── Rapports state ─────────────────────────────────────────────────────────
  const [topMeds, setTopMeds] = useState<{ nom: string; total: number }[]>([])
  const [dormant, setDormant] = useState<StockItem[]>([])
  const [loadingRapports, setLoadingRapports] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH STOCK
  // ─────────────────────────────────────────────────────────────────────────────

  const loadStock = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingStock(true)
    const { data, error } = await db
      .from('stock_medicaments')
      .select('id, medicament_id, nom, dci, forme, dosage, quantite, seuil_alerte, prix_unitaire_vente, prix_achat, date_peremption, lot_numero, fournisseur_id')
      .eq('pharmacie_id', pharmacie.id)
      .is('deleted_at', null)
      .order('nom')
      .limit(1000)
    if (error) { toast.error('Erreur de chargement du stock.'); setLoadingStock(false); return }
    setStock(data ?? [])
    setLoadingStock(false)
  }, [pharmacie?.id])

  useEffect(() => { loadStock() }, [loadStock])

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH MOUVEMENTS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadMouvements = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingMvt(true)
    const bounds = getPeriodBounds(mvtPeriod, mvtCustom)
    const query = db
      .from('mouvements_stock')
      .select('id, medicament_id, type, quantite, motif, reference_dispensation_id, reference_commande_id, pharmacien_id, created_at')
      .eq('pharmacie_id', pharmacie.id)
      .gte('created_at', bounds.start)
      .lte('created_at', bounds.end)
      .order('created_at', { ascending: false })
      .limit(500)
    if (mvtType) query.eq('type', mvtType)

    const { data: mvtData, error } = await query
    if (error) { toast.error('Erreur de chargement.'); setLoadingMvt(false); return }

    // Build stock name map
    const stockMap = new Map(stock.map(s => [s.id, s.nom]))
    // Fetch pharmacien names for unique pharmacien_ids
    const phIds = [...new Set((mvtData ?? []).map((m: any) => m.pharmacien_id).filter(Boolean))]
    let phMap = new Map<string, string>()
    if (phIds.length) {
      const { data: phData } = await db.from('profiles').select('id, full_name').in('id', phIds)
      phMap = new Map((phData ?? []).map((p: any) => [p.id, p.full_name]))
    }

    setMouvements((mvtData ?? []).map((m: any) => ({
      ...m,
      medicament_nom: stockMap.get(m.medicament_id) ?? m.medicament_id?.slice(0, 8),
      pharmacien_nom: m.pharmacien_id ? (phMap.get(m.pharmacien_id) ?? '—') : 'Auto',
    })))
    setLoadingMvt(false)
  }, [pharmacie?.id, mvtPeriod, mvtCustom, mvtType, stock])

  useEffect(() => {
    if (tab === 'mouvements') loadMouvements()
  }, [tab, loadMouvements])

  // ─────────────────────────────────────────────────────────────────────────────
  // FETCH RAPPORTS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadRapports = useCallback(async () => {
    if (!pharmacie?.id || !stock.length) return
    setLoadingRapports(true)
    const now = new Date()
    const monthStart = startOfDay(startOfMonth(now)).toISOString()
    const ago90 = new Date(now); ago90.setDate(ago90.getDate() - 90)

    // Top meds: sorties last 30 days
    const { data: sortiesData } = await db
      .from('mouvements_stock')
      .select('medicament_id, quantite')
      .eq('pharmacie_id', pharmacie.id)
      .eq('type', 'sortie')
      .gte('created_at', monthStart)

    const topMap = new Map<string, number>()
    ;(sortiesData ?? []).forEach((s: any) => {
      topMap.set(s.medicament_id, (topMap.get(s.medicament_id) ?? 0) + (s.quantite ?? 0))
    })
    const stockMap = new Map(stock.map(s => [s.id, s.nom]))
    const top = Array.from(topMap.entries())
      .map(([id, total]) => ({ nom: stockMap.get(id) ?? id.slice(0, 8), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    setTopMeds(top)

    // Dormant: stock with no movement in 90 days
    const { data: recentIds } = await db
      .from('mouvements_stock')
      .select('medicament_id')
      .eq('pharmacie_id', pharmacie.id)
      .gte('created_at', ago90.toISOString())
    const activeIds = new Set((recentIds ?? []).map((r: any) => r.medicament_id))
    setDormant(stock.filter(s => s.quantite > 0 && !activeIds.has(s.id)))

    setLoadingRapports(false)
  }, [pharmacie?.id, stock])

  useEffect(() => {
    if (tab === 'rapports') loadRapports()
  }, [tab, loadRapports])

  // ─────────────────────────────────────────────────────────────────────────────
  // CATALOG SEARCH (debounced)
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (catalogSearch.length < 2) { setCatalogResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await db
        .from('medicaments_catalogue')
        .select('id, nom_commercial, dci, forme, dosage, categorie, prix_reference, remboursable_ss')
        .or(`nom_commercial.ilike.%${catalogSearch}%,dci.ilike.%${catalogSearch}%`)
        .limit(10)
      setCatalogResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [catalogSearch])

  function selectCatalogItem(item: CatalogueItem) {
    setSelectedCatalog(item)
    setAddNom(item.nom_commercial)
    setAddDci(item.dci ?? '')
    setAddForme(item.forme ?? '')
    setAddDosage(item.dosage ?? '')
    setAddPrixVente(item.prix_reference ? String(item.prix_reference) : '')
    setCatalogSearch(item.nom_commercial)
    setCatalogResults([])
    setAddAdminNote(false)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTERED + SORTED STOCK
  // ─────────────────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = stock
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.nom.toLowerCase().includes(q) ||
        (s.dci?.toLowerCase().includes(q) ?? false) ||
        (s.forme?.toLowerCase().includes(q) ?? false)
      )
    }
    if (filter === 'rupture') list = list.filter(s => s.quantite === 0)
    else if (filter === 'alerte') list = list.filter(s => s.quantite > 0 && s.quantite <= s.seuil_alerte)
    else if (filter === 'peremption') list = list.filter(s => {
      if (!s.date_peremption) return false
      const d = differenceInDays(parseISO(s.date_peremption), new Date())
      return d >= 0 && d < PERIM_DAYS
    })
    return [...list].sort((a, b) => {
      const va: any = a[sortCol] ?? ''
      const vb: any = b[sortCol] ?? ''
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [stock, search, filter, sortCol, sortDir])

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async function confirmEntree() {
    if (!entreeItem || !pharmacie?.id) return
    const qty = parseInt(entreeQty)
    if (!qty || qty <= 0) { toast.error('Quantité invalide.'); return }
    setSavingEntree(true)
    const { error: mvtErr } = await db.from('mouvements_stock').insert({
      pharmacie_id: pharmacie.id,
      medicament_id: entreeItem.id,
      type: 'entree',
      quantite: qty,
      motif: entreeMotif || null,
      pharmacien_id: profile?.id,
    })
    if (mvtErr) { toast.error('Erreur lors du mouvement.'); setSavingEntree(false); return }
    const { error: updErr } = await db.from('stock_medicaments')
      .update({ quantite: entreeItem.quantite + qty, ...(entreeLot ? { lot_numero: entreeLot } : {}) })
      .eq('id', entreeItem.id)
    if (updErr) { toast.error('Erreur mise à jour stock.'); setSavingEntree(false); return }
    toast.success(`Entrée de ${qty} unités enregistrée.`)
    setSavingEntree(false)
    setEntreeItem(null); setEntreeQty(''); setEntreeLot(''); setEntreeMotif('')
    loadStock()
  }

  async function confirmSortie() {
    if (!sortieItem || !pharmacie?.id) return
    const qty = parseInt(sortieQty)
    if (!qty || qty <= 0) { toast.error('Quantité invalide.'); return }
    if (qty > sortieItem.quantite) { toast.error('Quantité supérieure au stock disponible.'); return }
    if (!sortieMotif.trim()) { toast.error('Motif requis pour une sortie manuelle.'); return }
    setSavingSortie(true)
    const { error: mvtErr } = await db.from('mouvements_stock').insert({
      pharmacie_id: pharmacie.id,
      medicament_id: sortieItem.id,
      type: 'sortie',
      quantite: qty,
      motif: sortieMotif,
      pharmacien_id: profile?.id,
    })
    if (mvtErr) { toast.error('Erreur lors du mouvement.'); setSavingSortie(false); return }
    await db.from('stock_medicaments').update({ quantite: sortieItem.quantite - qty }).eq('id', sortieItem.id)
    toast.success(`Sortie de ${qty} unités enregistrée.`)
    setSavingSortie(false)
    setSortieItem(null); setSortieQty(''); setSortieMotif('')
    loadStock()
  }

  async function confirmPerim() {
    if (!perimItem || !pharmacie?.id) return
    setSavingPerim(true)
    const { error: mvtErr } = await db.from('mouvements_stock').insert({
      pharmacie_id: pharmacie.id,
      medicament_id: perimItem.id,
      type: 'peremption',
      quantite: perimItem.quantite,
      motif: 'Médicament périmé',
      pharmacien_id: profile?.id,
    })
    if (mvtErr) { toast.error('Erreur lors du mouvement.'); setSavingPerim(false); return }
    await db.from('stock_medicaments').update({ quantite: 0 }).eq('id', perimItem.id)
    toast.success('Médicament marqué périmé — stock mis à zéro.')
    setSavingPerim(false); setPerimItem(null)
    loadStock()
  }

  async function saveEdit() {
    if (!editItem) return
    setSavingEdit(true)
    const updates: Record<string, any> = {}
    if (editPrixVente) updates.prix_unitaire_vente = parseFloat(editPrixVente)
    if (editPrixAchat) updates.prix_achat = parseFloat(editPrixAchat)
    if (editSeuil) updates.seuil_alerte = parseInt(editSeuil)
    if (editPeremption) updates.date_peremption = editPeremption
    await db.from('stock_medicaments').update(updates).eq('id', editItem.id)
    toast.success('Fiche médicament mise à jour.')
    setSavingEdit(false); setEditItem(null)
    loadStock()
  }

  function openEdit(item: StockItem) {
    setEditItem(item)
    setEditPrixVente(item.prix_unitaire_vente ? String(item.prix_unitaire_vente) : '')
    setEditPrixAchat(item.prix_achat ? String(item.prix_achat) : '')
    setEditSeuil(String(item.seuil_alerte))
    setEditPeremption(item.date_peremption ? item.date_peremption.split('T')[0] : '')
  }

  async function saveAdd() {
    if (!pharmacie?.id || !addNom.trim()) { toast.error('Nom du médicament requis.'); return }
    const qty = parseInt(addQty) || 0
    setSavingAdd(true)
    const { data: inserted, error } = await db.from('stock_medicaments').insert({
      pharmacie_id: pharmacie.id,
      medicament_id: selectedCatalog?.id ?? null,
      nom: addNom.trim(),
      dci: addDci.trim() || null,
      forme: addForme.trim() || null,
      dosage: addDosage.trim() || null,
      quantite: qty,
      seuil_alerte: parseInt(addSeuil) || 5,
      prix_unitaire_vente: addPrixVente ? parseFloat(addPrixVente) : null,
      prix_achat: addPrixAchat ? parseFloat(addPrixAchat) : null,
      lot_numero: addLot.trim() || null,
      date_peremption: addPeremption || null,
    }).select('id').single()
    if (error) { toast.error('Erreur lors de l\'ajout.'); setSavingAdd(false); return }
    if (qty > 0) {
      await db.from('mouvements_stock').insert({
        pharmacie_id: pharmacie.id,
        medicament_id: inserted.id,
        type: 'entree',
        quantite: qty,
        motif: addAdminNote ? 'Nouveau médicament (validation admin en attente)' : 'Stock initial',
        pharmacien_id: profile?.id,
      })
    }
    toast.success(`${addNom} ajouté au stock.`)
    setSavingAdd(false); setShowAdd(false)
    resetAddForm(); loadStock()
  }

  function resetAddForm() {
    setCatalogSearch(''); setSelectedCatalog(null); setCatalogResults([])
    setAddNom(''); setAddDci(''); setAddForme(''); setAddDosage('')
    setAddQty(''); setAddPrixVente(''); setAddPrixAchat(''); setAddSeuil('5')
    setAddLot(''); setAddPeremption(''); setAddAdminNote(false)
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (!rows.length) { setCsvError('Fichier vide ou format invalide.'); return }
      const required = ['nom']
      const missing = required.filter(k => !Object.keys(rows[0]).includes(k))
      if (missing.length) { setCsvError(`Colonnes manquantes : ${missing.join(', ')}`); return }
      setCsvRows(rows)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function confirmCsvImport() {
    if (!pharmacie?.id || !csvRows.length) return
    setImportingCsv(true)
    let ok = 0
    for (const row of csvRows) {
      const qty = parseInt(row.quantite ?? '0') || 0
      const { data: ins, error } = await db.from('stock_medicaments').insert({
        pharmacie_id: pharmacie.id,
        medicament_id: null,
        nom: row.nom,
        dci: row.dci || null,
        forme: row.forme || null,
        dosage: row.dosage || null,
        quantite: qty,
        seuil_alerte: parseInt(row.seuil_alerte ?? '5') || 5,
        prix_unitaire_vente: row.prix_unitaire_vente ? parseFloat(row.prix_unitaire_vente) : null,
        prix_achat: row.prix_achat ? parseFloat(row.prix_achat) : null,
        lot_numero: row.lot_numero || null,
        date_peremption: row.date_peremption || null,
      }).select('id').single()
      if (!error && ins && qty > 0) {
        await db.from('mouvements_stock').insert({
          pharmacie_id: pharmacie.id, medicament_id: ins.id,
          type: 'entree', quantite: qty, motif: 'Import CSV', pharmacien_id: profile?.id,
        })
        ok++
      }
    }
    toast.success(`${ok} médicament(s) importé(s).`)
    setImportingCsv(false); setShowCsv(false); setCsvRows([])
    if (fileRef.current) fileRef.current.value = ''
    loadStock()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPORTS
  // ─────────────────────────────────────────────────────────────────────────────

  function exportMvtCSV() {
    const rows = filteredMvt
    const bom = '﻿'
    const header = 'Date;Médicament;Type;Quantité;Motif;Réf. dispensation;Agent\n'
    const body = rows.map(m =>
      [
        format(parseISO(m.created_at), 'dd/MM/yyyy HH:mm', { locale: fr }),
        `"${m.medicament_nom ?? ''}"`,
        mvtTypeLabel(m.type),
        m.quantite,
        `"${m.motif ?? ''}"`,
        m.reference_dispensation_id?.slice(0, 8) ?? '',
        `"${m.pharmacien_nom ?? ''}"`,
      ].join(';')
    ).join('\n')
    const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mouvements_stock_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MOUVEMENTS FILTERED
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredMvt = useMemo(() => {
    if (!mvtSearch.trim()) return mouvements
    const q = mvtSearch.toLowerCase()
    return mouvements.filter(m => m.medicament_nom?.toLowerCase().includes(q) ?? false)
  }, [mouvements, mvtSearch])

  // ─────────────────────────────────────────────────────────────────────────────
  // RAPPORTS CALCULÉS
  // ─────────────────────────────────────────────────────────────────────────────

  const rapportValues = useMemo(() => {
    const valAchat = stock.reduce((s, i) => s + (i.quantite * (i.prix_achat ?? 0)), 0)
    const valVente = stock.reduce((s, i) => s + (i.quantite * (i.prix_unitaire_vente ?? 0)), 0)
    return { valAchat, valVente }
  }, [stock])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER helpers
  // ─────────────────────────────────────────────────────────────────────────────

  function SortTh({ col, label }: { col: SortCol; label: string }) {
    const active = sortCol === col
    return (
      <th
        onClick={() => handleSort(col)}
        className="cursor-pointer select-none whitespace-nowrap px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3 hover:text-ink"
      >
        <span className="inline-flex items-center gap-s-1">
          {label}
          {active
            ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </span>
      </th>
    )
  }

  function FilterChip({ value, label, count }: { value: FilterType; label: string; count?: number }) {
    const isActive = filter === value
    return (
      <button
        onClick={() => setFilter(value)}
        className={`rounded-full px-s-3 py-s-1 text-small transition-colors ${isActive ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-2 hover:bg-surface-2'}`}
      >
        {label}
        {count != null && count > 0 && <span className="ml-s-1 font-bold">{count}</span>}
      </button>
    )
  }

  const alerteCount = stock.filter(s => s.quantite > 0 && s.quantite <= s.seuil_alerte).length
  const ruptureCount = stock.filter(s => s.quantite === 0).length
  const peremCount = stock.filter(s => {
    if (!s.date_peremption) return false
    const d = differenceInDays(parseISO(s.date_peremption), new Date())
    return d >= 0 && d < PERIM_DAYS
  }).length

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Stock tab
  // ─────────────────────────────────────────────────────────────────────────────

  function renderStockTab() {
    return (
      <>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-s-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom commercial, DCI, forme…"
              className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadStock}>
            Actualiser
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => setShowCsv(true)}>
            Importer CSV
          </Button>
          <Button size="sm" variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { resetAddForm(); setShowAdd(true) }}>
            Ajouter un médicament
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-s-2">
          <FilterChip value="all" label="Tous" />
          <FilterChip value="alerte" label="⚠ En alerte" count={alerteCount} />
          <FilterChip value="rupture" label="🔴 Rupture" count={ruptureCount} />
          <FilterChip value="peremption" label="⏳ Péremption proche" count={peremCount} />
        </div>

        {/* Table */}
        {loadingStock ? (
          <div className="flex flex-col gap-s-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
            <Package className="h-10 w-10 opacity-30" />
            <p className="text-small">
              {search || filter !== 'all' ? 'Aucun médicament trouvé.' : 'Stock vide. Ajoutez votre premier médicament.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[900px] text-small">
              <thead className="bg-surface-2">
                <tr>
                  <SortTh col="nom" label="Médicament" />
                  <SortTh col="dci" label="DCI" />
                  <SortTh col="forme" label="Forme/Dosage" />
                  <SortTh col="lot_numero" label="Lot" />
                  <SortTh col="quantite" label="Qté" />
                  <SortTh col="seuil_alerte" label="Seuil" />
                  <SortTh col="prix_unitaire_vente" label="Prix vente" />
                  <SortTh col="date_peremption" label="Péremption" />
                  <th className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(item => {
                  const daysLeft = item.date_peremption
                    ? differenceInDays(parseISO(item.date_peremption), new Date())
                    : null
                  return (
                    <tr key={item.id} className={`${rowStyle(item)} hover:bg-surface-2/50`}>
                      <td className="px-s-3 py-s-2 font-medium text-ink">{item.nom}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{item.dci ?? '—'}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{[item.forme, item.dosage].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="px-s-3 py-s-2 text-ink-3 font-mono text-micro">{item.lot_numero ?? '—'}</td>
                      <td className={`px-s-3 py-s-2 font-bold ${item.quantite === 0 ? 'text-red-600' : item.quantite <= item.seuil_alerte ? 'text-amber-600' : 'text-ink'}`}>
                        {item.quantite}
                      </td>
                      <td className="px-s-3 py-s-2 text-ink-3">{item.seuil_alerte}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">
                        {item.prix_unitaire_vente != null ? formatFCFA(item.prix_unitaire_vente) : '—'}
                      </td>
                      <td className={`px-s-3 py-s-2 ${daysLeft != null && daysLeft < PERIM_DAYS && daysLeft >= 0 ? 'text-yellow-700 font-semibold' : daysLeft != null && daysLeft < 0 ? 'text-red-600 font-semibold' : 'text-ink-2'}`}>
                        {item.date_peremption
                          ? format(parseISO(item.date_peremption), 'dd/MM/yyyy')
                          : '—'}
                      </td>
                      <td className="px-s-3 py-s-2">
                        <div className="flex items-center gap-s-1">
                          <button onClick={() => openEdit(item)} title="Modifier"
                            className="rounded p-s-1 hover:bg-surface-2 text-ink-3 hover:text-ink">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { setEntreeItem(item); setEntreeQty(''); setEntreeLot(item.lot_numero ?? ''); setEntreeMotif('') }} title="Entrée stock"
                            className="rounded p-s-1 hover:bg-surface-2 text-green-600">
                            <PackagePlus className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { setSortieItem(item); setSortieQty(''); setSortieMotif('') }} title="Sortie manuelle"
                            className="rounded p-s-1 hover:bg-surface-2 text-blue-600">
                            <PackageMinus className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setPerimItem(item)} title="Périmé" disabled={item.quantite === 0}
                            className="rounded p-s-1 hover:bg-surface-2 text-red-500 disabled:opacity-30">
                            <Skull className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-micro text-ink-3">{filtered.length} médicament(s) affiché(s) sur {stock.length}</p>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Mouvements tab
  // ─────────────────────────────────────────────────────────────────────────────

  function renderMouvementsTab() {
    return (
      <>
        <div className="flex flex-wrap items-center gap-s-3">
          {/* Period */}
          {(['week', 'month', 'trimestre', 'custom'] as MvtPeriod[]).map(p => (
            <button key={p} onClick={() => setMvtPeriod(p)}
              className={`rounded-full px-s-3 py-s-1 text-small transition-colors ${mvtPeriod === p ? 'bg-primary text-white' : 'border border-line text-ink-2 hover:bg-surface-2'}`}>
              {p === 'week' ? 'Cette semaine' : p === 'month' ? 'Ce mois' : p === 'trimestre' ? '3 mois' : 'Personnalisé'}
            </button>
          ))}
          {/* Type */}
          <select value={mvtType} onChange={e => setMvtType(e.target.value as MvtType)}
            className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tous les types</option>
            <option value="entree">Entrée</option>
            <option value="sortie">Sortie</option>
            <option value="ajustement">Ajustement</option>
            <option value="peremption">Périmé</option>
          </select>
          <div className="relative">
            <Search className="absolute left-s-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input type="text" value={mvtSearch} onChange={e => setMvtSearch(e.target.value)}
              placeholder="Médicament…"
              className="rounded border border-line bg-surface py-s-1.5 pl-s-7 pr-s-3 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary w-40"
            />
          </div>
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadMouvements}>
            Charger
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={exportMvtCSV}>
            Exporter CSV
          </Button>
        </div>

        {mvtPeriod === 'custom' && (
          <div className="flex items-center gap-s-3">
            <input type="date" value={mvtCustom.start} onChange={e => setMvtCustom(c => ({ ...c, start: e.target.value }))}
              className="rounded border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            <span className="text-ink-3">→</span>
            <input type="date" value={mvtCustom.end} onChange={e => setMvtCustom(c => ({ ...c, end: e.target.value }))}
              className="rounded border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        )}

        {loadingMvt ? (
          <div className="flex flex-col gap-s-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
        ) : filteredMvt.length === 0 ? (
          <p className="py-s-8 text-center text-small text-ink-3">Aucun mouvement pour cette période.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[700px] text-small">
              <thead className="bg-surface-2">
                <tr>
                  {['Date', 'Médicament', 'Type', 'Quantité', 'Motif', 'Réf.', 'Agent'].map(h => (
                    <th key={h} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredMvt.map(m => (
                  <tr key={m.id} className="hover:bg-surface-2/50">
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 font-medium text-ink">{m.medicament_nom}</td>
                    <td className="px-s-3 py-s-2">
                      <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${mvtTypeBadge(m.type)}`}>
                        {mvtTypeLabel(m.type)}
                      </span>
                    </td>
                    <td className={`px-s-3 py-s-2 font-bold ${m.type === 'entree' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.type === 'entree' ? '+' : '-'}{m.quantite}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-2 max-w-[200px] truncate">{m.motif ?? '—'}</td>
                    <td className="px-s-3 py-s-2 text-ink-3 font-mono text-micro">
                      {m.reference_dispensation_id?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-2">{m.pharmacien_nom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-micro text-ink-3">{filteredMvt.length} mouvement(s)</p>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Rapports tab
  // ─────────────────────────────────────────────────────────────────────────────

  function renderRapportsTab() {
    return (
      <>
        <div className="grid grid-cols-2 gap-s-4 sm:grid-cols-4">
          {[
            { label: 'Valeur stock (achat)', value: formatFCFA(rapportValues.valAchat), icon: <BarChart3 className="h-5 w-5 text-primary" /> },
            { label: 'Valeur stock (vente)', value: formatFCFA(rapportValues.valVente), icon: <BarChart3 className="h-5 w-5 text-green-600" /> },
            { label: 'Références actives', value: String(stock.filter(s => s.quantite > 0).length), icon: <Package className="h-5 w-5 text-ink-3" /> },
            { label: 'En rupture', value: String(ruptureCount), icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border border-line bg-surface p-s-4">
              <div className="flex items-center gap-s-2 mb-s-1">{kpi.icon}<p className="text-micro text-ink-3">{kpi.label}</p></div>
              <p className="font-bold text-ink text-large">{kpi.value}</p>
            </div>
          ))}
        </div>

        {loadingRapports && <div className="flex items-center gap-s-2 text-small text-ink-3"><Loader2 className="h-4 w-4 animate-spin" />Calcul en cours…</div>}

        {/* Top meds */}
        {!loadingRapports && (
          <>
            <div className="rounded-lg border border-line bg-surface">
              <div className="border-b border-line px-s-4 py-s-3">
                <h3 className="font-semibold text-ink">Top 10 médicaments vendus (ce mois)</h3>
              </div>
              {topMeds.length === 0 ? (
                <p className="px-s-4 py-s-4 text-small text-ink-3">Aucune sortie enregistrée ce mois.</p>
              ) : (
                <div className="divide-y divide-line">
                  {topMeds.map((m, i) => (
                    <div key={m.nom} className="flex items-center justify-between px-s-4 py-s-2">
                      <div className="flex items-center gap-s-3">
                        <span className="text-small font-bold text-ink-3 w-5">{i + 1}</span>
                        <p className="text-small text-ink">{m.nom}</p>
                      </div>
                      <span className="font-bold text-ink">{m.total} unités</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dormant stock */}
            {dormant.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50">
                <div className="border-b border-amber-200 px-s-4 py-s-3">
                  <h3 className="font-semibold text-amber-800">Stock dormant — aucun mouvement depuis 90 jours ({dormant.length})</h3>
                </div>
                <div className="divide-y divide-amber-100">
                  {dormant.slice(0, 10).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-s-4 py-s-2">
                      <p className="text-small text-amber-900">{s.nom}</p>
                      <span className="text-small font-medium text-amber-700">{s.quantite} en stock</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadRapports} className="self-start">
          Recalculer
        </Button>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      <h1 className="font-display text-h1 font-semibold text-ink">Stock</h1>

      {/* Tab selector */}
      <div className="flex gap-s-1 rounded-lg border border-line bg-surface-2 p-s-1 self-start">
        {(['stock', 'mouvements', 'rapports'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded px-s-4 py-s-1.5 text-small font-medium capitalize transition-colors ${tab === t ? 'bg-surface shadow text-ink' : 'text-ink-3 hover:text-ink'}`}>
            {t === 'stock' ? 'Stock' : t === 'mouvements' ? 'Mouvements' : 'Rapports'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
          className="flex flex-col gap-s-4">
          {tab === 'stock' && renderStockTab()}
          {tab === 'mouvements' && renderMouvementsTab()}
          {tab === 'rapports' && renderRapportsTab()}
        </motion.div>
      </AnimatePresence>

      {/* ── Modal Entrée stock ─────────────────────────────────────────────────── */}
      <Modal open={!!entreeItem} onOpenChange={open => { if (!open) setEntreeItem(null) }} title={`Entrée stock — ${entreeItem?.nom ?? ''}`}>
        <div className="flex flex-col gap-s-4">
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Quantité reçue *</label>
            <input type="number" min="1" value={entreeQty} onChange={e => setEntreeQty(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">N° de lot</label>
            <input type="text" value={entreeLot} onChange={e => setEntreeLot(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Motif / fournisseur</label>
            <input type="text" value={entreeMotif} onChange={e => setEntreeMotif(e.target.value)} placeholder="Commande fournisseur, don…"
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setEntreeItem(null)}>Annuler</Button>
            <Button variant="primary" onClick={confirmEntree} loading={savingEntree} leftIcon={<PackagePlus className="h-4 w-4" />}>
              Confirmer l'entrée
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Sortie manuelle ──────────────────────────────────────────────── */}
      <Modal open={!!sortieItem} onOpenChange={open => { if (!open) setSortieItem(null) }} title={`Sortie manuelle — ${sortieItem?.nom ?? ''}`}>
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">Stock actuel : <strong>{sortieItem?.quantite ?? 0}</strong> unités</p>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Quantité *</label>
            <input type="number" min="1" max={sortieItem?.quantite ?? undefined} value={sortieQty} onChange={e => setSortieQty(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Motif *</label>
            <input type="text" value={sortieMotif} onChange={e => setSortieMotif(e.target.value)} placeholder="Casse, don, correction…"
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setSortieItem(null)}>Annuler</Button>
            <Button variant="primary" onClick={confirmSortie} loading={savingSortie} leftIcon={<PackageMinus className="h-4 w-4" />}>
              Confirmer la sortie
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Périmé ──────────────────────────────────────────────────────── */}
      <Modal open={!!perimItem} onOpenChange={open => { if (!open) setPerimItem(null) }} title="Marquer comme périmé">
        <div className="flex flex-col gap-s-4">
          <div className="flex items-start gap-s-3 rounded-lg border border-status-danger/30 bg-status-danger/5 p-s-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-status-danger" />
            <div>
              <p className="font-semibold text-status-danger">{perimItem?.nom}</p>
              <p className="text-small text-status-danger">
                {perimItem?.quantite} unités seront retirées du stock et tracées comme périmées.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setPerimItem(null)}>Annuler</Button>
            <Button variant="primary" onClick={confirmPerim} loading={savingPerim} leftIcon={<Skull className="h-4 w-4" />}>
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal CSV Import ──────────────────────────────────────────────────── */}
      <Modal open={showCsv} onOpenChange={open => { if (!open) { setShowCsv(false); setCsvRows([]); setCsvError('') } }} title="Importer un fichier CSV" size="xl">
        <div className="flex flex-col gap-s-4">
          <div className="rounded-lg border border-dashed border-line bg-surface-2 p-s-6 text-center">
            <p className="mb-s-2 text-small text-ink-2">Colonnes attendues (séparateur <code>;</code>) :</p>
            <p className="font-mono text-micro text-ink-3">nom;dci;forme;dosage;quantite;prix_achat;prix_unitaire_vente;seuil_alerte;lot_numero;date_peremption</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCsvFile} className="mt-s-4 text-small" />
          </div>
          {csvError && <p className="text-small text-red-600">{csvError}</p>}
          {csvRows.length > 0 && (
            <>
              <p className="text-small text-ink-2">{csvRows.length} ligne(s) détectée(s) — aperçu (5 premières) :</p>
              <div className="overflow-x-auto rounded border border-line">
                <table className="w-full text-micro">
                  <thead className="bg-surface-2">
                    <tr>{Object.keys(csvRows[0]).map(k => <th key={k} className="px-s-2 py-s-1 text-left text-ink-3">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="divide-x divide-line border-t border-line">
                        {Object.values(row).map((v, j) => <td key={j} className="px-s-2 py-s-1 text-ink">{v || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setShowCsv(false); setCsvRows([]); setCsvError('') }}>Annuler</Button>
            <Button variant="primary" onClick={confirmCsvImport} loading={importingCsv} leftIcon={<Upload className="h-4 w-4" />} disabled={!csvRows.length}>
              Importer {csvRows.length > 0 ? `(${csvRows.length})` : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Drawer Modifier ──────────────────────────────────────────────────── */}
      <Drawer open={!!editItem} onClose={() => setEditItem(null)} title={`Modifier — ${editItem?.nom ?? ''}`}>
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">Modifiez les champs souhaités. Laissez vide pour ne pas modifier.</p>
          {[
            { label: 'Prix de vente (FCFA)', value: editPrixVente, set: setEditPrixVente, type: 'number' },
            { label: 'Prix d\'achat (FCFA)', value: editPrixAchat, set: setEditPrixAchat, type: 'number' },
            { label: 'Seuil d\'alerte (unités)', value: editSeuil, set: setEditSeuil, type: 'number' },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          ))}
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Date de péremption</label>
            <input type="date" value={editPeremption} onChange={e => setEditPeremption(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2 pt-s-2">
            <Button variant="ghost" onClick={() => setEditItem(null)}>Annuler</Button>
            <Button variant="primary" onClick={saveEdit} loading={savingEdit} leftIcon={<Edit2 className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ── Drawer Ajouter médicament ────────────────────────────────────────── */}
      <Drawer open={showAdd} onClose={() => { setShowAdd(false); resetAddForm() }} title="Ajouter un médicament">
        <div className="flex flex-col gap-s-4">
          {/* Catalog search */}
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Recherche dans le catalogue</label>
            <div className="relative">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text" value={catalogSearch} onChange={e => { setCatalogSearch(e.target.value); setSelectedCatalog(null) }}
                placeholder="Nom commercial ou DCI (min. 2 car.)…"
                className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {catalogResults.length > 0 && (
              <div className="rounded border border-line bg-surface shadow-lg">
                {catalogResults.map(item => (
                  <button key={item.id} onClick={() => selectCatalogItem(item)}
                    className="flex w-full items-start gap-s-3 px-s-3 py-s-2 text-left hover:bg-surface-2">
                    <div>
                      <p className="text-small font-medium text-ink">{item.nom_commercial}</p>
                      <p className="text-micro text-ink-3">{[item.dci, item.forme, item.dosage].filter(Boolean).join(' · ')}</p>
                    </div>
                    {item.remboursable_ss && (
                      <span className="ml-auto rounded bg-green-100 px-s-1.5 py-s-0.5 text-micro text-green-700">SS</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {catalogSearch.length >= 2 && !catalogResults.length && !selectedCatalog && (
              <div className="flex items-center justify-between rounded border border-dashed border-amber-300 bg-amber-50 px-s-3 py-s-2">
                <p className="text-micro text-amber-700">Non trouvé dans le catalogue — vous pouvez quand même l'ajouter</p>
                <button onClick={() => { setAddAdminNote(true); setAddNom(catalogSearch) }}
                  className="text-micro text-amber-700 underline">
                  Continuer
                </button>
              </div>
            )}
            {addAdminNote && (
              <p className="text-micro text-amber-700">⚠ Ce médicament sera soumis à validation admin et ajouté avec statut provisoire.</p>
            )}
          </div>

          <hr className="border-line" />

          {/* Fields */}
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Nom commercial *</label>
            <input type="text" value={addNom} onChange={e => setAddNom(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-s-3">
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">DCI</label>
              <input type="text" value={addDci} onChange={e => setAddDci(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Forme</label>
              <input type="text" value={addForme} onChange={e => setAddForme(e.target.value)} placeholder="Comprimé, sirop…"
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Dosage</label>
              <input type="text" value={addDosage} onChange={e => setAddDosage(e.target.value)} placeholder="500 mg"
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Qté initiale</label>
              <input type="number" min="0" value={addQty} onChange={e => setAddQty(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Prix vente (FCFA)</label>
              <input type="number" min="0" value={addPrixVente} onChange={e => setAddPrixVente(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Prix achat (FCFA)</label>
              <input type="number" min="0" value={addPrixAchat} onChange={e => setAddPrixAchat(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Seuil d'alerte</label>
              <input type="number" min="0" value={addSeuil} onChange={e => setAddSeuil(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">N° de lot</label>
              <input type="text" value={addLot} onChange={e => setAddLot(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Date de péremption</label>
            <input type="date" value={addPeremption} onChange={e => setAddPeremption(e.target.value)}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2 pt-s-2">
            <Button variant="ghost" onClick={() => { setShowAdd(false); resetAddForm() }}>Annuler</Button>
            <Button variant="primary" onClick={saveAdd} loading={savingAdd} leftIcon={<Plus className="h-4 w-4" />}>
              Ajouter au stock
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
