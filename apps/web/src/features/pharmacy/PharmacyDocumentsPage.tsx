import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { parseISO, format, subDays, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder, FolderOpen, FileText, BarChart2, ShieldAlert, Package,
  Receipt, LayoutGrid, List, Search, Upload, Download, Eye,
  RefreshCw, Pencil, Trash2, X, ChevronDown, ChevronUp,
  FileImage, File, Calendar, Check, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocCategorie = 'bon_dispensation' | 'facture_fournisseur' | 'bon_commande' | 'rapport' | 'autorisation' | 'divers'
type SortKey = 'date' | 'nom' | 'categorie' | 'taille'
type PeriodKey = 'all' | 'week' | 'month' | 'year'
type ViewMode = 'grid' | 'list'

interface DocItem {
  id: string
  pharmacie_id: string
  categorie: DocCategorie
  nom: string
  fichier_url: string
  taille_bytes: number | null
  lu: boolean
  created_at: string
  generated_auto: boolean
}

// ─── Config catégories ────────────────────────────────────────────────────────

interface CatConfig { label: string; icon: React.ReactNode; color: string; uploadAllowed: boolean }

const CAT_CONFIGS: Record<DocCategorie | 'all', CatConfig> = {
  all:                { label: 'Tous', icon: <Folder className="h-4 w-4" />, color: 'text-ink', uploadAllowed: true },
  bon_dispensation:   { label: 'Bons de dispensation', icon: <FileText className="h-4 w-4" />, color: 'text-green-600', uploadAllowed: false },
  facture_fournisseur:{ label: 'Factures fournisseurs', icon: <Receipt className="h-4 w-4" />, color: 'text-blue-600', uploadAllowed: true },
  bon_commande:       { label: 'Bons de commande', icon: <Package className="h-4 w-4" />, color: 'text-purple-600', uploadAllowed: false },
  rapport:            { label: 'Rapports & statistiques', icon: <BarChart2 className="h-4 w-4" />, color: 'text-orange-600', uploadAllowed: false },
  autorisation:       { label: 'Autorisations & licences', icon: <ShieldAlert className="h-4 w-4" />, color: 'text-amber-600', uploadAllowed: false },
  divers:             { label: 'Divers', icon: <File className="h-4 w-4" />, color: 'text-ink-3', uploadAllowed: true },
}

const CAT_ORDER: (DocCategorie | 'all')[] = [
  'all', 'bon_dispensation', 'facture_fournisseur', 'bon_commande', 'rapport', 'autorisation', 'divers',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function fileExt(nom: string): string {
  return nom.split('.').pop()?.toLowerCase() ?? ''
}

function FileIcon({ nom, size = 4 }: { nom: string; size?: number }) {
  const ext = fileExt(nom)
  const cls = `h-${size} w-${size}`
  if (ext === 'pdf') return <FileText className={`${cls} text-red-500`} />
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return <FileImage className={`${cls} text-blue-500`} />
  if (['xlsx', 'xls', 'csv'].includes(ext)) return <BarChart2 className={`${cls} text-green-600`} />
  return <File className={`${cls} text-ink-3`} />
}

function isStoragePath(url: string): boolean {
  return url.length > 0 && !url.startsWith('http')
}

function extractStoragePath(url: string): string {
  if (isStoragePath(url)) return url
  const match = url.match(/\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/)
  return match?.[1] ?? url
}

function isPdf(nom: string): boolean { return fileExt(nom) === 'pdf' }
function isImage(nom: string): boolean { return ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt(nom)) }

function getPeriodStart(period: PeriodKey): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'week') return subDays(now, 7)
  if (period === 'month') return subDays(now, 30)
  return subDays(now, 365)
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PharmacyDocumentsPage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<DocCategorie | 'all'>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [mobileAccordion, setMobileAccordion] = useState(false)

  // ── Preview ────────────────────────────────────────────────────────────────
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // ── Rename ─────────────────────────────────────────────────────────────────
  const [renameDoc, setRenameDoc] = useState<DocItem | null>(null)
  const [renameName, setRenameName] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  // ── Regenerate rapport ─────────────────────────────────────────────────────
  const [regenDoc, setRegenDoc] = useState<DocItem | null>(null)
  const [regenMois, setRegenMois] = useState('')
  const [regenAnnee, setRegenAnnee] = useState(String(new Date().getFullYear()))
  const [regenerating, setRegenerating] = useState(false)

  // ── Upload ─────────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCat, setUploadCat] = useState<DocCategorie>('divers')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteDoc, setDeleteDoc] = useState<DocItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────────────────

  const loadDocs = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoading(true)
    const { data, error } = await db
      .from('documents_pharmacie')
      .select('id, pharmacie_id, categorie, nom, fichier_url, taille_bytes, lu, created_at, generated_auto')
      .eq('pharmacie_id', pharmacie.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) { toast.error('Erreur de chargement des documents.'); setLoading(false); return }
    setDocs(data ?? [])
    setLoading(false)
  }, [pharmacie?.id])

  useEffect(() => { loadDocs() }, [loadDocs])

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────────────────────

  const unreadByCat = useMemo(() => {
    const map: Record<string, number> = {}
    docs.filter(d => !d.lu).forEach(d => {
      map[d.categorie] = (map[d.categorie] ?? 0) + 1
      map['all'] = (map['all'] ?? 0) + 1
    })
    return map
  }, [docs])

  const countByCat = useMemo(() => {
    const map: Record<string, number> = { all: docs.length }
    docs.forEach(d => { map[d.categorie] = (map[d.categorie] ?? 0) + 1 })
    return map
  }, [docs])

  const filtered = useMemo(() => {
    let list = docs
    if (selectedCat !== 'all') list = list.filter(d => d.categorie === selectedCat)
    const ps = getPeriodStart(period)
    if (ps) list = list.filter(d => isAfter(parseISO(d.created_at), ps))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.nom.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      let va: any, vb: any
      if (sort === 'date') { va = a.created_at; vb = b.created_at }
      else if (sort === 'nom') { va = a.nom.toLowerCase(); vb = b.nom.toLowerCase() }
      else if (sort === 'categorie') { va = a.categorie; vb = b.categorie }
      else { va = a.taille_bytes ?? 0; vb = b.taille_bytes ?? 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [docs, selectedCat, period, search, sort, sortDir])

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async function openPreview(doc: DocItem) {
    setPreviewDoc(doc)
    setPreviewUrl(null)
    setLoadingPreview(true)

    // Generate signed URL (1h TTL)
    const path = extractStoragePath(doc.fichier_url)
    const { data, error } = isStoragePath(doc.fichier_url)
      ? await supabase.storage.from('documents').createSignedUrl(path, 3600)
      : { data: { signedUrl: doc.fichier_url }, error: null }

    if (error || !data?.signedUrl) {
      // Fallback: try to create signed URL from extracted path
      const { data: d2 } = await supabase.storage.from('documents').createSignedUrl(extractStoragePath(doc.fichier_url), 3600)
      setPreviewUrl(d2?.signedUrl ?? doc.fichier_url)
    } else {
      setPreviewUrl(data.signedUrl)
    }
    setLoadingPreview(false)

    // Mark as read
    if (!doc.lu) {
      await db.from('documents_pharmacie').update({ lu: true }).eq('id', doc.id)
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, lu: true } : d))
    }
  }

  async function downloadDoc(doc: DocItem) {
    const path = extractStoragePath(doc.fichier_url)
    const { data } = await supabase.storage.from('documents').createSignedUrl(path, 3600, {
      download: doc.nom,
    })
    if (!data?.signedUrl) { toast.error('Impossible de générer le lien de téléchargement.'); return }
    const a = document.createElement('a')
    a.href = data.signedUrl; a.download = doc.nom; a.click()
  }

  async function confirmRename() {
    if (!renameDoc || !renameName.trim()) { toast.error('Nom invalide.'); return }
    setSavingRename(true)
    const { error } = await db.from('documents_pharmacie')
      .update({ nom: renameName.trim() }).eq('id', renameDoc.id)
    if (error) { toast.error('Erreur.'); setSavingRename(false); return }
    setDocs(prev => prev.map(d => d.id === renameDoc.id ? { ...d, nom: renameName.trim() } : d))
    toast.success('Document renommé.')
    setSavingRename(false); setRenameDoc(null)
  }

  async function confirmDelete() {
    if (!deleteDoc || !pharmacie?.id) return
    setDeleting(true)
    await db.from('documents_pharmacie')
      .update({ deleted_at: new Date().toISOString() }).eq('id', deleteDoc.id)
    setDocs(prev => prev.filter(d => d.id !== deleteDoc.id))
    toast.success('Document supprimé.')
    setDeleting(false); setDeleteDoc(null)
  }

  async function regenerateRapport() {
    if (!regenDoc || !pharmacie?.id) return
    if (!regenMois || !regenAnnee) { toast.error('Sélectionnez le mois et l\'année.'); return }
    setRegenerating(true)
    const { data, error } = await supabase.functions.invoke('generate-rapport-msas', {
      body: { pharmacie_id: pharmacie.id, mois: parseInt(regenMois), annee: parseInt(regenAnnee) },
    })
    if (error || !data?.url) { toast.error('Erreur lors de la génération.'); setRegenerating(false); return }
    window.open(data.url, '_blank')
    toast.success('Rapport généré.')
    setRegenerating(false); setRegenDoc(null)
    loadDocs()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !pharmacie?.id) return
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv']
    const MAX_BYTES = 20 * 1024 * 1024

    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|xlsx|xls|csv)$/i)) {
        toast.error(`${file.name} — type non autorisé.`); continue
      }
      if (file.size > MAX_BYTES) { toast.error(`${file.name} dépasse 20 Mo.`); continue }

      setUploading(true)
      const cat = selectedCat !== 'all' && CAT_CONFIGS[selectedCat].uploadAllowed
        ? selectedCat as DocCategorie
        : uploadCat
      const path = `${pharmacie.id}/${cat}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type })
      if (upErr) { toast.error(`Erreur upload : ${file.name}`); setUploading(false); continue }

      const { error: dbErr } = await db.from('documents_pharmacie').insert({
        pharmacie_id: pharmacie.id,
        categorie: cat,
        nom: file.name,
        fichier_url: path,
        taille_bytes: file.size,
        lu: true,
        generated_auto: false,
      })
      if (dbErr) toast.error(`Upload réussi mais enregistrement échoué : ${file.name}`)
      else toast.success(`${file.name} téléversé.`)
    }
    setUploading(false)
    loadDocs()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Sidebar
  // ─────────────────────────────────────────────────────────────────────────────

  function renderSidebar() {
    return (
      <div className="flex flex-col gap-s-1">
        {CAT_ORDER.map(cat => {
          const cfg = CAT_CONFIGS[cat]
          const isActive = selectedCat === cat
          const unread = unreadByCat[cat] ?? 0
          const count = countByCat[cat] ?? 0
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`flex w-full items-center gap-s-2 rounded-lg px-s-3 py-s-2 text-left text-small transition-colors ${
                isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              <span className={cfg.color}>{isActive ? <FolderOpen className="h-4 w-4" /> : cfg.icon}</span>
              <span className="flex-1 truncate">{cfg.label}</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-500 px-s-1.5 py-s-0.5 text-micro font-bold text-white">
                  {unread}
                </span>
              )}
              {!unread && count > 0 && (
                <span className="text-micro text-ink-3">{count}</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Document card (grid)
  // ─────────────────────────────────────────────────────────────────────────────

  function DocCard({ doc }: { doc: DocItem }) {
    const cfg = CAT_CONFIGS[doc.categorie]
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className={`group relative flex flex-col gap-s-2 rounded-lg border p-s-3 cursor-pointer transition-colors hover:bg-surface-2 ${
          !doc.lu ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
        }`}
        onClick={() => openPreview(doc)}
      >
        {/* Unread dot */}
        {!doc.lu && (
          <div className="absolute top-s-2 right-s-2 h-2 w-2 rounded-full bg-primary" />
        )}

        {/* File icon */}
        <div className="flex h-14 items-center justify-center rounded bg-surface-2">
          <FileIcon nom={doc.nom} size={8} />
        </div>

        {/* Name */}
        <p className="text-small font-medium text-ink line-clamp-2 leading-tight">{doc.nom}</p>

        {/* Meta */}
        <div className="flex items-center justify-between">
          <span className={`text-micro ${cfg.color}`}>{cfg.label.split(' ')[0]}</span>
          <span className="text-micro text-ink-3">{formatBytes(doc.taille_bytes)}</span>
        </div>
        <p className="text-micro text-ink-3">
          {format(parseISO(doc.created_at), 'dd MMM yyyy', { locale: fr })}
        </p>

        {/* Hover actions */}
        <div className="absolute inset-x-0 bottom-0 hidden rounded-b-lg bg-surface-2/95 p-s-2 group-hover:flex justify-center gap-s-1"
          onClick={e => e.stopPropagation()}>
          <ActionButtons doc={doc} compact />
        </div>
      </motion.div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Action buttons (shared by grid hover + list row)
  // ─────────────────────────────────────────────────────────────────────────────

  function ActionButtons({ doc, compact = false }: { doc: DocItem; compact?: boolean }) {
    const btnCls = `rounded p-s-1 transition-colors text-ink-3 hover:text-ink hover:bg-surface-2 ${compact ? '' : ''}`
    return (
      <>
        <button title="Prévisualiser" className={btnCls} onClick={() => openPreview(doc)}>
          <Eye className="h-4 w-4" />
        </button>
        <button title="Télécharger" className={btnCls} onClick={() => downloadDoc(doc)}>
          <Download className="h-4 w-4" />
        </button>
        {!doc.generated_auto && (
          <button title="Renommer" className={btnCls} onClick={() => { setRenameDoc(doc); setRenameName(doc.nom) }}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {doc.categorie === 'rapport' && doc.generated_auto && (
          <button title="Regénérer" className={`${btnCls} text-orange-500 hover:text-orange-700`}
            onClick={() => {
              setRegenDoc(doc)
              setRegenMois(String(new Date(doc.created_at).getMonth() + 1))
              setRegenAnnee(String(new Date(doc.created_at).getFullYear()))
            }}>
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        {!doc.generated_auto && (
          <button title="Supprimer" className={`${btnCls} hover:text-red-500`}
            onClick={() => setDeleteDoc(doc)}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER — Upload zone
  // ─────────────────────────────────────────────────────────────────────────────

  const canUpload = selectedCat === 'all' || CAT_CONFIGS[selectedCat]?.uploadAllowed
  const catForUpload: DocCategorie = (selectedCat !== 'all' && CAT_CONFIGS[selectedCat]?.uploadAllowed)
    ? selectedCat as DocCategorie
    : uploadCat

  function UploadZone() {
    return (
      <div
        className={`relative rounded-lg border-2 border-dashed p-s-8 text-center transition-colors ${
          dragging ? 'border-primary bg-primary/5' : 'border-line hover:border-primary/50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <Upload className="mx-auto h-8 w-8 text-ink-3 mb-s-2" />
        <p className="text-small font-medium text-ink">Glissez vos fichiers ici</p>
        <p className="text-micro text-ink-3 mt-s-1">PDF, JPG, PNG, XLSX — max 20 Mo</p>
        {selectedCat === 'all' && (
          <div className="mt-s-3 flex items-center justify-center gap-s-2">
            <label className="text-micro text-ink-3">Catégorie :</label>
            <select value={uploadCat} onChange={e => setUploadCat(e.target.value as DocCategorie)}
              onClick={e => e.stopPropagation()}
              className="rounded border border-line bg-surface px-s-2 py-s-0.5 text-micro text-ink focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="facture_fournisseur">Facture fournisseur</option>
              <option value="divers">Divers</option>
            </select>
          </div>
        )}
        <button onClick={() => fileInputRef.current?.click()}
          className="mt-s-3 rounded-full border border-primary px-s-4 py-s-1.5 text-small text-primary hover:bg-primary/5">
          Choisir un fichier
        </button>
        {uploading && (
          <div className="mt-s-2 flex items-center justify-center gap-s-2 text-small text-ink-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Téléversement…
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
          className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const totalUnread = unreadByCat['all'] ?? 0

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-s-3">
          <h1 className="font-display text-h1 font-semibold text-ink">Documents</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-red-500 px-s-2 py-s-0.5 text-micro font-bold text-white">
              {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={loadDocs}>
          Actualiser
        </Button>
      </div>

      {/* Mobile accordion */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileAccordion(v => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-s-4 py-s-3"
        >
          <span className="flex items-center gap-s-2 text-small font-semibold text-ink">
            <span className={CAT_CONFIGS[selectedCat].color}>{CAT_CONFIGS[selectedCat].icon}</span>
            {CAT_CONFIGS[selectedCat].label}
            {(countByCat[selectedCat] ?? 0) > 0 && (
              <span className="text-micro text-ink-3">({countByCat[selectedCat] ?? 0})</span>
            )}
          </span>
          {mobileAccordion ? <ChevronUp className="h-4 w-4 text-ink-3" /> : <ChevronDown className="h-4 w-4 text-ink-3" />}
        </button>
        <AnimatePresence>
          {mobileAccordion && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-x border-b border-line rounded-b-lg bg-surface px-s-2 pb-s-2">
              {renderSidebar()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-s-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="rounded-lg border border-line bg-surface p-s-3">
            {renderSidebar()}
          </div>
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-s-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-s-3">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un document…"
                className="w-full rounded border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            {/* Period */}
            <select value={period} onChange={e => setPeriod(e.target.value as PeriodKey)}
              className="rounded border border-line bg-surface px-s-2 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">Toutes les dates</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
              <option value="year">12 derniers mois</option>
            </select>

            {/* Sort */}
            <select value={`${sort}_${sortDir}`} onChange={e => {
              const [s, d] = e.target.value.split('_') as [SortKey, 'asc' | 'desc']
              setSort(s); setSortDir(d)
            }} className="rounded border border-line bg-surface px-s-2 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="date_desc">Plus récent</option>
              <option value="date_asc">Plus ancien</option>
              <option value="nom_asc">Nom A→Z</option>
              <option value="nom_desc">Nom Z→A</option>
              <option value="taille_desc">Taille ↓</option>
              <option value="categorie_asc">Catégorie</option>
            </select>

            {/* View toggle */}
            <div className="flex rounded-lg border border-line bg-surface-2 p-s-0.5">
              <button onClick={() => setView('grid')}
                className={`rounded p-s-1.5 transition-colors ${view === 'grid' ? 'bg-surface shadow text-ink' : 'text-ink-3'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')}
                className={`rounded p-s-1.5 transition-colors ${view === 'list' ? 'bg-surface shadow text-ink' : 'text-ink-3'}`}>
                <List className="h-4 w-4" />
              </button>
            </div>

            {canUpload && (
              <Button size="sm" variant="primary" leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => fileInputRef.current?.click()} loading={uploading}>
                Téléverser
              </Button>
            )}
          </div>

          {/* Upload zone (when no documents or when can upload) */}
          {canUpload && !filtered.length && !loading && (
            <UploadZone />
          )}

          {/* Document list */}
          {loading ? (
            <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-s-3' : 'flex flex-col gap-s-2'}>
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className={view === 'grid' ? 'h-40 rounded-lg' : 'h-12 rounded'} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-s-3 py-s-12 text-ink-3">
              <Folder className="h-10 w-10 opacity-30" />
              <p className="text-small">Aucun document dans ce dossier.</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-s-3">
              {filtered.map(d => <DocCard key={d.id} doc={d} />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[600px] text-small">
                <thead className="bg-surface-2">
                  <tr>
                    {['', 'Nom', 'Catégorie', 'Taille', 'Date', ''].map((h, i) => (
                      <th key={i} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(doc => {
                    const cfg = CAT_CONFIGS[doc.categorie]
                    return (
                      <tr key={doc.id} className={`hover:bg-surface-2/50 cursor-pointer ${!doc.lu ? 'bg-primary/5' : ''}`}
                        onClick={() => openPreview(doc)}>
                        <td className="px-s-3 py-s-2 w-8">
                          <div className="flex items-center gap-s-1">
                            <FileIcon nom={doc.nom} size={4} />
                            {!doc.lu && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </div>
                        </td>
                        <td className="px-s-3 py-s-2 max-w-[250px]">
                          <p className="font-medium text-ink truncate">{doc.nom}</p>
                          {doc.generated_auto && (
                            <span className="text-micro text-ink-3">Auto-généré</span>
                          )}
                        </td>
                        <td className="px-s-3 py-s-2">
                          <span className={`text-micro ${cfg.color}`}>{cfg.label}</span>
                        </td>
                        <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">{formatBytes(doc.taille_bytes)}</td>
                        <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                          {format(parseISO(doc.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                        <td className="px-s-3 py-s-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-s-1"><ActionButtons doc={doc} /></div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-micro text-ink-3">{filtered.length} document(s)</p>

          {/* Upload zone at bottom when there are docs */}
          {canUpload && filtered.length > 0 && <UploadZone />}
        </div>
      </div>

      {/* ── Modal Prévisualisation ────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewDoc && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--ink)_60%,transparent)]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewDoc(null)}
            />
            <motion.div
              className="fixed inset-4 z-50 flex flex-col rounded-xl bg-surface shadow-2xl sm:inset-8"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            >
              {/* Header */}
              <div className="flex items-center gap-s-3 border-b border-line px-s-4 py-s-3">
                <FileIcon nom={previewDoc.nom} size={5} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{previewDoc.nom}</p>
                  <p className="text-micro text-ink-3">
                    {format(parseISO(previewDoc.created_at), 'dd MMMM yyyy HH:mm', { locale: fr })}
                    {' · '}{formatBytes(previewDoc.taille_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-s-2">
                  <button onClick={() => downloadDoc(previewDoc)} title="Télécharger"
                    className="rounded p-s-2 hover:bg-surface-2 text-ink-3 hover:text-ink">
                    <Download className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPreviewDoc(null)}
                    className="rounded p-s-2 hover:bg-surface-2 text-ink-3 hover:text-ink">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden bg-surface-2 p-s-2">
                {loadingPreview ? (
                  <div className="flex h-full items-center justify-center gap-s-3 text-ink-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span>Chargement…</span>
                  </div>
                ) : previewUrl && isPdf(previewDoc.nom) ? (
                  <iframe src={previewUrl} className="h-full w-full rounded border border-line" title={previewDoc.nom} />
                ) : previewUrl && isImage(previewDoc.nom) ? (
                  <div className="flex h-full items-center justify-center">
                    <img src={previewUrl} alt={previewDoc.nom}
                      className="max-h-full max-w-full rounded shadow object-contain" />
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-s-4 text-ink-3">
                    <FileIcon nom={previewDoc.nom} size={16} />
                    <p className="text-small">Prévisualisation non disponible pour ce type de fichier.</p>
                    <Button variant="primary" leftIcon={<Download className="h-4 w-4" />}
                      onClick={() => downloadDoc(previewDoc)}>
                      Télécharger
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal Renommer ────────────────────────────────────────────────────── */}
      <Modal open={!!renameDoc} onOpenChange={open => { if (!open) setRenameDoc(null) }} title="Renommer le document">
        {renameDoc && (
          <div className="flex flex-col gap-s-4">
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Nouveau nom</label>
              <input type="text" value={renameName} onChange={e => setRenameName(e.target.value)}
                autoFocus
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setRenameDoc(null)}>Annuler</Button>
              <Button variant="primary" onClick={confirmRename} loading={savingRename}
                leftIcon={<Check className="h-4 w-4" />}>
                Renommer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Regénérer rapport ───────────────────────────────────────────── */}
      <Modal open={!!regenDoc} onOpenChange={open => { if (!open) setRegenDoc(null) }} title="Regénérer un rapport MSAS">
        {regenDoc && (
          <div className="flex flex-col gap-s-4">
            <p className="text-small text-ink-2">Le rapport sera généré et s'ouvrira dans un nouvel onglet.</p>
            <div className="grid grid-cols-2 gap-s-3">
              <div className="flex flex-col gap-s-1">
                <label className="text-small font-semibold text-ink">Mois</label>
                <select value={regenMois} onChange={e => setRegenMois(e.target.value)}
                  className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      {format(new Date(2024, i, 1), 'MMMM', { locale: fr })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-s-1">
                <label className="text-small font-semibold text-ink">Année</label>
                <select value={regenAnnee} onChange={e => setRegenAnnee(e.target.value)}
                  className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
                  {[2024, 2025, 2026].map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setRegenDoc(null)}>Annuler</Button>
              <Button variant="primary" onClick={regenerateRapport} loading={regenerating}
                leftIcon={<RefreshCw className="h-4 w-4" />}>
                Générer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Supprimer ───────────────────────────────────────────────────── */}
      <Modal open={!!deleteDoc} onOpenChange={open => { if (!open) setDeleteDoc(null) }} title="Supprimer le document" size="sm">
        {deleteDoc && (
          <div className="flex flex-col gap-s-4">
            <div className="flex items-start gap-s-3 rounded-lg border border-red-200 bg-red-50 p-s-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-small text-red-800">
                Supprimer <strong>"{deleteDoc.nom}"</strong> ? Cette action est irréversible.
              </p>
            </div>
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setDeleteDoc(null)}>Annuler</Button>
              <Button variant="primary" onClick={confirmDelete} loading={deleting}
                leftIcon={<Trash2 className="h-4 w-4" />}>
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
