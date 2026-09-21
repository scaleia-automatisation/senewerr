import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Send, Truck, PackageCheck, ChevronDown, ChevronUp,
  X, Search, Trash2, AlertTriangle, Clock, CheckCircle2,
  Circle, ChevronRight, RefreshCw, Loader2, FileText,
  PackagePlus, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type CommStatut = 'brouillon' | 'envoyee' | 'confirmee' | 'en_livraison' | 'livree' | 'annulee'
type TabKey = 'traiter' | 'envoyees' | 'livraison' | 'recues' | 'annulees'

interface Fournisseur {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  delai_livraison_jours: number | null
  conditions_paiement: string | null
  actif: boolean
}

interface LigneCommande {
  id: string
  commande_id: string
  medicament_catalogue_id: string | null
  nom_medicament: string
  quantite_commandee: number
  quantite_livree: number | null
  prix_unitaire: number | null
}

interface Commande {
  id: string
  fournisseur_id: string
  statut: CommStatut
  date_commande: string
  date_livraison_prevue: string | null
  date_livraison_reelle: string | null
  montant_total: number | null
  notes: string | null
  created_by: string | null
  fournisseur_nom?: string
  fournisseur_email?: string
  lignes?: LigneCommande[]
}

interface NewLigne {
  key: string
  medicament_catalogue_id: string | null
  nom_medicament: string
  quantite_commandee: number
  prix_unitaire: number
}

interface ReceptionLine {
  ligne_id: string
  nom_medicament: string
  quantite_commandee: number
  quantite_livree: string
  lot: string
  date_peremption: string
  ecart_motif: string
}

interface CatEntry {
  id: string
  nom_commercial: string
  dci: string | null
  forme: string | null
  dosage: string | null
  prix_reference: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_STATUTS: Record<TabKey, CommStatut[]> = {
  traiter: ['brouillon', 'confirmee'],
  envoyees: ['envoyee'],
  livraison: ['en_livraison'],
  recues: ['livree'],
  annulees: ['annulee'],
}

const TAB_LABELS: Record<TabKey, string> = {
  traiter: 'À traiter',
  envoyees: 'Envoyées',
  livraison: 'En livraison',
  recues: 'Reçues',
  annulees: 'Annulées',
}

const STATUT_BADGES: Record<CommStatut, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-ink/10 text-ink-2' },
  envoyee: { label: 'Envoyée', cls: 'bg-blue-100 text-blue-700' },
  confirmee: { label: 'Confirmée', cls: 'bg-indigo-100 text-indigo-700' },
  en_livraison: { label: 'En livraison', cls: 'bg-amber-100 text-amber-700' },
  livree: { label: 'Livrée', cls: 'bg-green-100 text-green-700' },
  annulee: { label: 'Annulée', cls: 'bg-red-100 text-red-700' },
}

const TIMELINE_STEPS: CommStatut[] = ['brouillon', 'envoyee', 'confirmee', 'en_livraison', 'livree']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(Math.round(n)) + ' FCFA'
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return differenceInDays(parseISO(dateStr), new Date())
}

function stepIndex(statut: CommStatut): number {
  return TIMELINE_STEPS.indexOf(statut)
}

let keyCounter = 0
function newKey() { return `k${++keyCounter}` }

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
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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

export default function PharmacyCommandesPage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [tab, setTab] = useState<TabKey>('traiter')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loadingCommandes, setLoadingCommandes] = useState(true)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingLignes, setLoadingLignes] = useState<string | null>(null)

  // ── New / Edit order drawer ────────────────────────────────────────────────
  const [showDrawer, setShowDrawer] = useState(false)
  const [editCommandeId, setEditCommandeId] = useState<string | null>(null)
  const [selFournisseur, setSelFournisseur] = useState('')
  const [orderDateLivraison, setOrderDateLivraison] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [lignes, setLignes] = useState<NewLigne[]>([])
  const [savingOrder, setSavingOrder] = useState(false)
  const [sendingOrder, setSendingOrder] = useState(false)
  const [fillingAlerts, setFillingAlerts] = useState(false)

  // Catalogue search in drawer
  const [catSearch, setCatSearch] = useState('')
  const [catResults, setCatResults] = useState<CatEntry[]>([])

  // ── Reception modal ────────────────────────────────────────────────────────
  const [receptionCommande, setReceptionCommande] = useState<Commande | null>(null)
  const [receptionLines, setReceptionLines] = useState<ReceptionLine[]>([])
  const [receptionNotes, setReceptionNotes] = useState('')
  const [savingReception, setSavingReception] = useState(false)

  // ── Detail expanded ────────────────────────────────────────────────────────
  const [detailCommande, setDetailCommande] = useState<Commande | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const loadCommandes = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingCommandes(true)
    const { data, error } = await db
      .from('commandes_fournisseurs')
      .select('id, fournisseur_id, statut, date_commande, date_livraison_prevue, date_livraison_reelle, montant_total, notes, created_by')
      .eq('pharmacie_id', pharmacie.id)
      .order('date_commande', { ascending: false })
      .limit(200)
    if (error) { toast.error('Erreur de chargement.'); setLoadingCommandes(false); return }

    // Fetch fournisseur names for all unique fournisseur_ids
    const fIds = [...new Set((data ?? []).map((c: any) => c.fournisseur_id).filter(Boolean))]
    let fMap = new Map<string, { nom: string; email: string | null }>()
    if (fIds.length) {
      const { data: fData } = await db.from('fournisseurs').select('id, nom, email').in('id', fIds)
      fMap = new Map((fData ?? []).map((f: any) => [f.id, { nom: f.nom, email: f.email }]))
    }

    setCommandes((data ?? []).map((c: any) => ({
      ...c,
      fournisseur_nom: fMap.get(c.fournisseur_id)?.nom ?? '—',
      fournisseur_email: fMap.get(c.fournisseur_id)?.email ?? null,
    })))
    setLoadingCommandes(false)
  }, [pharmacie?.id])

  const loadFournisseurs = useCallback(async () => {
    const { data } = await db.from('fournisseurs').select('*').eq('actif', true).order('nom')
    setFournisseurs(data ?? [])
  }, [])

  useEffect(() => { loadCommandes(); loadFournisseurs() }, [loadCommandes, loadFournisseurs])

  async function loadLignesFor(commandeId: string): Promise<LigneCommande[]> {
    const { data } = await db
      .from('lignes_commande')
      .select('id, commande_id, medicament_catalogue_id, nom_medicament, quantite_commandee, quantite_livree, prix_unitaire')
      .eq('commande_id', commandeId)
      .order('nom_medicament')
    return data ?? []
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CATALOGUE SEARCH
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (catSearch.length < 2) { setCatResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await db
        .from('medicaments_catalogue')
        .select('id, nom_commercial, dci, forme, dosage, prix_reference')
        .or(`nom_commercial.ilike.%${catSearch}%,dci.ilike.%${catSearch}%`)
        .limit(8)
      setCatResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [catSearch])

  function addLigneFromCat(item: CatEntry) {
    setLignes(prev => [...prev, {
      key: newKey(),
      medicament_catalogue_id: item.id,
      nom_medicament: item.nom_commercial + (item.dci ? ` (${item.dci})` : ''),
      quantite_commandee: 1,
      prix_unitaire: item.prix_reference ?? 0,
    }])
    setCatSearch(''); setCatResults([])
  }

  function addLigneManual() {
    setLignes(prev => [...prev, { key: newKey(), medicament_catalogue_id: null, nom_medicament: '', quantite_commandee: 1, prix_unitaire: 0 }])
  }

  function updateLigne(key: string, field: keyof Omit<NewLigne, 'key'>, value: string | number) {
    setLignes(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l))
  }

  function removeLigne(key: string) {
    setLignes(prev => prev.filter(l => l.key !== key))
  }

  const total = useMemo(
    () => lignes.reduce((s, l) => s + l.quantite_commandee * l.prix_unitaire, 0),
    [lignes]
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // FILL FROM ALERTS
  // ─────────────────────────────────────────────────────────────────────────────

  async function fillFromAlerts() {
    if (!pharmacie?.id) return
    setFillingAlerts(true)
    const { data } = await db
      .from('stock_medicaments')
      .select('id, nom, medicament_id, quantite, seuil_alerte, prix_achat')
      .eq('pharmacie_id', pharmacie.id)
      .is('deleted_at', null)
      .limit(500)
    const under = (data ?? []).filter((s: any) => s.quantite <= s.seuil_alerte)
    const existing = new Set(lignes.map(l => l.nom_medicament))
    const toAdd: NewLigne[] = under
      .filter((s: any) => !existing.has(s.nom))
      .map((s: any) => ({
        key: newKey(),
        medicament_catalogue_id: s.medicament_id ?? null,
        nom_medicament: s.nom,
        quantite_commandee: Math.max(1, s.seuil_alerte * 2 - s.quantite),
        prix_unitaire: s.prix_achat ?? 0,
      }))
    setLignes(prev => [...prev, ...toAdd])
    toast.success(`${toAdd.length} médicament(s) ajouté(s) depuis les alertes stock.`)
    setFillingAlerts(false)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE / SEND ORDER
  // ─────────────────────────────────────────────────────────────────────────────

  async function saveOrder(send: boolean) {
    if (!pharmacie?.id || !selFournisseur) { toast.error('Sélectionnez un fournisseur.'); return }
    if (!lignes.length) { toast.error('Ajoutez au moins un médicament.'); return }
    if (lignes.some(l => !l.nom_medicament.trim())) { toast.error('Tous les médicaments doivent avoir un nom.'); return }
    if (send) setSendingOrder(true); else setSavingOrder(true)

    const newStatut: CommStatut = send ? 'envoyee' : 'brouillon'
    const montant = lignes.reduce((s, l) => s + l.quantite_commandee * l.prix_unitaire, 0)

    let commandeId = editCommandeId

    if (editCommandeId) {
      // Update existing brouillon
      const { error } = await db.from('commandes_fournisseurs').update({
        fournisseur_id: selFournisseur,
        statut: newStatut,
        date_livraison_prevue: orderDateLivraison || null,
        notes: orderNotes || null,
        montant_total: montant,
      }).eq('id', editCommandeId)
      if (error) { toast.error('Erreur de mise à jour.'); setSavingOrder(false); setSendingOrder(false); return }
      // Delete existing lines then re-insert
      await db.from('lignes_commande').delete().eq('commande_id', editCommandeId)
    } else {
      // Insert new
      const { data: ins, error } = await db.from('commandes_fournisseurs').insert({
        pharmacie_id: pharmacie.id,
        fournisseur_id: selFournisseur,
        statut: newStatut,
        date_commande: new Date().toISOString(),
        date_livraison_prevue: orderDateLivraison || null,
        notes: orderNotes || null,
        montant_total: montant,
        created_by: profile?.id,
      }).select('id').single()
      if (error) { toast.error('Erreur de création.'); setSavingOrder(false); setSendingOrder(false); return }
      commandeId = ins.id
    }

    // Insert lines
    const linesPayload = lignes.map(l => ({
      commande_id: commandeId,
      medicament_catalogue_id: l.medicament_catalogue_id,
      nom_medicament: l.nom_medicament.trim(),
      quantite_commandee: l.quantite_commandee,
      quantite_livree: null,
      prix_unitaire: l.prix_unitaire,
    }))
    await db.from('lignes_commande').insert(linesPayload)

    if (send && commandeId) {
      await supabase.functions.invoke('send-order-email', {
        body: { commande_id: commandeId, pharmacie_id: pharmacie.id },
      })
      toast.success('Commande envoyée au fournisseur.')
    } else {
      toast.success('Brouillon enregistré.')
    }

    setSavingOrder(false); setSendingOrder(false)
    setShowDrawer(false); resetDrawer()
    loadCommandes()
  }

  function resetDrawer() {
    setEditCommandeId(null); setSelFournisseur(''); setOrderDateLivraison('')
    setOrderNotes(''); setLignes([]); setCatSearch(''); setCatResults([])
  }

  async function openEdit(commande: Commande) {
    setLoadingLignes(commande.id)
    const existingLignes = await loadLignesFor(commande.id)
    setEditCommandeId(commande.id)
    setSelFournisseur(commande.fournisseur_id)
    setOrderDateLivraison(commande.date_livraison_prevue ? commande.date_livraison_prevue.split('T')[0] : '')
    setOrderNotes(commande.notes ?? '')
    setLignes(existingLignes.map(l => ({
      key: newKey(),
      medicament_catalogue_id: l.medicament_catalogue_id,
      nom_medicament: l.nom_medicament,
      quantite_commandee: l.quantite_commandee,
      prix_unitaire: l.prix_unitaire ?? 0,
    })))
    setLoadingLignes(null)
    setShowDrawer(true)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHANGE STATUT
  // ─────────────────────────────────────────────────────────────────────────────

  async function changeStatut(commandeId: string, newStatut: CommStatut) {
    const updates: Record<string, any> = { statut: newStatut }
    if (newStatut === 'livree') updates.date_livraison_reelle = new Date().toISOString()
    await db.from('commandes_fournisseurs').update(updates).eq('id', commandeId)
    toast.success(`Commande passée en « ${STATUT_BADGES[newStatut].label} ».`)
    loadCommandes()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECEPTION
  // ─────────────────────────────────────────────────────────────────────────────

  async function openReception(commande: Commande) {
    setLoadingLignes(commande.id)
    const lignesData = await loadLignesFor(commande.id)
    setReceptionLines(lignesData.map(l => ({
      ligne_id: l.id,
      nom_medicament: l.nom_medicament,
      quantite_commandee: l.quantite_commandee,
      quantite_livree: String(l.quantite_commandee),
      lot: '',
      date_peremption: '',
      ecart_motif: '',
    })))
    setReceptionNotes('')
    setReceptionCommande(commande)
    setLoadingLignes(null)
  }

  function updateReceptionLine(index: number, field: keyof ReceptionLine, value: string) {
    setReceptionLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  const hasEcarts = receptionLines.some(l => {
    const qLiv = parseInt(l.quantite_livree) || 0
    return qLiv !== l.quantite_commandee
  })

  async function confirmReception() {
    if (!receptionCommande || !pharmacie?.id) return
    // Validate
    for (const l of receptionLines) {
      const q = parseInt(l.quantite_livree)
      if (isNaN(q) || q < 0) { toast.error(`Quantité invalide pour "${l.nom_medicament}".`); return }
    }
    if (hasEcarts) {
      const missingMotif = receptionLines.some(l => {
        const q = parseInt(l.quantite_livree) || 0
        return q !== l.quantite_commandee && !l.ecart_motif.trim()
      })
      if (missingMotif) { toast.error('Précisez le motif pour chaque écart.'); return }
    }
    setSavingReception(true)

    const lines = receptionLines.map(l => ({
      ligne_id: l.ligne_id,
      nom_medicament: l.nom_medicament,
      quantite_livree: parseInt(l.quantite_livree) || 0,
      lot_numero: l.lot.trim() || null,
      date_peremption: l.date_peremption || null,
      ecart_motif: l.ecart_motif.trim() || null,
    }))

    // INSERT reception record
    const { data: recData, error: recErr } = await db.from('receptions').insert({
      commande_id: receptionCommande.id,
      pharmacien_id: profile?.id,
      date_reception: new Date().toISOString(),
      medicaments_recus: lines,
      ecarts: hasEcarts,
      notes_ecarts: receptionNotes.trim() || null,
    }).select('id').single()

    if (recErr) { toast.error('Erreur lors de la réception.'); setSavingReception(false); return }

    // Call process-reception EF
    const { error: efErr } = await supabase.functions.invoke('process-reception', {
      body: {
        commande_id: receptionCommande.id,
        pharmacie_id: pharmacie.id,
        pharmacien_id: profile?.id,
        reception_id: recData.id,
        lines,
        ecarts: hasEcarts,
        notes_ecarts: receptionNotes.trim() || null,
      },
    })

    if (efErr) {
      toast.error('Réception enregistrée mais mise à jour du stock a échoué. Contactez l\'administrateur.')
    } else {
      toast.success('Réception validée. Stock mis à jour.')
    }

    setSavingReception(false)
    setReceptionCommande(null)
    loadCommandes()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPAND + DETAIL
  // ─────────────────────────────────────────────────────────────────────────────

  async function toggleExpand(commande: Commande) {
    if (expandedId === commande.id) { setExpandedId(null); return }
    if (!commande.lignes) {
      setLoadingLignes(commande.id)
      const lignesData = await loadLignesFor(commande.id)
      setCommandes(prev => prev.map(c => c.id === commande.id ? { ...c, lignes: lignesData } : c))
      setLoadingLignes(null)
    }
    setExpandedId(commande.id)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FILTERED
  // ─────────────────────────────────────────────────────────────────────────────

  const tabStatuts = TAB_STATUTS[tab]
  const filtered = useMemo(
    () => commandes.filter(c => tabStatuts.includes(c.statut)),
    [commandes, tabStatuts]
  )

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { traiter: 0, envoyees: 0, livraison: 0, recues: 0, annulees: 0 }
    for (const key of Object.keys(counts) as TabKey[]) {
      counts[key] = commandes.filter(c => TAB_STATUTS[key].includes(c.statut)).length
    }
    return counts
  }, [commandes])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Commande card
  // ─────────────────────────────────────────────────────────────────────────────

  function renderCard(commande: Commande) {
    const badge = STATUT_BADGES[commande.statut]
    const days = daysUntil(commande.date_livraison_prevue)
    const isExpanded = expandedId === commande.id
    const isLoadingThis = loadingLignes === commande.id

    return (
      <motion.div
        key={commande.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border border-line bg-surface overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start gap-s-3 px-s-4 py-s-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-s-2 mb-s-1">
              <span className="font-semibold text-ink">{commande.fournisseur_nom}</span>
              <span className="font-mono text-micro text-ink-3">#{commande.id.slice(0, 8).toUpperCase()}</span>
              <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-s-3 text-micro text-ink-3">
              <span>Créée le {format(parseISO(commande.date_commande), 'dd/MM/yyyy', { locale: fr })}</span>
              {commande.date_livraison_prevue && (
                <span className={days !== null && days <= 3 && days >= 0 ? 'text-amber-600 font-semibold' : ''}>
                  {days !== null && days <= 3 && days >= 0
                    ? `⚠ Livraison dans ${days === 0 ? 'aujourd\'hui' : `${days} jour(s)`}`
                    : `Livraison prévue le ${format(parseISO(commande.date_livraison_prevue), 'dd/MM/yyyy', { locale: fr })}`}
                </span>
              )}
              {commande.montant_total != null && (
                <span className="font-medium text-ink-2">{formatFCFA(commande.montant_total)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-s-2 shrink-0">
            {commande.statut === 'brouillon' && (
              <>
                <Button size="sm" variant="secondary" leftIcon={<FileText className="h-3.5 w-3.5" />}
                  onClick={() => openEdit(commande)} loading={isLoadingThis}>
                  Modifier
                </Button>
                <Button size="sm" variant="primary" leftIcon={<Send className="h-3.5 w-3.5" />}
                  onClick={() => changeStatut(commande.id, 'envoyee')}>
                  Envoyer
                </Button>
              </>
            )}
            {(commande.statut === 'envoyee' || commande.statut === 'confirmee') && (
              <>
                <Button size="sm" variant="primary" leftIcon={<Truck className="h-3.5 w-3.5" />}
                  onClick={() => changeStatut(commande.id, 'en_livraison')}>
                  En livraison
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<XCircle className="h-3.5 w-3.5" />}
                  onClick={() => changeStatut(commande.id, 'annulee')}>
                  Annuler
                </Button>
              </>
            )}
            {commande.statut === 'en_livraison' && (
              <Button size="sm" variant="primary" leftIcon={<PackageCheck className="h-3.5 w-3.5" />}
                onClick={() => openReception(commande)} loading={isLoadingThis}>
                Réceptionner
              </Button>
            )}
            <button
              onClick={() => toggleExpand(commande)}
              className="rounded p-s-1.5 hover:bg-surface-2 text-ink-3"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Timeline */}
        {(commande.statut !== 'annulee') && (
          <div className="px-s-4 pb-s-3">
            <div className="flex items-center gap-0">
              {TIMELINE_STEPS.map((step, i) => {
                const done = stepIndex(commande.statut) >= i
                const current = stepIndex(commande.statut) === i
                const labels: Record<CommStatut, string> = {
                  brouillon: 'Brouillon', envoyee: 'Envoyée', confirmee: 'Confirmée',
                  en_livraison: 'En livraison', livree: 'Livrée', annulee: 'Annulée',
                }
                return (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${done ? 'bg-primary' : 'bg-line'}`}>
                        {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Circle className="h-4 w-4 text-ink-3" />}
                      </div>
                      <span className={`mt-s-0.5 text-micro whitespace-nowrap ${current ? 'font-bold text-primary' : done ? 'text-ink-2' : 'text-ink-3'}`}>
                        {labels[step]}
                      </span>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-s-1 ${stepIndex(commande.statut) > i ? 'bg-primary' : 'bg-line'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expanded lignes */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
              className="border-t border-line overflow-hidden"
            >
              {isLoadingThis ? (
                <div className="px-s-4 py-s-3"><Loader2 className="h-4 w-4 animate-spin text-ink-3" /></div>
              ) : (commande.lignes ?? []).length === 0 ? (
                <p className="px-s-4 py-s-3 text-small text-ink-3">Aucune ligne.</p>
              ) : (
                <table className="w-full text-small">
                  <thead className="bg-surface-2">
                    <tr>
                      {['Médicament', 'Qté commandée', 'Qté livrée', 'Prix unit.', 'Total'].map(h => (
                        <th key={h} className="px-s-4 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(commande.lignes ?? []).map(l => (
                      <tr key={l.id}>
                        <td className="px-s-4 py-s-2 font-medium text-ink">{l.nom_medicament}</td>
                        <td className="px-s-4 py-s-2 text-ink-2">{l.quantite_commandee}</td>
                        <td className="px-s-4 py-s-2">
                          {l.quantite_livree != null ? (
                            <span className={l.quantite_livree !== l.quantite_commandee ? 'text-amber-600 font-semibold' : 'text-green-600'}>
                              {l.quantite_livree}
                              {l.quantite_livree !== l.quantite_commandee && ' ⚠'}
                            </span>
                          ) : <span className="text-ink-3">—</span>}
                        </td>
                        <td className="px-s-4 py-s-2 text-ink-2">
                          {l.prix_unitaire != null ? formatFCFA(l.prix_unitaire) : '—'}
                        </td>
                        <td className="px-s-4 py-s-2 text-ink-2">
                          {l.prix_unitaire != null ? formatFCFA(l.quantite_commandee * l.prix_unitaire) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {commande.notes && (
                <p className="px-s-4 py-s-3 text-small text-ink-2 border-t border-line">
                  <strong>Notes :</strong> {commande.notes}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — New order drawer content
  // ─────────────────────────────────────────────────────────────────────────────

  function renderDrawerContent() {
    return (
      <div className="flex flex-col gap-s-4">
        {/* Fournisseur */}
        <div className="flex flex-col gap-s-1">
          <label className="text-small font-semibold text-ink">Fournisseur *</label>
          <select
            value={selFournisseur} onChange={e => setSelFournisseur(e.target.value)}
            className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— Sélectionner —</option>
            {fournisseurs.map(f => (
              <option key={f.id} value={f.id}>
                {f.nom}{f.delai_livraison_jours ? ` (livraison ~${f.delai_livraison_jours}j)` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Date livraison */}
        <div className="flex flex-col gap-s-1">
          <label className="text-small font-semibold text-ink">Date de livraison prévue</label>
          <input type="date" value={orderDateLivraison} onChange={e => setOrderDateLivraison(e.target.value)}
            className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {/* Lines */}
        <div className="flex items-center justify-between">
          <label className="text-small font-semibold text-ink">Lignes de commande</label>
          <div className="flex gap-s-2">
            <Button size="sm" variant="secondary" leftIcon={<AlertTriangle className="h-3.5 w-3.5" />}
              onClick={fillFromAlerts} loading={fillingAlerts}>
              Remplir depuis alertes stock
            </Button>
          </div>
        </div>

        {/* Catalog search */}
        <div className="relative">
          <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)}
            placeholder="Rechercher un médicament du catalogue (min. 2 car.)…"
            className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {catResults.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-s-1 rounded border border-line bg-surface shadow-lg">
              {catResults.map(item => (
                <button key={item.id} onClick={() => addLigneFromCat(item)}
                  className="flex w-full items-center gap-s-3 px-s-3 py-s-2 text-left hover:bg-surface-2">
                  <div>
                    <p className="text-small font-medium text-ink">{item.nom_commercial}</p>
                    <p className="text-micro text-ink-3">{[item.dci, item.forme, item.dosage].filter(Boolean).join(' · ')}</p>
                  </div>
                  {item.prix_reference != null && (
                    <span className="ml-auto text-small text-ink-2">{formatFCFA(item.prix_reference)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button size="sm" variant="ghost" leftIcon={<Plus className="h-4 w-4" />} onClick={addLigneManual} className="self-start">
          Ajouter manuellement
        </Button>

        {/* Lines table */}
        {lignes.length > 0 && (
          <div className="flex flex-col gap-s-2">
            {lignes.map(l => (
              <div key={l.key} className="flex items-center gap-s-2 rounded border border-line bg-surface-2 px-s-3 py-s-2">
                <input
                  type="text" value={l.nom_medicament} onChange={e => updateLigne(l.key, 'nom_medicament', e.target.value)}
                  placeholder="Médicament" className="flex-1 min-w-0 bg-transparent text-small text-ink focus:outline-none"
                />
                <input
                  type="number" min="1" value={l.quantite_commandee} onChange={e => updateLigne(l.key, 'quantite_commandee', parseInt(e.target.value) || 1)}
                  className="w-16 rounded border border-line bg-surface px-s-2 py-s-1 text-small text-center text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Quantité"
                />
                <input
                  type="number" min="0" value={l.prix_unitaire} onChange={e => updateLigne(l.key, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                  className="w-28 rounded border border-line bg-surface px-s-2 py-s-1 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Prix unit."
                  title="Prix unitaire FCFA"
                />
                <span className="text-small text-ink-3 w-24 text-right shrink-0">
                  {formatFCFA(l.quantite_commandee * l.prix_unitaire)}
                </span>
                <button onClick={() => removeLigne(l.key)} className="text-ink-3 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex justify-end">
              <p className="font-bold text-ink">Total : {formatFCFA(total)}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-s-1">
          <label className="text-small font-semibold text-ink">Notes</label>
          <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2}
            placeholder="Instructions particulières, urgence, référence interne…"
            className="resize-none rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-s-2 pt-s-2 border-t border-line">
          <Button variant="ghost" onClick={() => { setShowDrawer(false); resetDrawer() }}>Annuler</Button>
          <Button variant="secondary" onClick={() => saveOrder(false)} loading={savingOrder}
            leftIcon={<FileText className="h-4 w-4" />}>
            Brouillon
          </Button>
          <Button variant="primary" onClick={() => saveOrder(true)} loading={sendingOrder}
            leftIcon={<Send className="h-4 w-4" />}>
            Envoyer au fournisseur
          </Button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 font-semibold text-ink">Commandes</h1>
        <div className="flex gap-s-2">
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadCommandes}>
            Actualiser
          </Button>
          <Button size="sm" variant="primary" leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => { resetDrawer(); setShowDrawer(true) }}>
            Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-s-1 overflow-x-auto rounded-lg border border-line bg-surface-2 p-s-1 self-start">
        {(Object.keys(TAB_LABELS) as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-s-1.5 whitespace-nowrap rounded px-s-3 py-s-1.5 text-small font-medium transition-colors ${tab === t ? 'bg-surface shadow text-ink' : 'text-ink-3 hover:text-ink'}`}>
            {TAB_LABELS[t]}
            {tabCounts[t] > 0 && (
              <span className={`rounded-full px-s-1.5 py-s-0.5 text-micro font-bold ${tab === t ? 'bg-primary text-white' : 'bg-ink/10 text-ink-2'}`}>
                {tabCounts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadingCommandes ? (
        <div className="flex flex-col gap-s-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
          <PackagePlus className="h-10 w-10 opacity-30" />
          <p className="text-small">Aucune commande dans cet onglet.</p>
          {tab === 'traiter' && (
            <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => { resetDrawer(); setShowDrawer(true) }}>
              Créer une commande
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-s-3">
          {filtered.map(c => renderCard(c))}
        </div>
      )}

      {/* ── New/Edit order drawer ──────────────────────────────────────────────── */}
      <Drawer
        open={showDrawer}
        onClose={() => { setShowDrawer(false); resetDrawer() }}
        title={editCommandeId ? 'Modifier la commande' : 'Nouvelle commande'}
      >
        {renderDrawerContent()}
      </Drawer>

      {/* ── Reception modal ────────────────────────────────────────────────────── */}
      <Modal
        open={!!receptionCommande}
        onOpenChange={open => { if (!open) setReceptionCommande(null) }}
        title={`Réception — ${receptionCommande?.fournisseur_nom ?? ''}`}
        size="xl"
      >
        {receptionCommande && (
          <div className="flex flex-col gap-s-4">
            <p className="text-small text-ink-2">
              Vérifiez et corrigez les quantités effectivement reçues. Saisissez le numéro de lot et la date de péremption par médicament.
            </p>

            {receptionLines.map((line, i) => {
              const qLiv = parseInt(line.quantite_livree) || 0
              const isEcart = qLiv !== line.quantite_commandee
              return (
                <div key={line.ligne_id} className={`rounded-lg border p-s-3 ${isEcart ? 'border-amber-300 bg-amber-50' : 'border-line bg-surface'}`}>
                  <div className="flex items-center gap-s-2 mb-s-3">
                    <p className="font-semibold text-ink flex-1">{line.nom_medicament}</p>
                    <span className="text-small text-ink-3">Commandé : {line.quantite_commandee}</span>
                    {isEcart && <span className="text-micro font-semibold text-amber-700">⚠ Écart</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-s-3">
                    <div className="flex flex-col gap-s-1">
                      <label className="text-micro font-semibold text-ink">Quantité reçue *</label>
                      <input type="number" min="0" value={line.quantite_livree}
                        onChange={e => updateReceptionLine(i, 'quantite_livree', e.target.value)}
                        className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-s-1">
                      <label className="text-micro font-semibold text-ink">N° de lot</label>
                      <input type="text" value={line.lot}
                        onChange={e => updateReceptionLine(i, 'lot', e.target.value)}
                        className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-s-1">
                      <label className="text-micro font-semibold text-ink">Date de péremption</label>
                      <input type="date" value={line.date_peremption}
                        onChange={e => updateReceptionLine(i, 'date_peremption', e.target.value)}
                        className="rounded border border-line bg-surface px-s-2 py-s-1.5 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    {isEcart && (
                      <div className="flex flex-col gap-s-1">
                        <label className="text-micro font-semibold text-amber-700">Motif de l'écart *</label>
                        <input type="text" value={line.ecart_motif} placeholder="Rupture fournisseur, casse…"
                          onChange={e => updateReceptionLine(i, 'ecart_motif', e.target.value)}
                          className="rounded border border-amber-300 bg-surface px-s-2 py-s-1.5 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-amber-500" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {hasEcarts && (
              <div className="flex flex-col gap-s-1">
                <label className="text-small font-semibold text-amber-700">Notes globales sur les écarts</label>
                <textarea value={receptionNotes} onChange={e => setReceptionNotes(e.target.value)} rows={2}
                  className="resize-none rounded border border-amber-300 bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Commentaire général pour l'admin…"
                />
              </div>
            )}

            <div className="flex justify-end gap-s-2 pt-s-2">
              <Button variant="ghost" onClick={() => setReceptionCommande(null)}>Annuler</Button>
              <Button variant="primary" onClick={confirmReception} loading={savingReception}
                leftIcon={<PackageCheck className="h-4 w-4" />}>
                Valider la réception
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
