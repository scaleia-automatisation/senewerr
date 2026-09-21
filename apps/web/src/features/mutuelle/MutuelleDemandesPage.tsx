import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { formatDistanceToNow, format, differenceInHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, CheckCircle, XCircle, AlertCircle, Search, Filter,
  Download, Eye, FileText, CheckSquare, Square, ChevronDown, X,
  Paperclip, Send, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { StatusBadge } from '@/components/mutuelle/StatusBadge'
import { ConfirmModal } from '@/components/mutuelle/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type DemandeStatut = 'en_attente' | 'en_instruction' | 'approuve' | 'refuse' | 'complement_requis' | 'rembourse'
type DemandeType = 'consultations' | 'medicaments' | 'hospitalisations' | 'analyses' | 'autre'
type SubTab = 'a_traiter' | 'en_cours' | 'historique'

interface Demande {
  id: string
  reference: string
  adherent_nom: string
  adherent_avatar: string | null
  numero_contrat: string
  type: DemandeType
  praticien: string
  date_soin: string | null
  created_at: string
  montant_demande: number
  montant_approuve: number | null
  statut: DemandeStatut
  contrat_id: string | null
  adherent_id: string
  documents: DocJustificatif[]
}

interface DocJustificatif {
  id: string
  nom: string
  url: string
  type: string
}

interface CalcResult {
  montantDemande: number
  categorie: string
  taux: number
  montantCalcule: number
  plafondCategorie: number
  plafondUtilise: number
  plafondRestant: number
  montantSuggere: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DemandeType | string, { label: string; color: string }> = {
  consultations:   { label: 'Consultation',     color: 'bg-sky-100 text-sky-700' },
  medicaments:     { label: 'Ordonnance',        color: 'bg-emerald-100 text-emerald-700' },
  hospitalisations:{ label: 'Hospitalisation',  color: 'bg-violet-100 text-violet-700' },
  analyses:        { label: 'Analyses',          color: 'bg-amber-100 text-amber-700' },
  autre:           { label: 'Autre',             color: 'bg-surface-2 text-ink-3' },
}

const PIECES_POSSIBLES = [
  'Ordonnance originale', 'Facture acquittée', 'Compte rendu médical',
  'Résultats d\'analyses', 'Bulletin d\'hospitalisation', 'Bon de prise en charge',
  'CNI/Passeport', 'Justificatif de paiement',
]

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

// ── SLA Timer ─────────────────────────────────────────────────────────────────

function SlaTimer({ createdAt }: { createdAt: string }) {
  const hours = differenceInHours(new Date(), new Date(createdAt))
  const pct = Math.min(100, (hours / 72) * 100)
  const color = hours >= 72 ? 'bg-red-500' : hours >= 48 ? 'bg-amber-500' : 'bg-emerald-500'
  const label = formatDistanceToNow(new Date(createdAt), { locale: fr, addSuffix: true })

  return (
    <div className="flex items-center gap-s-2 min-w-[120px]">
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-surface-2">
          <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`text-micro font-medium whitespace-nowrap ${hours >= 72 ? 'text-red-600' : hours >= 48 ? 'text-amber-600' : 'text-ink-3'}`}>
        {label}
      </span>
    </div>
  )
}

// ── Modal traitement ───────────────────────────────────────────────────────────

function TraitementModal({ demande, open, onOpenChange, onDone }: {
  demande: Demande
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const [calc, setCalc] = useState<CalcResult | null>(null)
  const [loadingCalc, setLoadingCalc] = useState(false)
  const [montantApprouve, setMontantApprouve] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [motifRejet, setMotifRejet] = useState('')
  const [confirmApprouver, setConfirmApprouver] = useState(false)
  const [confirmRejeter, setConfirmRejeter] = useState(false)
  const [showComplement, setShowComplement] = useState(false)
  const [piecesRequises, setPiecesRequises] = useState<string[]>([])
  const [msgComplement, setMsgComplement] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocJustificatif | null>(null)

  useEffect(() => {
    if (!open || !demande) return
    setLoadingCalc(true)
    supabase.functions.invoke('calculate-remboursement', { body: { demandeId: demande.id } })
      .then(({ data, error }) => {
        if (!error) {
          const r = data?.data ?? data
          setCalc(r)
          setMontantApprouve(String(r?.montantSuggere ?? demande.montant_demande))
        }
      })
      .finally(() => setLoadingCalc(false))
  }, [open, demande?.id])

  async function handleApprouver() {
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('approve-remboursement', {
        body: [{ demandeId: demande.id, montantApprouve: Number(montantApprouve), commentaire }],
      })
      if (error) throw error
      toast.success('Demande approuvée')
      setConfirmApprouver(false); onOpenChange(false); onDone()
    } catch { toast.error('Erreur lors de l\'approbation') }
    finally { setLoading(false) }
  }

  async function handleRejeter() {
    if (!motifRejet.trim()) { toast.error('Le motif est obligatoire'); return }
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('reject-remboursement', {
        body: { demandeId: demande.id, motif: motifRejet },
      })
      if (error) throw error
      toast.success('Demande rejetée')
      setConfirmRejeter(false); onOpenChange(false); onDone()
    } catch { toast.error('Erreur lors du rejet') }
    finally { setLoading(false) }
  }

  async function handleComplement() {
    if (!piecesRequises.length) { toast.error('Sélectionnez au moins une pièce'); return }
    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('request-complement', {
        body: { demandeId: demande.id, piecesRequises, messagePersonnalise: msgComplement || undefined },
      })
      if (error) throw error
      toast.success('Demande de complément envoyée')
      setShowComplement(false); onOpenChange(false); onDone()
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  const typeCfg = TYPE_CONFIG[demande.type] ?? TYPE_CONFIG.autre

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Traitement — ${demande.reference}`} size="xl">
      <div className="space-y-s-5 max-h-[80vh] overflow-y-auto pr-s-1">

        {/* En-tête */}
        <div className="flex items-center gap-s-3 rounded-xl border border-line bg-surface-2 p-s-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
            {demande.adherent_nom.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink">{demande.adherent_nom}</p>
            <p className="text-micro text-ink-3 font-mono">{demande.numero_contrat}</p>
          </div>
          <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${typeCfg.color}`}>
            {typeCfg.label}
          </span>
          <StatusBadge status={demande.statut} size="sm" />
        </div>

        {/* Documents justificatifs */}
        <section>
          <h3 className="mb-s-2 text-small font-semibold text-ink">Documents justificatifs</h3>
          {demande.documents.length === 0 ? (
            <p className="text-small text-ink-3">Aucun document joint</p>
          ) : (
            <div className="flex flex-wrap gap-s-2">
              {demande.documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setPreviewDoc(doc)}
                  className="flex items-center gap-s-2 rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink hover:bg-surface-2 transition-colors"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  {doc.nom}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Aperçu document */}
        {previewDoc && (
          <div className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-s-3 py-s-2">
              <p className="text-small font-medium text-ink">{previewDoc.nom}</p>
              <div className="flex gap-s-2">
                <a href={previewDoc.url} download className="text-small text-primary hover:underline">Télécharger</a>
                <button onClick={() => setPreviewDoc(null)} className="text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {previewDoc.type.startsWith('image/') ? (
              <img src={previewDoc.url} alt={previewDoc.nom} className="max-h-64 w-full object-contain" />
            ) : (
              <iframe src={previewDoc.url} className="h-64 w-full" title={previewDoc.nom} />
            )}
          </div>
        )}

        {/* Calcul remboursement */}
        <section>
          <h3 className="mb-s-2 text-small font-semibold text-ink">Calcul de remboursement</h3>
          {loadingCalc ? (
            <div className="space-y-s-2">
              {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-surface-2 animate-pulse" />)}
            </div>
          ) : calc ? (
            <div className="rounded-xl border border-line bg-surface-2 p-s-4 space-y-s-3">
              <div className="grid grid-cols-2 gap-s-3 text-small">
                <div><p className="text-ink-3">Montant demandé</p><p className="font-semibold text-ink">{formatFCFA(calc.montantDemande)}</p></div>
                <div><p className="text-ink-3">Taux de couverture</p><p className="font-semibold text-ink">{calc.taux}%</p></div>
                <div><p className="text-ink-3">Montant calculé</p><p className="font-semibold text-ink">{formatFCFA(calc.montantCalcule)}</p></div>
                <div><p className="text-ink-3">Montant suggéré</p><p className="font-semibold text-emerald-600">{formatFCFA(calc.montantSuggere)}</p></div>
              </div>
              {/* Barre plafond */}
              <div>
                <div className="mb-s-1 flex justify-between text-micro text-ink-3">
                  <span>Plafond {calc.categorie} utilisé</span>
                  <span>{formatFCFA(calc.plafondUtilise)} / {formatFCFA(calc.plafondCategorie)}</span>
                </div>
                <div className="h-2 rounded-full bg-surface">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${calc.plafondCategorie ? (calc.plafondUtilise / calc.plafondCategorie) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-s-1 text-micro text-ink-3">Restant : <span className="font-semibold text-ink">{formatFCFA(calc.plafondRestant)}</span></p>
              </div>
            </div>
          ) : (
            <p className="text-small text-ink-3">Calcul indisponible</p>
          )}
        </section>

        {/* Section décision */}
        {['en_attente', 'en_instruction'].includes(demande.statut) && (
          <section>
            <h3 className="mb-s-2 text-small font-semibold text-ink">Décision</h3>
            <div className="space-y-s-3">
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Montant approuvé (FCFA)</label>
                <input
                  type="number"
                  value={montantApprouve}
                  onChange={e => setMontantApprouve(e.target.value)}
                  min={0}
                  max={demande.montant_demande}
                  className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Commentaire (optionnel)</label>
                <textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-s-2">
                <Button
                  variant="primary"
                  leftIcon={<CheckCircle className="h-4 w-4" />}
                  disabled={!montantApprouve || Number(montantApprouve) <= 0}
                  onClick={() => setConfirmApprouver(true)}
                >
                  Approuver
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => setConfirmRejeter(true)}
                >
                  Rejeter
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Paperclip className="h-4 w-4" />}
                  onClick={() => setShowComplement(true)}
                >
                  Demander pièce
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ConfirmModals */}
      <ConfirmModal
        open={confirmApprouver}
        onOpenChange={setConfirmApprouver}
        title="Approuver la demande"
        message={`Approuver ${demande.reference} pour ${formatFCFA(Number(montantApprouve) || 0)} ? Le patient sera notifié.`}
        confirmLabel="Approuver"
        variant="primary"
        loading={loading}
        onConfirm={handleApprouver}
      />
      <ConfirmModal
        open={confirmRejeter}
        onOpenChange={setConfirmRejeter}
        title="Rejeter la demande"
        message=""
        confirmLabel="Rejeter"
        variant="danger"
        loading={loading}
        onConfirm={handleRejeter}
      >
        <div className="space-y-s-2 pb-s-2">
          <p className="text-small text-red-800">Rejet de la demande {demande.reference}. Le patient sera notifié avec le motif.</p>
          <textarea
            placeholder="Motif de rejet (obligatoire)…"
            value={motifRejet}
            onChange={e => setMotifRejet(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
      </ConfirmModal>

      {/* Modal complément */}
      <Modal open={showComplement} onOpenChange={setShowComplement} title="Demander une pièce complémentaire" size="md">
        <div className="space-y-s-3">
          <div>
            <p className="mb-s-2 text-small font-medium text-ink">Pièces requises *</p>
            <div className="flex flex-wrap gap-s-2">
              {PIECES_POSSIBLES.map(p => (
                <button
                  key={p}
                  onClick={() => setPiecesRequises(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                  className={`rounded-full px-s-3 py-s-1 text-micro font-medium transition-colors ${
                    piecesRequises.includes(p) ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink hover:bg-surface-3'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Message personnalisé (optionnel)</label>
            <textarea
              value={msgComplement}
              onChange={e => setMsgComplement(e.target.value)}
              rows={3}
              placeholder="Message envoyé au patient…"
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowComplement(false)}>Annuler</Button>
            <Button variant="primary" loading={loading} disabled={!piecesRequises.length} onClick={handleComplement} leftIcon={<Send className="h-4 w-4" />}>
              Envoyer
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

// ── Filtres panel ─────────────────────────────────────────────────────────────

interface Filtres {
  search: string
  types: DemandeType[]
  periodeDebut: string
  periodeFin: string
  montantMin: string
  montantMax: string
  statuts: string[]
}

function initFiltres(): Filtres {
  return { search: '', types: [], periodeDebut: '', periodeFin: '', montantMin: '', montantMax: '', statuts: [] }
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleDemandesPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [subTab, setSubTab] = useState<SubTab>('a_traiter')
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [filtres, setFiltres] = useState<Filtres>(initFiltres())
  const [showFiltres, setShowFiltres] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [traitementDemande, setTraitementDemande] = useState<Demande | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)

  const load = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoading(true)
    try {
      const { data } = await db
        .from('remboursement_demandes')
        .select(`
          id, reference, statut, categorie, montant_demande, montant_approuve,
          date_soin, created_at, contrat_id, adherent_id,
          prestataire_nom,
          profiles!remboursement_demandes_adherent_id_fkey(full_name, avatar_url),
          contrats!remboursement_demandes_contrat_id_fkey(numero_contrat),
          documents_demande(id, nom, url, type)
        `)
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: true })
        .limit(200)

      const rows: Demande[] = (data ?? []).map((d: any) => ({
        id: d.id,
        reference: d.reference,
        adherent_nom: d.profiles?.full_name ?? 'Adhérent',
        adherent_avatar: d.profiles?.avatar_url ?? null,
        numero_contrat: d.contrats?.numero_contrat ?? '',
        type: d.categorie ?? 'autre',
        praticien: d.prestataire_nom ?? 'N/A',
        date_soin: d.date_soin,
        created_at: d.created_at,
        montant_demande: d.montant_demande ?? 0,
        montant_approuve: d.montant_approuve,
        statut: d.statut,
        contrat_id: d.contrat_id,
        adherent_id: d.adherent_id,
        documents: d.documents_demande ?? [],
      }))
      setDemandes(rows)
    } finally {
      setLoading(false) }
  }, [mutuelle?.id])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!mutuelle?.id) return
    const ch = supabase.channel('demandes-' + mutuelle.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'remboursement_demandes',
        filter: `mutuelle_id=eq.${mutuelle.id}`,
      }, () => load())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'remboursement_demandes',
        filter: `mutuelle_id=eq.${mutuelle.id}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [mutuelle?.id, load])

  const bySubTab = useMemo(() => ({
    a_traiter: demandes.filter(d => d.statut === 'en_attente'),
    en_cours:  demandes.filter(d => d.statut === 'en_instruction'),
    historique: demandes.filter(d => ['approuve', 'refuse', 'rembourse', 'complement_requis'].includes(d.statut)),
  }), [demandes])

  const filtered = useMemo(() => {
    let rows = bySubTab[subTab]
    const q = filtres.search.toLowerCase()
    if (q) rows = rows.filter(d =>
      d.reference.toLowerCase().includes(q) ||
      d.adherent_nom.toLowerCase().includes(q) ||
      d.numero_contrat.toLowerCase().includes(q)
    )
    if (filtres.types.length) rows = rows.filter(d => filtres.types.includes(d.type as DemandeType))
    if (filtres.statuts.length) rows = rows.filter(d => filtres.statuts.includes(d.statut))
    if (filtres.periodeDebut) rows = rows.filter(d => d.created_at >= filtres.periodeDebut)
    if (filtres.periodeFin) rows = rows.filter(d => d.created_at <= filtres.periodeFin + 'T23:59:59')
    if (filtres.montantMin) rows = rows.filter(d => d.montant_demande >= Number(filtres.montantMin))
    if (filtres.montantMax) rows = rows.filter(d => d.montant_demande <= Number(filtres.montantMax))
    return rows
  }, [bySubTab, subTab, filtres])

  // Ouvrir en_instruction quand on clique "Traiter"
  async function openTraitement(demande: Demande) {
    if (demande.statut === 'en_attente') {
      await db.from('remboursement_demandes').update({ statut: 'en_instruction' }).eq('id', demande.id)
      setDemandes(prev => prev.map(d => d.id === demande.id ? { ...d, statut: 'en_instruction' } : d))
    }
    setTraitementDemande(demande)
  }

  // Batch approbation
  async function handleBatchApprouver() {
    const ids = [...selected]
    const toApprove = demandes.filter(d => ids.includes(d.id) && ['en_attente', 'en_instruction'].includes(d.statut))
    if (!toApprove.length) { toast.error('Aucune demande éligible sélectionnée'); return }
    setLoadingBatch(true)
    try {
      const { error } = await supabase.functions.invoke('approve-remboursement', {
        body: toApprove.map(d => ({ demandeId: d.id, montantApprouve: d.montant_demande })),
      })
      if (error) throw error
      toast.success(`${toApprove.length} demande(s) approuvée(s)`)
      setSelected(new Set())
      load()
    } catch { toast.error('Erreur approbation groupée') }
    finally { setLoadingBatch(false) }
  }

  function exportCSV() {
    const headers = ['N° Demande', 'Adhérent', 'N° Contrat', 'Type', 'Praticien', 'Date soin', 'Montant demandé', 'Montant approuvé', 'Statut']
    const lines = filtered.map(d => [
      d.reference, d.adherent_nom, d.numero_contrat,
      TYPE_CONFIG[d.type]?.label ?? d.type,
      d.praticien,
      d.date_soin ? format(new Date(d.date_soin), 'dd/MM/yyyy') : '',
      d.montant_demande, d.montant_approuve ?? '',
      d.statut,
    ].join(';'))
    const csv = [headers.join(';'), ...lines].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `demandes-${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function toggleSelectAll() {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(d => d.id)))
  }

  const nbAttente = bySubTab.a_traiter.length
  const nbCours = bySubTab.en_cours.length
  const nbSlaDepasse = bySubTab.a_traiter.filter(d => differenceInHours(new Date(), new Date(d.created_at)) >= 72).length

  const TAB_CFG: { id: SubTab; label: string; count: number; alert?: boolean }[] = [
    { id: 'a_traiter',  label: 'À traiter',   count: nbAttente,  alert: nbSlaDepasse > 0 },
    { id: 'en_cours',   label: 'En cours',     count: nbCours },
    { id: 'historique', label: 'Historique',   count: bySubTab.historique.length },
  ]

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      {/* Header */}
      <div className="flex flex-col gap-s-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Demandes de remboursement</h1>
          {nbSlaDepasse > 0 && (
            <p className="flex items-center gap-s-1 text-small text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {nbSlaDepasse} demande{nbSlaDepasse > 1 ? 's' : ''} dépassent le SLA de 72h
            </p>
          )}
        </div>
        <div className="flex gap-s-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportCSV}>
            Exporter CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Filter className="h-4 w-4" />}
            onClick={() => setShowFiltres(f => !f)}
          >
            Filtres
          </Button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-s-1 border-b border-line">
        {TAB_CFG.map(t => (
          <button
            key={t.id}
            onClick={() => { setSubTab(t.id); setSelected(new Set()) }}
            className={`flex items-center gap-s-2 px-s-4 py-s-2.5 text-small font-medium border-b-2 -mb-px transition-colors ${
              subTab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-s-1.5 py-s-0.5 text-micro font-bold ${
                t.alert ? 'bg-red-100 text-red-700' : subTab === t.id ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-ink-3'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres panel */}
      <AnimatePresence>
        {showFiltres && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-xl border border-line bg-surface-2 p-s-4"
          >
            <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2 md:grid-cols-3">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  placeholder="Réf., adhérent, N° contrat…"
                  value={filtres.search}
                  onChange={e => setFiltres(f => ({ ...f, search: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {/* Types */}
              <div>
                <p className="mb-s-1 text-micro font-medium text-ink-3">Type de soin</p>
                <div className="flex flex-wrap gap-s-1">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                    <button key={k}
                      onClick={() => setFiltres(f => ({
                        ...f,
                        types: f.types.includes(k as DemandeType)
                          ? f.types.filter(t => t !== k)
                          : [...f.types, k as DemandeType],
                      }))}
                      className={`rounded-full px-s-2 py-s-0.5 text-micro font-medium ${filtres.types.includes(k as DemandeType) ? 'bg-primary text-primary-fg' : v.color}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Période */}
              <div className="flex gap-s-2">
                <div className="flex-1">
                  <p className="mb-s-1 text-micro font-medium text-ink-3">Période du</p>
                  <input type="date" value={filtres.periodeDebut}
                    onChange={e => setFiltres(f => ({ ...f, periodeDebut: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <p className="mb-s-1 text-micro font-medium text-ink-3">au</p>
                  <input type="date" value={filtres.periodeFin}
                    onChange={e => setFiltres(f => ({ ...f, periodeFin: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {/* Montant */}
              <div className="flex gap-s-2">
                <div className="flex-1">
                  <p className="mb-s-1 text-micro font-medium text-ink-3">Montant min (FCFA)</p>
                  <input type="number" value={filtres.montantMin} onChange={e => setFiltres(f => ({ ...f, montantMin: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex-1">
                  <p className="mb-s-1 text-micro font-medium text-ink-3">Montant max (FCFA)</p>
                  <input type="number" value={filtres.montantMax} onChange={e => setFiltres(f => ({ ...f, montantMax: e.target.value }))}
                    className="w-full rounded-lg border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {/* Reset */}
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => setFiltres(initFiltres())} leftIcon={<X className="h-4 w-4" />}>
                  Réinitialiser
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions groupées */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-s-3 rounded-xl border border-primary/30 bg-primary/5 px-s-4 py-s-2"
        >
          <p className="text-small font-medium text-ink">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</p>
          <Button
            variant="primary"
            size="sm"
            loading={loadingBatch}
            leftIcon={<CheckCircle className="h-4 w-4" />}
            onClick={handleBatchApprouver}
          >
            Approuver la sélection
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportCSV}>
            Exporter
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-ink-3 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Tableau */}
      {loading ? (
        <div className="space-y-s-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          message={subTab === 'a_traiter' ? 'Aucune demande en attente' : subTab === 'en_cours' ? 'Aucune demande en cours' : 'Aucun historique'}
          description="Les nouvelles demandes apparaissent ici en temps réel."
        />
      ) : (
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full text-small">
            <thead className="bg-surface-2 border-b border-line">
              <tr>
                <th className="px-s-3 py-s-3 w-10">
                  <button onClick={toggleSelectAll}>
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4 text-ink-3" />
                    }
                  </button>
                </th>
                {['N° Demande', 'Adhérent', 'Type', 'Praticien', 'Date soin', 'Montant', 'Statut / SLA', 'Action'].map(h => (
                  <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(d => {
                const hours = differenceInHours(new Date(), new Date(d.created_at))
                const isSlaDep = hours >= 72 && d.statut === 'en_attente'
                const typeCfg = TYPE_CONFIG[d.type] ?? TYPE_CONFIG.autre
                return (
                  <tr key={d.id} className={`transition-colors hover:bg-surface-2/50 ${isSlaDep ? 'bg-red-50/50' : ''}`}>
                    <td className="px-s-3 py-s-3">
                      <button onClick={() => toggleSelect(d.id)}>
                        {selected.has(d.id)
                          ? <CheckSquare className="h-4 w-4 text-primary" />
                          : <Square className="h-4 w-4 text-ink-3" />
                        }
                      </button>
                    </td>
                    <td className="px-s-3 py-s-3">
                      <span className="font-mono text-micro text-ink-2">{d.reference}</span>
                    </td>
                    <td className="px-s-3 py-s-3">
                      <div className="flex items-center gap-s-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-micro font-bold text-primary">
                          {d.adherent_nom.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate max-w-[120px]">{d.adherent_nom}</p>
                          <p className="font-mono text-micro text-ink-3">{d.numero_contrat}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-s-3 py-s-3">
                      <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${typeCfg.color}`}>
                        {typeCfg.label}
                      </span>
                    </td>
                    <td className="px-s-3 py-s-3 text-ink-3 max-w-[100px] truncate">{d.praticien}</td>
                    <td className="px-s-3 py-s-3 text-ink-3">
                      {d.date_soin ? format(new Date(d.date_soin), 'd MMM', { locale: fr }) : '—'}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <p className="font-semibold text-ink">{formatFCFA(d.montant_demande)}</p>
                      {d.montant_approuve != null && (
                        <p className="text-micro text-emerald-600">→ {formatFCFA(d.montant_approuve)}</p>
                      )}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <div className="space-y-s-1">
                        <StatusBadge status={d.statut} size="sm" />
                        {d.statut === 'en_attente' && <SlaTimer createdAt={d.created_at} />}
                      </div>
                    </td>
                    <td className="px-s-3 py-s-3">
                      <Button
                        variant={['en_attente', 'en_instruction'].includes(d.statut) ? 'primary' : 'secondary'}
                        size="sm"
                        leftIcon={['en_attente', 'en_instruction'].includes(d.statut) ? <CheckCircle className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        onClick={() => openTraitement(d)}
                      >
                        {['en_attente', 'en_instruction'].includes(d.statut) ? 'Traiter' : 'Voir'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal traitement */}
      {traitementDemande && (
        <TraitementModal
          demande={traitementDemande}
          open={!!traitementDemande}
          onOpenChange={v => { if (!v) setTraitementDemande(null) }}
          onDone={() => { setTraitementDemande(null); load() }}
        />
      )}
    </div>
  )
}
