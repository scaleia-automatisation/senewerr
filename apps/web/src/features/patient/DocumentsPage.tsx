import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { format, subDays, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  FileText, Image as ImageIcon, Download, Share2, Pencil, Trash2,
  Plus, Camera, Search, Grid2X2, List, X, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Link2, Clock, FolderOpen, Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Doc {
  id: string
  patient_id: string
  praticien_id: string | null
  pharmacien_id: string | null
  categorie: string
  nom: string
  fichier_url: string
  taille_bytes: number
  type_mime: string
  lu: boolean
  partage_token: string | null
  partage_expire_at: string | null
  created_at: string
  deleted_at: string | null
  // joined
  praticien_nom?: string
}

type ViewMode = 'list' | 'grid'
type SortKey = 'date' | 'nom' | 'praticien'
type PeriodFilter = 'all' | '7d' | '30d' | '3m' | '1y'

const CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: 'tous',            label: 'Tous',                   emoji: '📂' },
  { key: 'compte_rendu',   label: 'Comptes-rendus',         emoji: '📋' },
  { key: 'ordonnance',     label: 'Ordonnances',            emoji: '💊' },
  { key: 'resultat_examen',label: 'Résultats d\'examens',   emoji: '🔬' },
  { key: 'facture',        label: 'Factures & remboursements', emoji: '🧾' },
  { key: 'certificat',     label: 'Certificats',            emoji: '📜' },
  { key: 'mutuelle',       label: 'Documents mutuelle',     emoji: '🏥' },
  { key: 'divers',         label: 'Divers',                 emoji: '📁' },
]

const CATEGORY_SUGGEST: [RegExp, string][] = [
  [/compte.?rendu|cr\s|consultation/i, 'compte_rendu'],
  [/ordonnance|prescription/i,         'ordonnance'],
  [/résultat|analyse|biologie|radio|scanner|irm/i, 'resultat_examen'],
  [/facture|remboursement/i,           'facture'],
  [/certificat|aptitude|arrêt/i,       'certificat'],
  [/mutuelle|assurance/i,              'mutuelle'],
]

const PERIOD_OPTIONS: { key: PeriodFilter; label: string }[] = [
  { key: 'all', label: 'Toutes les périodes' },
  { key: '7d',  label: '7 derniers jours' },
  { key: '30d', label: '30 derniers jours' },
  { key: '3m',  label: '3 derniers mois' },
  { key: '1y',  label: 'Cette année' },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

function docSource(d: Doc): 'medecin' | 'pharmacie' | 'patient' {
  if (d.praticien_id) return 'medecin'
  if (d.pharmacien_id) return 'pharmacie'
  return 'patient'
}

function sourceLabel(d: Doc): string {
  const src = docSource(d)
  if (src === 'medecin') return d.praticien_nom ? `Dr ${d.praticien_nom}` : 'Médecin'
  if (src === 'pharmacie') return 'Pharmacie'
  return 'Vous'
}

function sourceClsBadge(d: Doc): string {
  const src = docSource(d)
  if (src === 'medecin') return 'bg-primary-soft text-primary'
  if (src === 'pharmacie') return 'bg-status-pending/10 text-status-pending'
  return 'bg-surface-2 text-ink-3'
}

function isPdf(mime: string) { return mime === 'application/pdf' }
function isImage(mime: string) { return mime.startsWith('image/') }

function suggestCategory(filename: string): string {
  for (const [re, cat] of CATEGORY_SUGGEST) {
    if (re.test(filename)) return cat
  }
  return 'divers'
}

function periodCutoff(p: PeriodFilter): Date | null {
  const now = new Date()
  if (p === '7d')  return subDays(now, 7)
  if (p === '30d') return subDays(now, 30)
  if (p === '3m')  return subMonths(now, 3)
  if (p === '1y')  return new Date(now.getFullYear(), 0, 1)
  return null
}

// ─── PreviewModal ─────────────────────────────────────────────────────────────
function PreviewModal({ doc, open, onClose }: {
  doc: Doc | null; open: boolean; onClose: () => void
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !doc) return
    setLoading(true); setSignedUrl(null)
    supabase.storage.from('documents-patients')
      .createSignedUrl(doc.fichier_url, 3600)
      .then(({ data }) => { setSignedUrl(data?.signedUrl ?? null); setLoading(false) })
  }, [open, doc?.fichier_url])

  async function download() {
    if (!signedUrl) return
    const a = document.createElement('a')
    a.href = signedUrl
    a.download = doc?.nom ?? 'document'
    a.click()
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title={doc?.nom ?? ''} size="xl">
      <div className="flex flex-col gap-s-3" style={{ minHeight: 400 }}>
        {loading && (
          <div className="flex flex-1 items-center justify-center py-s-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {!loading && signedUrl && doc && (
          <>
            {isImage(doc.type_mime) ? (
              <img src={signedUrl} alt={doc.nom} className="max-h-[60vh] w-full rounded-md object-contain bg-surface-2" />
            ) : isPdf(doc.type_mime) ? (
              <iframe
                src={signedUrl}
                title={doc.nom}
                className="w-full rounded-md border border-line"
                style={{ height: '60vh' }}
              />
            ) : (
              <div className="flex flex-col items-center gap-s-4 py-s-10">
                <FileText className="h-12 w-12 text-ink-3" />
                <p className="text-small text-ink-2">Aperçu non disponible pour ce type de fichier.</p>
              </div>
            )}
            <div className="flex items-center gap-s-2 text-micro text-ink-3">
              <span>{formatBytes(doc.taille_bytes)}</span>
              <span>·</span>
              <span>{format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}</span>
              <span>·</span>
              <span>{sourceLabel(doc)}</span>
            </div>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={download}>
              Télécharger
            </Button>
          </>
        )}
        {!loading && !signedUrl && (
          <div className="flex flex-1 items-center justify-center py-s-10">
            <p className="text-small text-status-danger">Impossible de charger le document.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── ShareModal ───────────────────────────────────────────────────────────────
function ShareModal({ doc, open, onClose }: {
  doc: Doc | null; open: boolean; onClose: () => void
}) {
  const db = supabase as any
  const [duration, setDuration] = useState<'24h' | '7d'>('24h')
  const [generating, setGenerating] = useState(false)
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { setLink(null) }
  }, [open])

  async function generate() {
    if (!doc) return
    setGenerating(true)
    const token = crypto.randomUUID()
    const expireAt = new Date()
    duration === '24h' ? expireAt.setHours(expireAt.getHours() + 24) : expireAt.setDate(expireAt.getDate() + 7)

    await db.from('documents').update({
      partage_token: token,
      partage_expire_at: expireAt.toISOString(),
    }).eq('id', doc.id)

    const url = `${window.location.origin}/partage/${token}`
    setLink(url)
    try { await navigator.clipboard.writeText(url) } catch { /* fallback */ }
    toast.success('Lien copié dans le presse-papiers !')
    setGenerating(false)
  }

  async function copyLink() {
    if (!link) return
    try { await navigator.clipboard.writeText(link) } catch { /* ignore */ }
    toast.success('Lien copié !')
  }

  return (
    <Modal open={open} onOpenChange={v => !v && onClose()} title="Partager ce document" size="sm">
      <div className="flex flex-col gap-s-4">
        <p className="text-small text-ink-2">
          Génère un lien temporaire que vous pouvez partager avec un médecin ou votre mutuelle.
          Aucune donnée personnelle autre que le document ne sera exposée.
        </p>
        <div className="grid grid-cols-2 gap-s-2">
          {(['24h', '7d'] as const).map(d => (
            <button
              key={d}
              onClick={() => { setDuration(d); setLink(null) }}
              className={cn(
                'rounded-md border p-s-3 text-center transition-colors',
                duration === d ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-2',
              )}
            >
              <p className="font-bold text-ink">{d === '24h' ? '24 heures' : '7 jours'}</p>
              <p className="text-micro text-ink-3">Lien valide {d === '24h' ? '1 journée' : '1 semaine'}</p>
            </button>
          ))}
        </div>

        {link ? (
          <div className="rounded-md border border-primary bg-primary-soft px-s-3 py-s-2 flex items-center gap-s-2">
            <Link2 className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1 truncate text-micro font-mono text-primary">{link}</span>
            <button onClick={copyLink} className="text-primary hover:text-primary-dark">
              <CheckCircle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button onClick={generate} loading={generating} leftIcon={<Link2 className="h-4 w-4" />}>
            Générer le lien
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </div>
    </Modal>
  )
}

// ─── UploadModal ──────────────────────────────────────────────────────────────
function UploadModal({ open, patientId, onClose, onUploaded }: {
  open: boolean; patientId: string; onClose: () => void; onUploaded: () => void
}) {
  const db = supabase as any
  const fileRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('divers')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function resetState() {
    setFile(null); setNom(''); setCategorie('divers'); setProgress(0); setError(null)
  }

  useEffect(() => { if (!open) resetState() }, [open])

  function handleFile(f: File) {
    if (f.size > MAX_FILE_SIZE) { setError('Fichier trop volumineux (max 10 Mo).'); return }
    if (!['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(f.type)) {
      setError('Format non supporté. Accepté : PDF, JPG, PNG.'); return
    }
    setError(null)
    setFile(f)
    setNom(f.name.replace(/\.[^.]+$/, ''))
    setCategorie(suggestCategory(f.name))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function upload() {
    if (!file) return
    setUploading(true); setProgress(10)
    const ext = file.name.split('.').pop()
    const path = `${patientId}/${Date.now()}-${nom.replace(/\s+/g, '-')}.${ext}`

    // Simulate progress while upload runs
    const timer = setInterval(() => setProgress(p => Math.min(p + 15, 85)), 400)
    const { error: storageErr } = await supabase.storage.from('documents-patients').upload(path, file)
    clearInterval(timer)
    setProgress(95)

    if (storageErr) { setError('Erreur lors de l\'upload.'); setUploading(false); setProgress(0); return }

    await db.from('documents').insert({
      patient_id: patientId,
      categorie,
      nom,
      fichier_url: path,
      taille_bytes: file.size,
      type_mime: file.type,
      lu: true,
    })

    setProgress(100)
    setTimeout(() => { onUploaded(); onClose() }, 500)
    setUploading(false)
  }

  return (
    <Modal open={open} onOpenChange={v => !v && !uploading && onClose()} title="Ajouter un document" size="md">
      <div className="flex flex-col gap-s-4">
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center gap-s-2 rounded-md border-2 border-dashed py-s-6 cursor-pointer transition-colors',
            dragOver ? 'border-primary bg-primary-soft' : file ? 'border-status-success bg-status-success/5' : 'border-line hover:bg-surface-2',
          )}
        >
          {file ? (
            <div className="flex items-center gap-s-2">
              {isImage(file.type) ? <ImageIcon className="h-6 w-6 text-status-success" /> : <FileText className="h-6 w-6 text-status-success" />}
              <span className="text-small font-medium text-ink">{file.name}</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); setNom('') }} className="text-ink-3 hover:text-status-danger">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-ink-3" />
              <p className="text-small text-ink-2">Glissez un fichier ici ou <span className="text-primary">cliquez pour parcourir</span></p>
              <p className="text-micro text-ink-3">PDF, JPG, PNG — max 10 Mo</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

        {/* Scan mobile */}
        <div className="flex md:hidden">
          <Button variant="secondary" size="sm" leftIcon={<Camera className="h-4 w-4" />} onClick={() => scanRef.current?.click()} className="w-full">
            Scanner avec la caméra
          </Button>
          <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Nom */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Nom du document</label>
          <input
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Nom du document"
            className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
          />
        </div>

        {/* Catégorie */}
        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Catégorie</label>
          <select
            value={categorie}
            onChange={e => setCategorie(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus"
          >
            {CATEGORIES.filter(c => c.key !== 'tous').map(c => (
              <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Progress */}
        {uploading && (
          <div>
            <div className="mb-s-1 flex justify-between text-micro text-ink-3">
              <span>Upload en cours…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-s-2 rounded-md bg-status-danger/10 px-s-3 py-s-2 text-small text-status-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-s-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={uploading}>Annuler</Button>
          <Button className="flex-1" onClick={upload} loading={uploading} disabled={!file || !nom}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── DocumentCard (grid) ──────────────────────────────────────────────────────
function DocumentCard({ doc, onOpen, onShare, onDelete }: {
  doc: Doc
  onOpen: () => void
  onShare: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-md border bg-surface p-s-3 cursor-pointer transition-all hover:shadow-sm',
        !doc.lu ? 'border-primary' : 'border-line',
      )}
      onClick={onOpen}
    >
      {!doc.lu && <span className="absolute top-s-2 right-s-2 h-2 w-2 rounded-full bg-primary" />}
      <div className="flex-1 flex items-center justify-center py-s-4 rounded-md bg-surface-2 mb-s-2">
        {isImage(doc.type_mime)
          ? <ImageIcon className="h-10 w-10 text-ink-3" />
          : <FileText className="h-10 w-10 text-ink-3" />
        }
      </div>
      <p className="text-small font-medium text-ink truncate">{doc.nom}</p>
      <p className="text-micro text-ink-3">{format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}</p>
      <span className={cn('mt-s-1 self-start rounded-pill px-s-2 py-0.5 text-micro font-medium', sourceClsBadge(doc))}>
        {sourceLabel(doc)}
      </span>
      {/* Hover actions */}
      <div className="absolute inset-0 flex items-end justify-end gap-s-1 p-s-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
        <button onClick={onShare} className="rounded-md bg-surface p-s-1 shadow-sm hover:bg-primary-soft"><Share2 className="h-4 w-4 text-ink-2" /></button>
        {docSource(doc) === 'patient' && (
          <button onClick={onDelete} className="rounded-md bg-surface p-s-1 shadow-sm hover:bg-status-danger/10"><Trash2 className="h-4 w-4 text-status-danger" /></button>
        )}
      </div>
    </div>
  )
}

// ─── DocumentRow (list) ───────────────────────────────────────────────────────
function DocumentRow({ doc, onOpen, onShare, onDelete, onRename }: {
  doc: Doc
  onOpen: () => void
  onShare: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(doc.nom)
  const canEdit = docSource(doc) === 'patient'

  function submitRename() {
    if (draft.trim() && draft.trim() !== doc.nom) onRename(draft.trim())
    setEditing(false)
  }

  return (
    <tr
      className={cn(
        'group cursor-pointer hover:bg-surface-2 transition-colors',
        !doc.lu ? 'bg-primary-soft/20' : '',
      )}
      onClick={onOpen}
    >
      <td className="px-s-3 py-s-2">
        <div className="flex items-center gap-s-2 min-w-0">
          {!doc.lu && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          {isImage(doc.type_mime) ? <ImageIcon className="h-4 w-4 shrink-0 text-ink-3" /> : <FileText className="h-4 w-4 shrink-0 text-ink-3" />}
          {editing ? (
            <input
              autoFocus
              value={draft}
              onClick={e => e.stopPropagation()}
              onChange={e => setDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditing(false) }}
              className="min-w-0 flex-1 rounded border border-primary px-s-1 text-small focus:outline-none"
            />
          ) : (
            <span className="truncate text-small font-medium text-ink">{doc.nom}</span>
          )}
        </div>
      </td>
      <td className="hidden px-s-3 py-s-2 sm:table-cell">
        <span className="text-small text-ink-2 capitalize">
          {CATEGORIES.find(c => c.key === doc.categorie)?.label ?? doc.categorie}
        </span>
      </td>
      <td className="hidden px-s-3 py-s-2 md:table-cell">
        <span className={cn('rounded-pill px-s-2 py-0.5 text-micro font-medium', sourceClsBadge(doc))}>{sourceLabel(doc)}</span>
      </td>
      <td className="hidden px-s-3 py-s-2 lg:table-cell text-small text-ink-2 whitespace-nowrap">
        {format(new Date(doc.created_at), 'd MMM yyyy', { locale: fr })}
      </td>
      <td className="hidden px-s-3 py-s-2 xl:table-cell text-small text-ink-3 text-right">
        {formatBytes(doc.taille_bytes)}
      </td>
      <td className="px-s-3 py-s-2 text-center">
        {doc.lu ? <Eye className="mx-auto h-4 w-4 text-ink-3" /> : <span className="text-micro font-medium text-primary">Nouveau</span>}
      </td>
      <td className="px-s-2 py-s-2" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-s-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="Aperçu" onClick={onOpen} className="rounded p-s-1 hover:bg-surface-2"><Eye className="h-4 w-4 text-ink-2" /></button>
          <button title="Partager" onClick={onShare} className="rounded p-s-1 hover:bg-surface-2"><Share2 className="h-4 w-4 text-ink-2" /></button>
          {canEdit && (
            <button title="Renommer" onClick={() => setEditing(true)} className="rounded p-s-1 hover:bg-surface-2"><Pencil className="h-4 w-4 text-ink-2" /></button>
          )}
          {canEdit ? (
            <button title="Supprimer" onClick={onDelete} className="rounded p-s-1 hover:bg-status-danger/10"><Trash2 className="h-4 w-4 text-status-danger" /></button>
          ) : (
            <button title="Impossible de supprimer un document déposé par un praticien" disabled className="rounded p-s-1 cursor-not-allowed opacity-30"><Trash2 className="h-4 w-4 text-ink-3" /></button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activeCategory, onSelect, counts, unread }: {
  activeCategory: string
  onSelect: (k: string) => void
  counts: Record<string, number>
  unread: Record<string, number>
}) {
  // Group unread by source (for summary line — stored separately on the doc)
  return (
    <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col gap-s-1 pr-s-4 border-r border-line">
      {CATEGORIES.map(c => {
        const total  = counts[c.key] ?? 0
        const unrdCnt = c.key === 'tous' ? (unread['__tous__'] ?? 0) : (unread[c.key] ?? 0)
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            className={cn(
              'flex items-center gap-s-2 rounded-md px-s-3 py-s-2 text-left text-small transition-colors',
              activeCategory === c.key ? 'bg-primary-soft text-primary font-semibold' : 'text-ink-2 hover:bg-surface-2',
            )}
          >
            <span>{c.emoji}</span>
            <span className="flex-1 truncate">{c.label}</span>
            {total > 0 && <span className="text-micro text-ink-3">{total}</span>}
            {unrdCnt > 0 && (
              <span className="min-w-[1.2rem] rounded-full bg-status-danger px-s-1 text-center text-micro font-bold text-white">
                {unrdCnt}
              </span>
            )}
          </button>
        )
      })}
    </aside>
  )
}

// ─── MobileCategoryAccordion ──────────────────────────────────────────────────
function MobileCategoryAccordion({ activeCategory, onSelect, counts, unread }: {
  activeCategory: string
  onSelect: (k: string) => void
  counts: Record<string, number>
  unread: Record<string, number>
}) {
  const [open, setOpen] = useState(false)
  const active = CATEGORIES.find(c => c.key === activeCategory)

  return (
    <div className="md:hidden mb-s-3 rounded-md border border-line bg-surface">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-s-2 px-s-3 py-s-2 text-small font-medium text-ink"
      >
        <span>{active?.emoji}</span>
        <span className="flex-1 text-left">{active?.label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-line flex flex-col">
          {CATEGORIES.map(c => {
            const unrdCnt = c.key === 'tous' ? (unread['__tous__'] ?? 0) : (unread[c.key] ?? 0)
            return (
              <button
                key={c.key}
                onClick={() => { onSelect(c.key); setOpen(false) }}
                className={cn(
                  'flex items-center gap-s-2 px-s-3 py-s-2 text-left text-small',
                  activeCategory === c.key ? 'bg-primary-soft text-primary font-semibold' : 'text-ink-2',
                )}
              >
                <span>{c.emoji}</span>
                <span className="flex-1">{c.label}</span>
                {counts[c.key] > 0 && <span className="text-micro text-ink-3">{counts[c.key]}</span>}
                {unrdCnt > 0 && (
                  <span className="rounded-full bg-status-danger px-s-1 text-micro font-bold text-white">{unrdCnt}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── DocumentsPage ────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const db = supabase as any
  const { profile } = useAuth()

  const [docs, setDocs]             = useState<Doc[]>([])
  const [loading, setLoading]       = useState(false)
  const [category, setCategory]     = useState('tous')
  const [search, setSearch]         = useState('')
  const [period, setPeriod]         = useState<PeriodFilter>('all')
  const [sort, setSort]             = useState<SortKey>('date')
  const [view, setView]             = useState<ViewMode>(() => {
    try { return (localStorage.getItem('docs-view') as ViewMode) ?? 'list' } catch { return 'list' }
  })

  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [shareDoc, setShareDoc]     = useState<Doc | null>(null)
  const [deleteDoc, setDeleteDoc]   = useState<Doc | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  function setViewMode(v: ViewMode) {
    setView(v)
    try { localStorage.setItem('docs-view', v) } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await db.from('documents')
      .select('*, praticien:profiles!praticien_id(first_name, last_name)')
      .eq('patient_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    const mapped: Doc[] = (data ?? []).map((d: any) => ({
      ...d,
      praticien_nom: d.praticien ? `${d.praticien.first_name ?? ''} ${d.praticien.last_name ?? ''}`.trim() : undefined,
    }))
    setDocs(mapped)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  async function markRead(doc: Doc) {
    if (doc.lu) return
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, lu: true } : d))
    await db.from('documents').update({ lu: true }).eq('id', doc.id)
  }

  function openPreview(doc: Doc) {
    markRead(doc)
    setPreviewDoc(doc)
  }

  async function rename(doc: Doc, newName: string) {
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, nom: newName } : d))
    await db.from('documents').update({ nom: newName }).eq('id', doc.id)
    toast.success('Document renommé.')
  }

  async function softDelete() {
    if (!deleteDoc) return
    setDeleting(true)
    await db.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', deleteDoc.id)
    setDocs(prev => prev.filter(d => d.id !== deleteDoc.id))
    setDeleteDoc(null)
    setDeleting(false)
    toast.success('Document supprimé.')
  }

  // Computed counts
  const { counts, unread } = useMemo(() => {
    const c: Record<string, number> = { tous: 0 }
    const u: Record<string, number> = {}
    for (const d of docs) {
      c.tous = (c.tous ?? 0) + 1
      c[d.categorie] = (c[d.categorie] ?? 0) + 1
      if (!d.lu) {
        u['__tous__'] = (u['__tous__'] ?? 0) + 1
        u[d.categorie] = (u[d.categorie] ?? 0) + 1
      }
    }
    return { counts: c, unread: u }
  }, [docs])

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let result = [...docs]
    if (category !== 'tous') result = result.filter(d => d.categorie === category)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(d => d.nom.toLowerCase().includes(q) || sourceLabel(d).toLowerCase().includes(q))
    }
    const cutoff = periodCutoff(period)
    if (cutoff) result = result.filter(d => new Date(d.created_at) >= cutoff)
    result.sort((a, b) => {
      if (sort === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'nom') return a.nom.localeCompare(b.nom)
      return (a.praticien_nom ?? '').localeCompare(b.praticien_nom ?? '')
    })
    return result
  }, [docs, category, search, period, sort])

  // Unread count tooltip for sidebar
  const unreadDetails = useMemo(() => {
    const med = docs.filter(d => !d.lu && d.praticien_id).length
    const ph  = docs.filter(d => !d.lu && d.pharmacien_id).length
    const parts = []
    if (med > 0) parts.push(`${med} de votre médecin`)
    if (ph > 0) parts.push(`${ph} de la pharmacie`)
    return parts.join(' · ')
  }, [docs])

  return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-s-3">
        <div>
          <h1 className="font-display text-h1 font-semibold text-ink">Documents</h1>
          {unreadDetails && (
            <p className="text-micro text-ink-3 mt-s-0.5">{unreadDetails} non lu{(unread['__tous__'] ?? 0) > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-s-2">
          {/* Scan mobile */}
          <div className="flex md:hidden">
            <label htmlFor="scan-doc" className="cursor-pointer">
              <Button size="sm" variant="secondary" leftIcon={<Camera className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
                Scanner
              </Button>
            </label>
          </div>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
            Ajouter
          </Button>
        </div>
      </div>

      {/* Mobile category accordion */}
      <MobileCategoryAccordion activeCategory={category} onSelect={setCategory} counts={counts} unread={unread} />

      {/* Body: sidebar + main */}
      <div className="flex gap-s-5">
        <Sidebar activeCategory={category} onSelect={setCategory} counts={counts} unread={unread} />

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col gap-s-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-s-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-s-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-md border border-line bg-surface pl-9 pr-s-3 py-s-1.5 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
              />
            </div>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value as PeriodFilter)}
              className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small focus:outline-none focus:shadow-focus"
            >
              {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="rounded-md border border-line bg-surface px-s-3 py-s-1.5 text-small focus:outline-none focus:shadow-focus"
            >
              <option value="date">Trier par date</option>
              <option value="nom">Trier par nom</option>
              <option value="praticien">Trier par praticien</option>
            </select>
            <div className="flex rounded-md border border-line overflow-hidden">
              <button onClick={() => setViewMode('list')} className={cn('px-s-2 py-s-1.5 transition-colors', view === 'list' ? 'bg-primary text-white' : 'bg-surface text-ink-2 hover:bg-surface-2')}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={cn('px-s-2 py-s-1.5 transition-colors', view === 'grid' ? 'bg-primary text-white' : 'bg-surface text-ink-2 hover:bg-surface-2')}>
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col gap-s-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="h-10 w-10" />}
              title="Aucun document"
              description={search ? 'Aucun résultat pour cette recherche.' : 'Vos documents apparaîtront ici.'}
            />
          ) : view === 'list' ? (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[500px] text-small">
                <thead>
                  <tr className="bg-surface-2 border-b border-line">
                    <th className="text-left px-s-3 py-s-2 font-semibold text-ink">Nom</th>
                    <th className="hidden text-left px-s-3 py-s-2 font-semibold text-ink sm:table-cell">Catégorie</th>
                    <th className="hidden text-left px-s-3 py-s-2 font-semibold text-ink md:table-cell">Source</th>
                    <th className="hidden text-left px-s-3 py-s-2 font-semibold text-ink lg:table-cell">Date</th>
                    <th className="hidden text-right px-s-3 py-s-2 font-semibold text-ink xl:table-cell">Taille</th>
                    <th className="text-center px-s-3 py-s-2 font-semibold text-ink">Lu</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(d => (
                    <DocumentRow
                      key={d.id}
                      doc={d}
                      onOpen={() => openPreview(d)}
                      onShare={() => setShareDoc(d)}
                      onDelete={() => setDeleteDoc(d)}
                      onRename={name => rename(d, name)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map(d => (
                <DocumentCard
                  key={d.id}
                  doc={d}
                  onOpen={() => openPreview(d)}
                  onShare={() => setShareDoc(d)}
                  onDelete={() => setDeleteDoc(d)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <PreviewModal doc={previewDoc} open={!!previewDoc} onClose={() => setPreviewDoc(null)} />
      <ShareModal doc={shareDoc} open={!!shareDoc} onClose={() => setShareDoc(null)} />
      <UploadModal
        open={uploadOpen}
        patientId={profile?.id ?? ''}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />

      {/* Confirm delete */}
      <Modal open={!!deleteDoc} onOpenChange={v => !v && setDeleteDoc(null)} title="Supprimer le document" size="sm">
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">
            Voulez-vous supprimer <strong className="text-ink">«{deleteDoc?.nom}»</strong> ?
            Cette action est définitive.
          </p>
          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteDoc(null)} disabled={deleting}>Annuler</Button>
            <Button className="flex-1 bg-status-danger hover:bg-status-danger/90" onClick={softDelete} loading={deleting}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
