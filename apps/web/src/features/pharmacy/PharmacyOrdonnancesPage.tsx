import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Download, Eye, QrCode, Upload, X, AlertTriangle, Loader2,
  CheckSquare, Square, Package, Plus,
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
  quantite_prescrite: number
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

function stockDot(status: StockStatus) {
  const map: Record<StockStatus, string> = {
    full: 'bg-green-500',
    partial: 'bg-status-warning',
    none: 'bg-status-danger',
    unknown: 'bg-ink-3',
  }
  const label: Record<StockStatus, string> = {
    full: 'En stock', partial: 'Stock partiel', none: 'Rupture', unknown: '—',
  }
  return (
    <span className="flex items-center gap-s-1 text-micro">
      <span className={`h-2 w-2 rounded-full ${map[status]}`} />
      {label[status]}
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
  const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
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
    medicaments:medicaments_ordonnance(id, nom, posologie, quantite_prescrite)
  )
`

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Per-tab lists ────────────────────────────────────────────────────────────
  const [listAttente, setListAttente] = useState<OrdonnanceSoumise[]>([])
  const [listEnCours, setListEnCours] = useState<OrdonnanceSoumise[]>([])
  const [listTraitees, setListTraitees] = useState<OrdonnanceSoumise[]>([])
  const [listRefusees, setListRefusees] = useState<OrdonnanceSoumise[]>([])
  const [loading, setLoading] = useState(false)

  // ── Expanded card state ──────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(focusId)
  const [stock, setStock] = useState<StockItem[]>([])
  const [serviesMap, setServiesMap] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [taking, setTaking] = useState<string | null>(null)
  const [refusing, setRefusing] = useState<string | null>(null)

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [pdfModal, setPdfModal] = useState<string | null>(null)
  const [refusModal, setRefusModal] = useState<string | null>(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [scanModal, setScanModal] = useState(openScanner)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanToken, setScanToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetch = useCallback(async (tab: Tab) => {
    if (!pharmacie?.id) return
    setLoading(true)
    const statuts: Record<Tab, Statut[]> = {
      attente: ['en_attente'],
      en_cours: ['en_cours'],
      traitees: ['validee', 'partiellement_servie'],
      refusees: ['refusee'],
    }
    const { data, error } = await db
      .from('ordonnances_soumises')
      .select(SELECT_QUERY.trim())
      .eq('pharmacie_id', pharmacie.id)
      .in('statut', statuts[tab])
      .order('created_at', { ascending: tab === 'attente' })
      .limit(50)
    if (error) { toast.error('Erreur de chargement.'); setLoading(false); return }
    const rows: OrdonnanceSoumise[] = data ?? []
    if (tab === 'attente') setListAttente(rows)
    else if (tab === 'en_cours') setListEnCours(rows)
    else if (tab === 'traitees') setListTraitees(rows)
    else setListRefusees(rows)
    setLoading(false)
  }, [pharmacie?.id])

  useEffect(() => { fetch(activeTab) }, [fetch, activeTab])

  // Realtime sur en_attente
  useEffect(() => {
    if (activeTab !== 'attente' || !pharmacie?.id) return
    const channel = supabase
      .channel(`ord-attente-${pharmacie.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ordonnances_soumises',
        filter: `pharmacie_id=eq.${pharmacie.id}`,
      }, () => fetch('attente'))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeTab, pharmacie?.id, fetch])

  // Focus ordonnance depuis URL
  useEffect(() => {
    if (focusId) setExpandedId(focusId)
  }, [focusId])

  // Charger stock quand on ouvre une carte en_cours
  useEffect(() => {
    if (!expandedId || !pharmacie?.id) return
    const ord = listEnCours.find(o => o.id === expandedId)
    if (!ord?.ordonnance?.medicaments) return
    const names = ord.ordonnance.medicaments.map(m => m.nom)
    db.from('stock_medicaments')
      .select('medicament_nom, quantite')
      .eq('pharmacie_id', pharmacie.id)
      .in('medicament_nom', names)
      .then(({ data }: any) => setStock(data ?? []))

    const init: Record<string, number> = {}
    ord.ordonnance.medicaments.forEach(m => { init[m.id] = m.quantite_prescrite })
    setServiesMap(init)
    setNotes('')
  }, [expandedId, listEnCours, pharmacie?.id])

  // ── Actions ──────────────────────────────────────────────────────────────────

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

    toast.success('Prise en charge. Allez dans « En cours ».')
    setTaking(null)
    fetch('attente')
    fetch('en_cours')
    setTab('en_cours')
    setExpandedId(id)
  }

  async function confirmerRefus() {
    if (!refusModal || !motifRefus.trim()) { toast.error('Veuillez saisir un motif.'); return }
    setRefusing(refusModal)
    const { error } = await db
      .from('ordonnances_soumises')
      .update({ statut: 'refusee', motif_refus: motifRefus.trim() })
      .eq('id', refusModal)
      .eq('pharmacie_id', pharmacie?.id)
    if (error) { toast.error('Erreur.'); setRefusing(null); return }

    const ord = listAttente.find(o => o.id === refusModal) ?? listEnCours.find(o => o.id === refusModal)
    if (ord?.patient_id) {
      try {
        await db.from('notifications').insert({
          event_type: 'ordonnance_refusee',
          title: 'Ordonnance refusée',
          message: `Motif : ${motifRefus.trim()}`,
          user_id: ord.patient_id,
          badge_category: 'ordonnance',
          priority: 'high',
          data: { ordonnance_soumise_id: refusModal },
        })
      } catch { /* non-bloquant */ }
    }

    toast.success('Ordonnance refusée.')
    setRefusing(null)
    setRefusModal(null)
    setMotifRefus('')
    fetch(activeTab === 'en_cours' ? 'en_cours' : 'attente')
  }

  async function reconsiderer(id: string) {
    const { error } = await db
      .from('ordonnances_soumises')
      .update({ statut: 'en_attente', motif_refus: null })
      .eq('id', id)
      .eq('pharmacie_id', pharmacie?.id)
    if (error) { toast.error('Erreur.'); return }
    toast.success('Ordonnance remise en attente.')
    fetch('refusees')
    fetch('attente')
  }

  async function validerDispensation(id: string) {
    const ord = listEnCours.find(o => o.id === id)
    if (!ord) return
    setSubmitting(true)
    const medicaments = (ord.ordonnance?.medicaments ?? []).map(m => ({
      nom: m.nom,
      quantite_servie: serviesMap[m.id] ?? 0,
    }))
    const { error } = await supabase.functions.invoke('process-dispensation', {
      body: {
        ordonnance_soumise_id: id,
        medicaments,
        notes_pharmacien: notes.trim() || null,
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
    fetch('en_cours')
    fetch('traitees')
  }

  async function openPdf(pdfPath: string | null | undefined) {
    if (!pdfPath) { toast.error('Pas de fichier PDF associé.'); return }
    const { data, error } = await supabase.storage.from('ordonnances').createSignedUrl(pdfPath, 3600)
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
        toast.error(data?.message ?? 'Token invalide ou expiré.')
        setScanning(false)
        return
      }
      toast.success('Ordonnance ajoutée à la file d\'attente.')
      setScanModal(false)
      setScanToken('')
      fetch('attente')
      setTab('attente')
      setScanning(false)
      return
    }

    if (scanFile) {
      const ext = scanFile.name.split('.').pop()
      const path = `pharmacie/${pharmacie.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('ordonnances').upload(path, scanFile)
      if (uploadErr) { toast.error('Erreur d\'upload.'); setScanning(false); return }

      const { error: efErr } = await supabase.functions.invoke('process-paper-ordonnance', {
        body: { pdf_path: path, pharmacie_id: pharmacie.id },
      })
      if (efErr) { toast.error('Impossible de traiter l\'ordonnance.'); setScanning(false); return }
      toast.success('Ordonnance papier ajoutée à la file d\'attente.')
      setScanModal(false)
      setScanFile(null)
      fetch('attente')
      setTab('attente')
      setScanning(false)
      return
    }

    toast.error('Veuillez fournir un fichier ou un token.')
    setScanning(false)
  }

  // ── Tab data ─────────────────────────────────────────────────────────────────

  const tabsConfig: { key: Tab; label: string; list: OrdonnanceSoumise[] }[] = [
    { key: 'attente', label: 'En attente', list: listAttente },
    { key: 'en_cours', label: 'En cours', list: listEnCours },
    { key: 'traitees', label: 'Traitées', list: listTraitees },
    { key: 'refusees', label: 'Refusées', list: listRefusees },
  ]

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderAttenteCard(ord: OrdonnanceSoumise) {
    const isExpanded = expandedId === ord.id
    return (
      <div key={ord.id} className="rounded-lg border border-line bg-surface">
        <button
          className="flex w-full items-center gap-s-3 px-s-4 py-s-3 text-left"
          onClick={() => setExpandedId(isExpanded ? null : ord.id)}
        >
          {ord.priorite === 'urgente' && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-danger" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-small font-medium text-ink">
              {maskRef(ord.patient_id, ord.patient?.full_name)}
              {ord.priorite === 'urgente' && (
                <span className="ml-s-2 rounded bg-status-danger/10 px-s-1 text-micro font-semibold text-status-danger">
                  URGENT
                </span>
              )}
            </p>
            <p className="text-micro text-ink-3">
              {formatDistanceToNow(new Date(ord.created_at), { addSuffix: true, locale: fr })}
              {ord.nb_medicaments != null && ` · ${ord.nb_medicaments} méd.`}
            </p>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-ink-3" /> : <ChevronDown className="h-4 w-4 text-ink-3" />}
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
              <div className="border-t border-line px-s-4 py-s-3 flex flex-col gap-s-3">
                {ord.message_patient && (
                  <p className="rounded bg-surface-2 px-s-3 py-s-2 text-small italic text-ink-2">
                    « {ord.message_patient} »
                  </p>
                )}
                {ord.ordonnance?.medicaments && ord.ordonnance.medicaments.length > 0 && (
                  <ul className="flex flex-col gap-s-1">
                    {ord.ordonnance.medicaments.map(m => (
                      <li key={m.id} className="flex items-center gap-s-2 text-small text-ink-2">
                        <Package className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                        <span>{m.nom}</span>
                        {m.posologie && <span className="text-micro text-ink-3">— {m.posologie}</span>}
                        <span className="text-micro text-ink-3">x{m.quantite_prescrite}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-s-2 flex-wrap">
                  {ord.ordonnance?.pdf_url && (
                    <Button size="sm" variant="ghost" leftIcon={<Eye className="h-4 w-4" />} onClick={() => openPdf(ord.ordonnance?.pdf_url)}>
                      Voir PDF
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
      <div key={ord.id} className="rounded-lg border border-line bg-surface">
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
          {isExpanded ? <ChevronUp className="h-4 w-4 text-ink-3" /> : <ChevronDown className="h-4 w-4 text-ink-3" />}
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
              <div className="border-t border-line px-s-4 py-s-4 flex flex-col gap-s-4">
                {/* PDF */}
                {ord.ordonnance?.pdf_url && (
                  <Button size="sm" variant="ghost" leftIcon={<Eye className="h-4 w-4" />} onClick={() => openPdf(ord.ordonnance?.pdf_url)}>
                    Voir l'ordonnance PDF
                  </Button>
                )}

                {/* Checklist médicaments */}
                {meds.length > 0 ? (
                  <div className="flex flex-col gap-s-2">
                    <p className="text-small font-semibold text-ink">Médicaments à servir</p>
                    {meds.map(m => {
                      const status = getStockStatus(m, stock)
                      const val = serviesMap[m.id] ?? m.quantite_prescrite
                      return (
                        <div key={m.id} className="flex items-center gap-s-3 rounded border border-line bg-surface-2 px-s-3 py-s-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-small font-medium text-ink truncate">{m.nom}</p>
                            {m.posologie && <p className="text-micro text-ink-3">{m.posologie}</p>}
                            {stockDot(status)}
                          </div>
                          <div className="flex items-center gap-s-2 shrink-0">
                            <span className="text-micro text-ink-3">Qté :</span>
                            <input
                              type="number"
                              min={0}
                              max={m.quantite_prescrite}
                              value={val}
                              onChange={e => setServiesMap(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                              className="w-16 rounded border border-line bg-surface px-s-2 py-s-1 text-center text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-micro text-ink-3">/ {m.quantite_prescrite}</span>
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
                  <label className="text-small font-semibold text-ink">Notes pharmacien (optionnel)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Substitution effectuée, conseil donné…"
                    className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-s-2 flex-wrap">
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
    return (
      <div key={ord.id} className="flex items-center gap-s-3 rounded-lg border border-line bg-surface px-s-4 py-s-3">
        <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
        <div className="flex-1 min-w-0">
          <p className="text-small font-medium text-ink">
            {maskRef(ord.patient_id, ord.patient?.full_name)}
          </p>
          <p className="text-micro text-ink-3">
            {format(new Date(ord.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
            {ord.nb_medicaments != null && ` · ${ord.nb_medicaments} méd.`}
          </p>
        </div>
        {ord.ordonnance?.pdf_url && (
          <button
            onClick={() => openPdf(ord.ordonnance?.pdf_url)}
            className="text-ink-3 hover:text-ink"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  function renderRefuseeCard(ord: OrdonnanceSoumise) {
    return (
      <div key={ord.id} className="rounded-lg border border-line bg-surface px-s-4 py-s-3 flex flex-col gap-s-2">
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reconsiderer(ord.id)}
          >
            Reconsidérer
          </Button>
        </div>
        {ord.motif_refus && (
          <p className="text-micro text-ink-3 pl-s-7">
            Motif : {ord.motif_refus}
          </p>
        )}
      </div>
    )
  }

  const currentList = tabsConfig.find(t => t.key === activeTab)?.list ?? []

  return (
    <div className="flex flex-col gap-s-4 pb-s-16">
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
          Scanner une ordonnance
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-s-1 rounded-lg border border-line bg-surface-2 p-s-1">
        {tabsConfig.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-s-2 py-s-1.5 text-small font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-3 hover:text-ink'
            }`}
          >
            {t.label}
            {t.list.length > 0 && (
              <span className={`ml-s-1 text-micro ${activeTab === t.key ? 'text-primary' : 'text-ink-3'}`}>
                ({t.list.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Export CSV (traitées only) */}
      {activeTab === 'traitees' && listTraitees.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => exportCsv(listTraitees)}
          >
            Exporter CSV
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-s-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-small">
            {activeTab === 'attente' && 'Aucune ordonnance en attente'}
            {activeTab === 'en_cours' && 'Aucune ordonnance en cours'}
            {activeTab === 'traitees' && 'Aucune ordonnance traitée'}
            {activeTab === 'refusees' && 'Aucune ordonnance refusée'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-s-3">
          {activeTab === 'attente' && listAttente.map(renderAttenteCard)}
          {activeTab === 'en_cours' && listEnCours.map(renderEnCoursCard)}
          {activeTab === 'traitees' && listTraitees.map(renderTraiteeCard)}
          {activeTab === 'refusees' && listRefusees.map(renderRefuseeCard)}
        </div>
      )}

      {/* FAB mobile */}
      <button
        onClick={() => setScanModal(true)}
        className="sm:hidden fixed bottom-s-6 right-s-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors z-20"
        aria-label="Scanner une ordonnance"
      >
        <QrCode className="h-6 w-6" />
      </button>

      {/* Modal PDF */}
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

      {/* Modal Refus */}
      <Modal
        open={!!refusModal}
        onOpenChange={open => { if (!open) { setRefusModal(null); setMotifRefus('') } }}
        title="Refuser l'ordonnance"
      >
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">
            Le patient sera notifié du refus. Veuillez indiquer un motif clair.
          </p>
          <textarea
            value={motifRefus}
            onChange={e => setMotifRefus(e.target.value)}
            rows={3}
            placeholder="Médicament non disponible, ordonnance illisible, date dépassée…"
            className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setRefusModal(null); setMotifRefus('') }}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={confirmerRefus}
              loading={refusing === refusModal}
              leftIcon={<XCircle className="h-4 w-4" />}
            >
              Confirmer le refus
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Scanner */}
      <Modal
        open={scanModal}
        onOpenChange={open => {
          if (!open) { setScanModal(false); setScanFile(null); setScanToken('') }
        }}
        title="Scanner une ordonnance"
      >
        <div className="flex flex-col gap-s-5">
          {/* Option 1 : QR / token */}
          <div className="flex flex-col gap-s-2">
            <p className="text-small font-semibold text-ink">Token QR</p>
            <p className="text-micro text-ink-3">
              Scannez le QR code du patient ou saisissez le token ici.
            </p>
            <div className="flex gap-s-2">
              <input
                type="text"
                value={scanToken}
                onChange={e => setScanToken(e.target.value)}
                placeholder="ex: ORD-XXXXXX"
                className="flex-1 rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<QrCode className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Caméra
              </Button>
              <input
                ref={fileInputRef}
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
          </div>

          <div className="flex items-center gap-s-3">
            <div className="flex-1 border-t border-line" />
            <span className="text-micro text-ink-3">ou</span>
            <div className="flex-1 border-t border-line" />
          </div>

          {/* Option 2 : upload PDF */}
          <div className="flex flex-col gap-s-2">
            <p className="text-small font-semibold text-ink">Ordonnance papier (PDF / photo)</p>
            <p className="text-micro text-ink-3">
              Uploadez l'ordonnance scannée pour la traiter manuellement.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-s-2 rounded-lg border-2 border-dashed border-line bg-surface-2 px-s-4 py-s-5 hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-ink-3" />
              <span className="text-small text-ink-2">
                {scanFile ? scanFile.name : 'Choisir un fichier'}
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setScanFile(f)
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => { setScanModal(false); setScanFile(null); setScanToken('') }}>
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
