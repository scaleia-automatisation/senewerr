import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Download, Eye, QrCode, Upload, AlertTriangle, CheckSquare, Square,
  Package, Plus, Filter, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────────────────────

type Statut = 'en_attente' | 'en_cours' | 'validee' | 'refusee' | 'partiellement_servie'
type Tab = 'attente' | 'en_cours' | 'traitees' | 'refusees'
type StockStatus = 'full' | 'partial' | 'none' | 'unknown'

interface Medicament {
  id: string
  nom: string
  posologie: string | null
  frequence: string | null
  quantite_prescrite: number
  quantite_servie?: number | null
}

interface OrdonnanceSoumise {
  id: string
  patient_id: string
  created_at: string
  statut: Statut
  nb_medicaments: number | null
  priorite: string | null
  message_patient: string | null
  motif_refus?: string | null
  patient?: { full_name: string } | null
  ordonnance?: {
    pdf_url: string | null
    date_expiration: string | null
    medicaments: Medicament[]
  } | null
}

interface StockItem {
  medicament_nom: string
  quantite: number
}

interface TraiteesFilter {
  dateDebut: string
  dateFin: string
  patientRef: string
  medicament: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskRef(patientId: string, fullName?: string | null): string {
  if (fullName && fullName.length >= 3) {
    const parts = fullName.split(' ')
    const prenom = parts[0].slice(0, 4)
    const initiale = parts[1]?.[0] ? parts[1][0] + '.' : ''
    return `${prenom}** ${initiale}`.trim()
  }
  return `P-${patientId.slice(0, 6).toUpperCase()}`
}

function getStockStatus(med: Medicament, stock: StockItem[]): StockStatus {
  const item = stock.find(s => s.medicament_nom.toLowerCase() === med.nom.toLowerCase())
  if (!item) return 'unknown'
  if (item.quantite >= med.quantite_prescrite) return 'full'
  if (item.quantite > 0) return 'partial'
  return 'none'
}

function StockBadge({ status }: { status: StockStatus }) {
  const cfg: Record<StockStatus, { dot: string; label: string }> = {
    full:    { dot: 'bg-green-500',         label: 'En stock' },
    partial: { dot: 'bg-status-warning',    label: 'Stock partiel' },
    none:    { dot: 'bg-status-danger',     label: 'Rupture' },
    unknown: { dot: 'bg-ink-3',             label: '—' },
  }
  const { dot, label } = cfg[status]
  return (
    <span className="flex items-center gap-s-1 text-micro text-ink-3">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function exportCsv(data: OrdonnanceSoumise[]) {
  const rows = [
    ['Date', 'Réf. patient', 'Médicaments', 'Statut', 'Priorité'],
    ...data.map(o => [
      format(new Date(o.created_at), 'dd/MM/yyyy HH:mm'),
      maskRef(o.patient_id, o.patient?.full_name),
      String(o.nb_medicaments ?? '?'),
      o.statut,
      o.priorite ?? 'normale',
    ]),
  ]
  const csv = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ordonnances-traitees-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const SELECT_QUERY = `
  id, patient_id, created_at, statut, nb_medicaments, priorite, message_patient, motif_refus,
  patient:profiles!patient_id(full_name),
  ordonnance:ordonnances!ordonnance_id(
    pdf_url, date_expiration,
    medicaments:medicaments_ordonnance(id, nom, posologie, frequence, quantite_prescrite, quantite_servie)
  )
`.trim()

// ─── Main component ───────────────────────────────────────────────────────────

export default function PharmacyOrdonnancesPage() {
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const activeTab = (params.get('tab') as Tab | null) ?? 'attente'
  const focusId = params.get('id')
  const openScanner = params.get('action') === 'scanner'

  function setTab(tab: Tab) {
    setParams(p => { p.set('tab', tab); p.delete('id'); return p })
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [listAttente, setListAttente] = useState<OrdonnanceSoumise[]>([])
  const [listEnCours, setListEnCours] = useState<OrdonnanceSoumise[]>([])
  const [listTraitees, setListTraitees] = useState<OrdonnanceSoumise[]>([])
  const [listRefusees, setListRefusees] = useState<OrdonnanceSoumise[]>([])
  const [loading, setLoading] = useState(false)

  // Traitées filter
  const [showFilter, setShowFilter] = useState(false)
  const [filter, setFilter] = useState<TraiteesFilter>({ dateDebut: '', dateFin: '', patientRef: '', medicament: '' })

  // Expanded card state
  const [expandedId, setExpandedId] = useState<string | null>(focusId)
  const [stock, setStock] = useState<StockItem[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [serviesMap, setServiesMap] = useState<Record<string, number>>({})
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [taking, setTaking] = useState<string | null>(null)

  // Modals
  const [pdfModal, setPdfModal] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [refusModal, setRefusModal] = useState<string | null>(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [refusing, setRefusing] = useState(false)
  const [scanModal, setScanModal] = useState(openScanner)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanToken, setScanToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Tick for live time display (update every 30s)
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchTab = useCallback(async (tab: Tab) => {
    if (!pharmacie?.id) return
    setLoading(true)
    const statuts: Record<Tab, Statut[]> = {
      attente:  ['en_attente'],
      en_cours: ['en_cours'],
      traitees: ['validee', 'partiellement_servie'],
      refusees: ['refusee'],
    }
    let q = db
      .from('ordonnances_soumises')
      .select(SELECT_QUERY)
      .eq('pharmacie_id', pharmacie.id)
      .in('statut', statuts[tab])
      .order('created_at', { ascending: tab === 'attente' || tab === 'en_cours' })
      .limit(50)

    if (tab === 'traitees') {
      if (filter.dateDebut) q = q.gte('created_at', filter.dateDebut)
      if (filter.dateFin)   q = q.lte('created_at', filter.dateFin + 'T23:59:59')
    }

    const { data, error } = await q
    if (error) { toast.error('Erreur de chargement.'); setLoading(false); return }
    const rows: OrdonnanceSoumise[] = data ?? []

    if (tab === 'attente')  setListAttente(rows)
    else if (tab === 'en_cours') setListEnCours(rows)
    else if (tab === 'traitees') setListTraitees(rows)
    else setListRefusees(rows)
    setLoading(false)
  }, [pharmacie?.id, filter.dateDebut, filter.dateFin])

  useEffect(() => { fetchTab(activeTab) }, [fetchTab, activeTab])

  // Realtime sur en_attente
  useEffect(() => {
    if (activeTab !== 'attente' || !pharmacie?.id) return
    const channel = supabase
      .channel(`ord-attente-${pharmacie.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ordonnances_soumises',
        filter: `pharmacie_id=eq.${pharmacie.id}`,
      }, () => fetchTab('attente'))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab, pharmacie?.id, fetchTab])

  // Focus via URL
  useEffect(() => { if (focusId) setExpandedId(focusId) }, [focusId])

  // Charger stock quand une carte s'ouvre (attente ou en_cours)
  useEffect(() => {
    if (!expandedId || !pharmacie?.id) return
    const ord =
      listAttente.find(o => o.id === expandedId) ??
      listEnCours.find(o => o.id === expandedId)
    const meds = ord?.ordonnance?.medicaments
    if (!meds || meds.length === 0) return

    setLoadingStock(true)
    const names = meds.map(m => m.nom)
    db.from('stock_medicaments')
      .select('medicament_nom, quantite')
      .eq('pharmacie_id', pharmacie.id)
      .in('medicament_nom', names)
      .then(({ data }: any) => {
        setStock(data ?? [])
        setLoadingStock(false)
      })

    if (listEnCours.some(o => o.id === expandedId)) {
      const init: Record<string, number> = {}
      const checks: Record<string, boolean> = {}
      meds.forEach(m => { init[m.id] = m.quantite_prescrite; checks[m.id] = false })
      setServiesMap(init)
      setCheckedMap(checks)
      setNotes('')
    }
  }, [expandedId, pharmacie?.id])

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function prendreEnCharge(id: string) {
    setTaking(id)
    const { error } = await db
      .from('ordonnances_soumises')
      .update({ statut: 'en_cours', traite_par: profile?.id })
      .eq('id', id)
      .eq('pharmacie_id', pharmacie?.id)
    if (error) { toast.error('Erreur.'); setTaking(null); return }

    const ord = listAttente.find(o => o.id === id)
    if (ord?.patient_id) {
      try {
        await db.from('notifications').insert({
          event_type: 'ordonnance_en_preparation',
          title: 'Ordonnance en préparation',
          message: 'Votre ordonnance est en cours de préparation par la pharmacie.',
          user_id: ord.patient_id,
          badge_category: 'ordonnance',
          priority: 'normal',
          data: { ordonnance_soumise_id: id },
        })
      } catch { /* non-bloquant */ }
    }

    toast.success('Prise en charge. Voir l\'onglet « En cours ».')
    setTaking(null)
    setExpandedId(id)
    fetchTab('attente')
    fetchTab('en_cours')
    setTab('en_cours')
  }

  async function confirmerRefus() {
    if (!refusModal || !motifRefus.trim()) { toast.error('Veuillez saisir un motif.'); return }
    setRefusing(true)
    const { error } = await db
      .from('ordonnances_soumises')
      .update({ statut: 'refusee', motif_refus: motifRefus.trim() })
      .eq('id', refusModal)
      .eq('pharmacie_id', pharmacie?.id)
    if (error) { toast.error('Erreur.'); setRefusing(false); return }

    const ord = listAttente.find(o => o.id === refusModal) ?? listEnCours.find(o => o.id === refusModal)
    if (ord?.patient_id) {
      try {
        await db.from('notifications').insert({
          event_type: 'ordonnance_refusee',
          title: 'Ordonnance refusée',
          message: `Votre ordonnance a été refusée. Motif : ${motifRefus.trim()}`,
          user_id: ord.patient_id,
          badge_category: 'ordonnance',
          priority: 'high',
          data: { ordonnance_soumise_id: refusModal },
        })
      } catch { /* non-bloquant */ }
    }

    toast.success('Ordonnance refusée.')
    setRefusing(false)
    setRefusModal(null)
    setMotifRefus('')
    fetchTab(activeTab === 'en_cours' ? 'en_cours' : 'attente')
    fetchTab('refusees')
  }

  async function reconsiderer(id: string) {
    const { error } = await db
      .from('ordonnances_soumises')
      .update({ statut: 'en_attente', motif_refus: null })
      .eq('id', id)
      .eq('pharmacie_id', pharmacie?.id)
    if (error) { toast.error('Erreur.'); return }
    toast.success('Ordonnance remise en attente.')
    fetchTab('refusees')
    fetchTab('attente')
  }

  async function validerDispensation(id: string) {
    const ord = listEnCours.find(o => o.id === id)
    if (!ord) return
    setSubmitting(true)
    const medicaments = (ord.ordonnance?.medicaments ?? []).map(m => ({
      nom: m.nom,
      quantite_prescrite: m.quantite_prescrite,
      quantite_servie: serviesMap[m.id] ?? 0,
      posologie: m.posologie,
    }))
    const { error } = await supabase.functions.invoke('process-dispensation', {
      body: {
        ordonnance_soumise_id: id,
        medicaments,
        notes_pharmacien: notes.trim() || null,
        pharmacien_id: profile?.id,
        patient_id: ord.patient_id,
      },
    })
    if (error) {
      toast.error('Erreur lors de la dispensation. Réessayez.')
      setSubmitting(false)
      return
    }
    toast.success('Dispensation validée. Bon de dispensation généré.')
    setSubmitting(false)
    setExpandedId(null)
    fetchTab('en_cours')
    fetchTab('traitees')
  }

  async function openPdf(pdfPath: string | null | undefined) {
    if (!pdfPath) { toast.error('Aucun fichier PDF associé.'); return }
    setPdfLoading(true)
    const { data, error } = await supabase.storage.from('ordonnances').createSignedUrl(pdfPath, 3600)
    setPdfLoading(false)
    if (error || !data?.signedUrl) { toast.error('Impossible de charger le PDF.'); return }
    setPdfModal(data.signedUrl)
  }

  async function submitScan() {
    if (!pharmacie?.id) return
    setScanning(true)

    if (scanToken.trim()) {
      const { data, error } = await supabase.functions.invoke('validate-ordonnance-token', {
        body: { token: scanToken.trim(), pharmacie_id: pharmacie.id },
      })
      if (error || !data?.success) {
        toast.error(data?.message ?? 'Token invalide, expiré ou déjà dispensé.')
        setScanning(false)
        return
      }
      toast.success('Ordonnance ajoutée à la file d\'attente.')
      setScanModal(false)
      setScanToken('')
      fetchTab('attente')
      setTab('attente')
    } else if (scanFile) {
      const ext = scanFile.name.split('.').pop()
      const path = `pharmacie/${pharmacie.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('ordonnances').upload(path, scanFile)
      if (upErr) { toast.error('Erreur d\'upload.'); setScanning(false); return }
      const { error: efErr } = await supabase.functions.invoke('process-paper-ordonnance', {
        body: { pdf_path: path, pharmacie_id: pharmacie.id },
      })
      if (efErr) { toast.error('Impossible de traiter l\'ordonnance papier.'); setScanning(false); return }
      toast.success('Ordonnance papier ajoutée à la file d\'attente.')
      setScanModal(false)
      setScanFile(null)
      fetchTab('attente')
      setTab('attente')
    } else {
      toast.error('Veuillez fournir un fichier ou un token.')
    }

    setScanning(false)
  }

  // ── Filtered traitées ─────────────────────────────────────────────────────────
  const traiteesFiltrees = listTraitees.filter(o => {
    if (filter.patientRef) {
      const ref = maskRef(o.patient_id, o.patient?.full_name).toLowerCase()
      if (!ref.includes(filter.patientRef.toLowerCase())) return false
    }
    if (filter.medicament) {
      const meds = o.ordonnance?.medicaments?.map(m => m.nom.toLowerCase()).join(' ') ?? ''
      if (!meds.includes(filter.medicament.toLowerCase())) return false
    }
    return true
  })

  // ── Tab config ────────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'attente',  label: 'En attente',  count: listAttente.length },
    { key: 'en_cours', label: 'En cours',    count: listEnCours.length },
    { key: 'traitees', label: 'Traitées',    count: listTraitees.length },
    { key: 'refusees', label: 'Refusées',    count: listRefusees.length },
  ]

  // ── Card renderers ────────────────────────────────────────────────────────────

  function MedList({ meds, showStock }: { meds: Medicament[]; showStock: boolean }) {
    return (
      <ul className="flex flex-col gap-s-2">
        {meds.map(m => {
          const status = showStock ? getStockStatus(m, stock) : 'unknown'
          return (
            <li key={m.id} className="flex items-start gap-s-2 rounded border border-line bg-surface-2 px-s-3 py-s-2">
              <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
              <div className="flex-1 min-w-0">
                <p className="text-small font-medium text-ink">{m.nom}</p>
                {m.posologie && <p className="text-micro text-ink-3">{m.posologie}</p>}
                {m.frequence  && <p className="text-micro text-ink-3">{m.frequence}</p>}
                <p className="text-micro text-ink-3">Quantité prescrite : {m.quantite_prescrite}</p>
                {showStock && !loadingStock && <StockBadge status={status} />}
                {showStock && loadingStock && <span className="text-micro text-ink-3 animate-pulse">Chargement stock…</span>}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderAttenteCard(ord: OrdonnanceSoumise) {
    const isExpanded = expandedId === ord.id
    const meds = ord.ordonnance?.medicaments ?? []
    return (
      <div key={ord.id} className="rounded-lg border border-line bg-surface overflow-hidden">
        <button
          className="flex w-full items-center gap-s-3 px-s-4 py-s-3 text-left"
          onClick={() => setExpandedId(isExpanded ? null : ord.id)}
        >
          {ord.priorite === 'urgente' && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-danger" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-s-2">
              <p className="text-small font-medium text-ink">
                {maskRef(ord.patient_id, ord.patient?.full_name)}
              </p>
              {ord.priorite === 'urgente' && (
                <span className="rounded bg-status-danger/10 px-s-1.5 py-s-0.5 text-micro font-semibold text-status-danger">
                  URGENT
                </span>
              )}
            </div>
            <p className="text-micro text-ink-3">
              <Clock className="mr-s-1 inline h-3 w-3" />
              {formatDistanceToNow(new Date(ord.created_at), { addSuffix: true, locale: fr })}
              {ord.nb_medicaments != null && ` · ${ord.nb_medicaments} méd.`}
            </p>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-3" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-s-3 border-t border-line px-s-4 py-s-3">
                {ord.message_patient && (
                  <p className="rounded bg-surface-2 px-s-3 py-s-2 text-small italic text-ink-2">
                    « {ord.message_patient} »
                  </p>
                )}

                {meds.length > 0 && (
                  <MedList meds={meds} showStock={isExpanded} />
                )}

                <div className="flex flex-wrap gap-s-2">
                  {ord.ordonnance?.pdf_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Eye className="h-4 w-4" />}
                      onClick={() => openPdf(ord.ordonnance?.pdf_url)}
                      loading={pdfLoading}
                    >
                      Voir ordonnance PDF
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => prendreEnCharge(ord.id)}
                    loading={taking === ord.id}
                  >
                    Prendre en charge
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => { setRefusModal(ord.id); setMotifRefus('') }}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  function renderEnCoursCard(ord: OrdonnanceSoumise) {
    const isExpanded = expandedId === ord.id
    const meds = ord.ordonnance?.medicaments ?? []

    return (
      <div key={ord.id} className="rounded-lg border border-line bg-surface overflow-hidden">
        <button
          className="flex w-full items-center gap-s-3 px-s-4 py-s-3 text-left"
          onClick={() => setExpandedId(isExpanded ? null : ord.id)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-small font-medium text-ink">
              {maskRef(ord.patient_id, ord.patient?.full_name)}
            </p>
            <p className="text-micro text-ink-3">
              Prise en charge {formatDistanceToNow(new Date(ord.created_at), { addSuffix: true, locale: fr })}
              {meds.length > 0 && ` · ${meds.length} méd.`}
            </p>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-3" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-s-4 border-t border-line px-s-4 py-s-4">
                {ord.ordonnance?.pdf_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="h-4 w-4" />}
                    onClick={() => openPdf(ord.ordonnance?.pdf_url)}
                    loading={pdfLoading}
                  >
                    Voir l'ordonnance PDF
                  </Button>
                )}

                {/* Checklist médicaments */}
                {meds.length > 0 ? (
                  <div className="flex flex-col gap-s-2">
                    <p className="text-small font-semibold text-ink">Préparation</p>
                    {meds.map(m => {
                      const status = getStockStatus(m, stock)
                      const checked = checkedMap[m.id] ?? false
                      const qty = serviesMap[m.id] ?? m.quantite_prescrite
                      const stockItem = stock.find(s => s.medicament_nom.toLowerCase() === m.nom.toLowerCase())

                      return (
                        <div
                          key={m.id}
                          className={`flex items-start gap-s-3 rounded border px-s-3 py-s-2 transition-colors ${
                            checked ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : 'border-line bg-surface-2'
                          }`}
                        >
                          <button
                            className="mt-0.5 shrink-0"
                            onClick={() => setCheckedMap(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                          >
                            {checked
                              ? <CheckSquare className="h-4 w-4 text-green-500" />
                              : <Square className="h-4 w-4 text-ink-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-small font-medium ${checked ? 'text-ink-3 line-through' : 'text-ink'}`}>
                              {m.nom}
                            </p>
                            {m.posologie && <p className="text-micro text-ink-3">{m.posologie}</p>}
                            <div className="mt-s-1 flex items-center gap-s-3">
                              <StockBadge status={status} />
                              {stockItem && (
                                <span className="text-micro text-ink-3">
                                  Stock : {stockItem.quantite}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-s-1">
                            <span className="text-micro text-ink-3">Qté :</span>
                            <input
                              type="number"
                              min={0}
                              max={m.quantite_prescrite}
                              value={qty}
                              onChange={e => setServiesMap(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                              className="w-14 rounded border border-line bg-surface px-s-2 py-s-1 text-center text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-micro text-ink-3">/{m.quantite_prescrite}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-small text-ink-3">Aucun détail de médicament disponible.</p>
                )}

                {/* Notes pharmacien */}
                <div className="flex flex-col gap-s-1">
                  <label className="text-small font-semibold text-ink">
                    Notes pharmacien <span className="font-normal text-ink-3">(optionnel)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Substitution effectuée, mise en garde, conseil posologique…"
                    className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-s-2">
                  <Button
                    variant="primary"
                    leftIcon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => validerDispensation(ord.id)}
                    loading={submitting}
                  >
                    Valider la dispensation
                  </Button>
                  <Button
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() => { setRefusModal(ord.id); setMotifRefus('') }}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  function renderTraiteeCard(ord: OrdonnanceSoumise) {
    const isExpanded = expandedId === ord.id
    const meds = ord.ordonnance?.medicaments ?? []
    return (
      <div key={ord.id} className="rounded-lg border border-line bg-surface overflow-hidden">
        <button
          className="flex w-full items-center gap-s-3 px-s-4 py-s-3 text-left"
          onClick={() => setExpandedId(isExpanded ? null : ord.id)}
        >
          <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          <div className="flex-1 min-w-0">
            <p className="text-small font-medium text-ink">
              {maskRef(ord.patient_id, ord.patient?.full_name)}
            </p>
            <p className="text-micro text-ink-3">
              {format(new Date(ord.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
              {meds.length > 0 && ` · ${meds.length} méd.`}
              {ord.statut === 'partiellement_servie' && (
                <span className="ml-s-1 text-status-warning font-medium"> Partielle</span>
              )}
            </p>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-ink-3" /> : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-s-3 border-t border-line px-s-4 py-s-3">
                {meds.length > 0 && (
                  <ul className="flex flex-col gap-s-1">
                    {meds.map(m => (
                      <li key={m.id} className="flex items-center gap-s-2 text-small text-ink-2">
                        <Package className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                        {m.nom}
                        {m.quantite_servie != null && (
                          <span className="text-micro text-ink-3 ml-auto">
                            {m.quantite_servie}/{m.quantite_prescrite}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {ord.ordonnance?.pdf_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="h-4 w-4" />}
                    onClick={() => openPdf(ord.ordonnance?.pdf_url)}
                  >
                    Voir ordonnance PDF
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  function renderRefuseeCard(ord: OrdonnanceSoumise) {
    return (
      <div key={ord.id} className="flex flex-col gap-s-2 rounded-lg border border-line bg-surface px-s-4 py-s-3">
        <div className="flex items-center gap-s-3">
          <XCircle className="h-5 w-5 shrink-0 text-status-danger" />
          <div className="flex-1 min-w-0">
            <p className="text-small font-medium text-ink">
              {maskRef(ord.patient_id, ord.patient?.full_name)}
            </p>
            <p className="text-micro text-ink-3">
              {format(new Date(ord.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => reconsiderer(ord.id)}>
            Reconsidérer
          </Button>
        </div>
        {ord.motif_refus && (
          <p className="pl-s-7 text-micro text-ink-3">
            Motif : {ord.motif_refus}
          </p>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const currentList =
    activeTab === 'attente'  ? listAttente  :
    activeTab === 'en_cours' ? listEnCours  :
    activeTab === 'traitees' ? traiteesFiltrees :
    listRefusees

  return (
    <div className="flex flex-col gap-s-4 pb-s-20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 font-semibold text-ink">Ordonnances</h1>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setScanModal(true)}
          className="hidden sm:flex"
        >
          Scanner
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-s-1 rounded-lg border border-line bg-surface-2 p-s-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-s-1.5 px-s-1 text-small font-medium transition-colors ${
              activeTab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">
              {t.key === 'attente' ? 'Attente' :
               t.key === 'en_cours' ? 'En cours' :
               t.key === 'traitees' ? 'Traitées' : 'Refusées'}
            </span>
            {t.count > 0 && (
              <span className={`ml-s-1 text-micro ${
                activeTab === t.key
                  ? t.key === 'attente' ? 'text-status-danger font-bold' : 'text-primary'
                  : 'text-ink-3'
              }`}>
                ({t.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres — Traitées uniquement */}
      {activeTab === 'traitees' && (
        <div className="flex flex-col gap-s-2">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-s-1 text-small text-ink-3 hover:text-ink"
              onClick={() => setShowFilter(f => !f)}
            >
              <Filter className="h-4 w-4" />
              Filtrer
              {(filter.patientRef || filter.medicament || filter.dateDebut || filter.dateFin) && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
            {traiteesFiltrees.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={() => exportCsv(traiteesFiltrees)}
              >
                Export CSV
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-s-2 rounded-lg border border-line bg-surface p-s-3 sm:grid-cols-4">
                  <div className="flex flex-col gap-s-1">
                    <label className="text-micro text-ink-3">Date début</label>
                    <input
                      type="date"
                      value={filter.dateDebut}
                      onChange={e => setFilter(f => ({ ...f, dateDebut: e.target.value }))}
                      className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-s-1">
                    <label className="text-micro text-ink-3">Date fin</label>
                    <input
                      type="date"
                      value={filter.dateFin}
                      onChange={e => setFilter(f => ({ ...f, dateFin: e.target.value }))}
                      className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-s-1">
                    <label className="text-micro text-ink-3">Réf. patient</label>
                    <input
                      type="text"
                      value={filter.patientRef}
                      onChange={e => setFilter(f => ({ ...f, patientRef: e.target.value }))}
                      placeholder="P-ABCDEF"
                      className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-s-1">
                    <label className="text-micro text-ink-3">Médicament</label>
                    <input
                      type="text"
                      value={filter.medicament}
                      onChange={e => setFilter(f => ({ ...f, medicament: e.target.value }))}
                      placeholder="Paracétamol…"
                      className="rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    className="col-span-2 flex items-center gap-s-1 text-micro text-ink-3 hover:text-status-danger sm:col-span-4"
                    onClick={() => setFilter({ dateDebut: '', dateFin: '', patientRef: '', medicament: '' })}
                  >
                    <X className="h-3 w-3" /> Réinitialiser les filtres
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col gap-s-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-small">
            {activeTab === 'attente'  && 'Aucune ordonnance en attente ✓'}
            {activeTab === 'en_cours' && 'Aucune ordonnance en cours ✓'}
            {activeTab === 'traitees' && 'Aucune ordonnance traitée'}
            {activeTab === 'refusees' && 'Aucune ordonnance refusée'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-3">
          {activeTab === 'attente'  && listAttente.map(renderAttenteCard)}
          {activeTab === 'en_cours' && listEnCours.map(renderEnCoursCard)}
          {activeTab === 'traitees' && traiteesFiltrees.map(renderTraiteeCard)}
          {activeTab === 'refusees' && listRefusees.map(renderRefuseeCard)}
        </div>
      )}

      {/* FAB mobile */}
      <button
        onClick={() => setScanModal(true)}
        className="sm:hidden fixed bottom-s-6 right-s-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary/90"
        aria-label="Scanner une ordonnance"
      >
        <QrCode className="h-6 w-6" />
      </button>

      {/* ── Modal PDF ─────────────────────────────────────────────────────────── */}
      <Modal
        open={!!pdfModal}
        onOpenChange={open => { if (!open) setPdfModal(null) }}
        title="Ordonnance PDF"
        size="lg"
      >
        {pdfModal && (
          <iframe
            src={pdfModal}
            className="h-[70vh] w-full rounded border border-line"
            title="Ordonnance"
          />
        )}
      </Modal>

      {/* ── Modal Refus ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!refusModal}
        onOpenChange={open => { if (!open) { setRefusModal(null); setMotifRefus('') } }}
        title="Refuser l'ordonnance"
      >
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">
            Le patient sera notifié du refus avec le motif indiqué ci-dessous.
          </p>
          <textarea
            value={motifRefus}
            onChange={e => setMotifRefus(e.target.value)}
            rows={3}
            placeholder="Médicament non disponible, ordonnance illisible, date de validité dépassée…"
            className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setRefusModal(null); setMotifRefus('') }}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={confirmerRefus}
              loading={refusing}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Confirmer le refus
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Scanner ─────────────────────────────────────────────────────── */}
      <Modal
        open={scanModal}
        onOpenChange={open => { if (!open) { setScanModal(false); setScanFile(null); setScanToken('') } }}
        title="Scanner une ordonnance"
      >
        <div className="flex flex-col gap-s-5">

          {/* Option A : QR / token */}
          <div className="flex flex-col gap-s-2">
            <p className="text-small font-semibold text-ink">Option A — QR code / token numérique</p>
            <p className="text-micro text-ink-3">
              Scannez le QR code présent sur l'ordonnance Sene Werr du patient, ou collez le token.
            </p>
            <div className="flex gap-s-2">
              <input
                type="text"
                value={scanToken}
                onChange={e => setScanToken(e.target.value)}
                placeholder="ex: SW-ORD-XXXXXX"
                className="flex-1 rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<QrCode className="h-4 w-4" />}
                onClick={() => cameraInputRef.current?.click()}
              >
                Caméra
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) setScanFile(f)
              }}
            />
          </div>

          <div className="flex items-center gap-s-3">
            <div className="flex-1 border-t border-line" />
            <span className="text-micro text-ink-3">ou</span>
            <div className="flex-1 border-t border-line" />
          </div>

          {/* Option B : upload PDF/image */}
          <div className="flex flex-col gap-s-2">
            <p className="text-small font-semibold text-ink">Option B — Ordonnance papier (PDF / photo)</p>
            <p className="text-micro text-ink-3">
              Uploadez l'ordonnance scannée pour traitement manuel.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-s-2 rounded-lg border-2 border-dashed border-line bg-surface-2 px-s-4 py-s-5 transition-colors hover:border-primary">
              <Upload className="h-6 w-6 text-ink-3" />
              <span className="text-small text-ink-2">
                {scanFile ? scanFile.name : 'Cliquez ou déposez un fichier (.pdf, image)'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setScanFile(f) }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-s-2">
            <Button
              variant="ghost"
              onClick={() => { setScanModal(false); setScanFile(null); setScanToken('') }}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={submitScan}
              loading={scanning}
              leftIcon={<CheckCircle className="h-4 w-4" />}
            >
              Valider
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
