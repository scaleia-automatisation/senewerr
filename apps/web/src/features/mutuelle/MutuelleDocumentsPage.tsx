import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Upload, Download, Eye, FileText, Search, Grid, List as ListIcon,
  ArchiveIcon, RefreshCw, Plus, Printer, Trash2, X, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useMutuelle } from './MutuelleContext'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/mutuelle/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocCategorie = 'statuts' | 'agrement' | 'reglement' | 'tarifs' | 'ag' | 'autre'

interface MutuelleDoc {
  id: string
  nom: string
  categorie: DocCategorie
  taille: number
  storage_path: string
  url?: string
  archive: boolean
  created_at: string
}

interface AdherentDoc {
  id: string
  nom: string
  url: string
  type: string
  taille?: number
}

interface ContratRef {
  id: string
  numero_contrat: string
  statut: string
  adherent_id: string
  adherent_nom: string
  plan_nom: string
  date_fin: string
}

interface MutuelleTemplate {
  id: string
  nom: string
  slug: string
  contenu: string
  variables: string[]
}

interface RapportKpis {
  nbAdherents: number
  cotisationAttendue: number
  cotisationsPayees: number
  tauxRecouvrement: number
  rembsTotal: number
  montantRembourse: number
  tpValides: number
  montantTP: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFCFA(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' FCFA'
}

function formatBytes(b: number) {
  if (b < 1024) return b + ' o'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko'
  return (b / (1024 * 1024)).toFixed(1) + ' Mo'
}

const CATEGORIES: { value: DocCategorie; label: string }[] = [
  { value: 'statuts', label: 'Statuts' },
  { value: 'agrement', label: 'Agrément' },
  { value: 'reglement', label: 'Règlement intérieur' },
  { value: 'tarifs', label: 'Tarifs & barèmes' },
  { value: 'ag', label: 'Compte rendu AG' },
  { value: 'autre', label: 'Autre' },
]

const DEFAULT_TEMPLATES: MutuelleTemplate[] = [
  {
    id: 'tpl-carte', nom: 'Carte mutuelle', slug: 'carte_mutuelle',
    variables: ['{{nom}}', '{{n_contrat}}', '{{validite}}', '{{plan}}', '{{qr_code}}'],
    contenu: 'Carte de membre — {{nom}}\nN° {{n_contrat}} — Plan : {{plan}}\nValidité : {{validite}}',
  },
  {
    id: 'tpl-attestation', nom: "Attestation d'adhésion", slug: 'attestation_adhesion',
    variables: ['{{nom}}', '{{n_contrat}}', '{{date_adhesion}}', '{{plan}}', '{{mutuelle}}'],
    contenu: "La mutuelle {{mutuelle}} atteste que {{nom}} est adhérent depuis le {{date_adhesion}}.\nN° contrat : {{n_contrat}} — Plan : {{plan}}",
  },
  {
    id: 'tpl-refus', nom: 'Lettre de refus de remboursement', slug: 'lettre_refus',
    variables: ['{{nom}}', '{{n_demande}}', '{{motif}}', '{{date}}'],
    contenu: "Objet : Refus de votre demande de remboursement N° {{n_demande}}\n\nChèr(e) {{nom}},\n\nNous avons le regret de vous informer que votre demande de remboursement du {{date}} ne peut être prise en charge.\nMotif : {{motif}}\n\nCordialement,\nVotre mutuelle",
  },
  {
    id: 'tpl-suspension', nom: 'Lettre de suspension', slug: 'lettre_suspension',
    variables: ['{{nom}}', '{{n_contrat}}', '{{date_suspension}}', '{{motif}}'],
    contenu: "Objet : Suspension de votre couverture\n\nChèr(e) {{nom}},\n\nVotre couverture (N° {{n_contrat}}) est suspendue à compter du {{date_suspension}}.\nMotif : {{motif}}\n\nPour régulariser votre situation, veuillez contacter votre mutuelle.",
  },
  {
    id: 'tpl-bon-pc', nom: 'Bon de prise en charge (Tiers Payant)', slug: 'bon_prise_en_charge',
    variables: ['{{nom}}', '{{n_contrat}}', '{{prestataire}}', '{{acte}}', '{{taux}}', '{{validite}}'],
    contenu: "BON DE PRISE EN CHARGE\n\nAdhérent : {{nom}} — N° {{n_contrat}}\nPrestataire : {{prestataire}}\nActe : {{acte}}\nTaux de prise en charge : {{taux}}%\nValidité : {{validite}}",
  },
]

// ── Fonction d'impression ─────────────────────────────────────────────────────

function printHTML(html: string, title: string) {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) { toast.error('Autoriser les pop-ups pour imprimer'); return }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
      h1 { font-size: 20px; color: #1d3557; margin-bottom: 4px; }
      h2 { font-size: 15px; color: #1d3557; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 20px 0 12px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
      .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
      .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      .kpi-value { font-size: 22px; font-weight: 700; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f1f5f9; font-weight: 600; padding: 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
      td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
      .badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
      .badge-green { background: #d1fae5; color: #065f46; }
      .footer { margin-top: 32px; color: #94a3b8; font-size: 11px; text-align: center; }
      @media print { body { padding: 12px; } }
    </style>
  </head><body>${html}<script>setTimeout(()=>window.print(),400)</script></body></html>`)
  w.document.close()
}

function generateRapportHTML(data: any): string {
  const k: RapportKpis = data.kpis
  const [y, m] = data.periode.split('-')
  const moisNom = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-SN', { month: 'long', year: 'numeric' })

  const lignesRembs = (data.listeRemboursements ?? []).map((r: any) =>
    `<tr><td>${r.numero}</td><td>${r.adherent}</td><td style="text-align:right">${formatFCFA(r.montant)}</td><td>${r.date ? format(new Date(r.date + 'T00:00'), 'd/MM/yyyy') : '—'}</td></tr>`
  ).join('')

  return `
    <div class="header">
      <div>
        <h1>${data.mutuelle.nom}</h1>
        <div style="color:#64748b;font-size:12px">${data.mutuelle.adresse ?? ''} — Tél. ${data.mutuelle.telephone ?? ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:#2563eb">Rapport mensuel</div>
        <div style="color:#64748b">${moisNom}</div>
        <div style="color:#94a3b8;font-size:11px">Généré le ${format(new Date(), 'd MMMM yyyy', { locale: fr })}</div>
      </div>
    </div>

    <h2>Indicateurs clés</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Adhérents actifs</div><div class="kpi-value">${k.nbAdherents}</div></div>
      <div class="kpi"><div class="kpi-label">Cotisations encaissées</div><div class="kpi-value" style="color:#059669">${formatFCFA(k.cotisationsPayees)}</div></div>
      <div class="kpi"><div class="kpi-label">Taux recouvrement</div><div class="kpi-value" style="color:${k.tauxRecouvrement >= 80 ? '#059669' : '#dc2626'}">${k.tauxRecouvrement}%</div></div>
      <div class="kpi"><div class="kpi-label">Remboursements effectués</div><div class="kpi-value" style="color:#dc2626">${formatFCFA(k.montantRembourse)}</div></div>
      <div class="kpi"><div class="kpi-label">Demandes reçues</div><div class="kpi-value">${k.rembsTotal}</div></div>
      <div class="kpi"><div class="kpi-label">Tiers payant réglé</div><div class="kpi-value">${formatFCFA(k.montantTP)}</div></div>
    </div>

    ${lignesRembs ? `
    <h2>Remboursements effectués ce mois</h2>
    <table>
      <thead><tr><th>N° Demande</th><th>Adhérent</th><th style="text-align:right">Montant</th><th>Date</th></tr></thead>
      <tbody>${lignesRembs}</tbody>
    </table>` : ''}

    <div class="footer">Document généré par Sene Wérr — usage interne</div>
  `
}

// ── Modal upload ──────────────────────────────────────────────────────────────

function UploadModal({ open, onOpenChange, mutuelleId, onDone }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mutuelleId: string
  onDone: () => void
}) {
  const db = supabase as any
  const [file, setFile] = useState<File | null>(null)
  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState<DocCategorie>('autre')
  const [loading, setLoading] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!open) { setFile(null); setNom(''); setCategorie('autre') } }, [open])

  function onFilePick(f: File) {
    if (f.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return }
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.type)) {
      toast.error('Format accepté : PDF ou DOCX uniquement'); return
    }
    setFile(f)
    if (!nom) setNom(f.name.replace(/\.[^.]+$/, ''))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFilePick(f)
  }

  async function handleUpload() {
    if (!file || !nom.trim()) { toast.error('Nom et fichier requis'); return }
    setLoading(true)
    try {
      const ext = file.name.split('.').pop()
      const ts = Date.now()
      const storagePath = `${mutuelleId}/${categorie}/${ts}-${nom.trim().replace(/\s+/g, '_')}.${ext}`

      const { error: upErr } = await supabase.storage.from('mutuelle-docs').upload(storagePath, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr

      // Enregistrement métadonnées (table peut ne pas exister - géré silencieusement)
      await db.from('mutuelle_documents').insert({
        mutuelle_id: mutuelleId,
        nom: nom.trim(),
        categorie,
        storage_path: storagePath,
        taille: file.size,
        archive: false,
      }).select().single()

      toast.success('Document ajouté')
      onOpenChange(false); onDone()
    } catch (e: any) {
      toast.error('Erreur upload : ' + (e?.message ?? 'Vérifiez le bucket Supabase Storage'))
    } finally { setLoading(false) }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Uploader un document" size="md">
      <div className="space-y-s-4">
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('file-upload-input')?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-s-2 rounded-xl border-2 border-dashed p-s-8 transition-colors ${
            file ? 'border-primary bg-primary/5' : 'border-line bg-surface-2 hover:border-primary hover:bg-surface-3'
          }`}>
          <input id="file-upload-input" type="file" accept=".pdf,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFilePick(f) }} />
          {file ? (
            <>
              <FileText className="h-8 w-8 text-primary" />
              <p className="text-small font-medium text-ink">{file.name}</p>
              <p className="text-micro text-ink-3">{formatBytes(file.size)}</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-ink-3" />
              <p className="text-small font-medium text-ink">Glissez un fichier ou cliquez</p>
              <p className="text-micro text-ink-3">PDF ou DOCX — max 10 Mo</p>
            </>
          )}
        </div>

        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Nom du document *</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="mb-s-1 block text-small font-medium text-ink">Catégorie</label>
          <select value={categorie} onChange={e => setCategorie(e.target.value as DocCategorie)}
            className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="primary" loading={loading} disabled={!file} onClick={handleUpload} leftIcon={<Upload className="h-4 w-4" />}>
            Uploader
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function MutuelleDocumentsPage() {
  const { mutuelle } = useMutuelle()
  const db = supabase as any

  const [subTab, setSubTab] = useState<'mutuelle' | 'adherents' | 'modeles'>('mutuelle')

  // Docs mutuelle
  const [docs, setDocs] = useState<MutuelleDoc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [searchDocs, setSearchDocs] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)

  // Rapport mensuel
  const [rapportPeriode, setRapportPeriode] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [generatingRapport, setGeneratingRapport] = useState(false)

  // Adhérents
  const [searchAdherent, setSearchAdherent] = useState('')
  const [adherentResults, setAdherentResults] = useState<ContratRef[]>([])
  const [selectedAdherent, setSelectedAdherent] = useState<ContratRef | null>(null)
  const [adherentDocs, setAdherentDocs] = useState<AdherentDoc[]>([])
  const [loadingAdherentDocs, setLoadingAdherentDocs] = useState(false)
  const [generatingCarte, setGeneratingCarte] = useState(false)
  const [generatingAttestation, setGeneratingAttestation] = useState(false)

  // Modèles
  const [templates, setTemplates] = useState<MutuelleTemplate[]>(DEFAULT_TEMPLATES)
  const [editingTemplate, setEditingTemplate] = useState<MutuelleTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<MutuelleTemplate | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadDocs = useCallback(async () => {
    if (!mutuelle?.id) return
    setLoadingDocs(true)
    try {
      const { data } = await db.from('mutuelle_documents')
        .select('*')
        .eq('mutuelle_id', mutuelle.id)
        .order('created_at', { ascending: false })
      if (data) setDocs(data)
    } catch {
      // Table peut ne pas exister encore — fallback Storage
      try {
        const { data: files } = await supabase.storage.from('mutuelle-docs').list(mutuelle.id + '/', { limit: 200 })
        const rows: MutuelleDoc[] = (files ?? [])
          .filter((f: any) => f.name !== '.emptyFolderPlaceholder')
          .map((f: any) => ({
            id: f.id ?? f.name,
            nom: f.name,
            categorie: 'autre' as const,
            taille: f.metadata?.size ?? 0,
            storage_path: `${mutuelle.id}/${f.name}`,
            archive: false,
            created_at: f.created_at ?? new Date().toISOString(),
          }))
        setDocs(rows)
      } catch { /* Storage pas configuré */ }
    } finally { setLoadingDocs(false) }
  }, [mutuelle?.id])

  const loadTemplates = useCallback(async () => {
    if (!mutuelle?.id) return
    try {
      const { data } = await db.from('mutuelle_templates').select('*').eq('mutuelle_id', mutuelle.id)
      if (data?.length) setTemplates(data)
    } catch { /* table may not exist, keep defaults */ }
  }, [mutuelle?.id])

  useEffect(() => { loadDocs(); loadTemplates() }, [loadDocs, loadTemplates])

  // ── Actions docs mutuelle ─────────────────────────────────────────────────────

  async function getSignedUrl(doc: MutuelleDoc) {
    const { data } = await supabase.storage.from('mutuelle-docs').createSignedUrl(doc.storage_path, 3600)
    return data?.signedUrl ?? null
  }

  async function handlePreview(doc: MutuelleDoc) {
    const url = await getSignedUrl(doc)
    if (url) setPdfPreviewUrl(url)
    else toast.error('Impossible de charger le document')
  }

  async function handleDownload(doc: MutuelleDoc) {
    const url = await getSignedUrl(doc)
    if (!url) { toast.error('Impossible de télécharger'); return }
    const a = document.createElement('a'); a.href = url; a.download = doc.nom; a.click()
  }

  async function handleArchive(doc: MutuelleDoc) {
    try {
      await db.from('mutuelle_documents').update({ archive: true }).eq('id', doc.id)
      setDocs(d => d.map(x => x.id === doc.id ? { ...x, archive: true } : x))
      toast.success('Document archivé')
    } catch { toast.error('Erreur archivage') }
  }

  async function handleDelete(doc: MutuelleDoc) {
    try {
      await supabase.storage.from('mutuelle-docs').remove([doc.storage_path])
      await db.from('mutuelle_documents').delete().eq('id', doc.id)
      setDocs(d => d.filter(x => x.id !== doc.id))
      toast.success('Document supprimé')
    } catch { toast.error('Erreur suppression') }
  }

  // ── Rapport mensuel ───────────────────────────────────────────────────────────

  async function handleGenererRapport() {
    setGeneratingRapport(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-rapport-mutuelle', {
        body: { periode: rapportPeriode },
      })
      if (error) throw error
      const html = generateRapportHTML(data?.data ?? data)
      const [y, m] = rapportPeriode.split('-')
      const titre = `Rapport ${new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-SN', { month: 'long', year: 'numeric' })}`
      printHTML(html, titre)
    } catch { toast.error('Erreur génération rapport') }
    finally { setGeneratingRapport(false) }
  }

  // ── Adhérent search ───────────────────────────────────────────────────────────

  async function searchAdherents(q: string) {
    if (!q.trim() || !mutuelle?.id) { setAdherentResults([]); return }
    const { data } = await db.from('contrats')
      .select(`
        id, numero_contrat, statut, date_fin,
        adherent_id,
        profiles!contrats_adherent_id_fkey(full_name),
        plans_mutuelle!contrats_plan_id_fkey(nom)
      `)
      .eq('mutuelle_id', mutuelle.id)
      .or(`numero_contrat.ilike.%${q}%`)
      .limit(10)

    // Also search by name via join (Supabase limitation: filter on join column)
    const { data: byName } = await db.from('profiles')
      .select('id')
      .ilike('full_name', `%${q}%`)
      .limit(20)

    const profileIds = (byName ?? []).map((p: any) => p.id)
    let extra: any[] = []
    if (profileIds.length > 0) {
      const { data: extraContrats } = await db.from('contrats')
        .select(`id, numero_contrat, statut, date_fin, adherent_id, profiles!contrats_adherent_id_fkey(full_name), plans_mutuelle!contrats_plan_id_fkey(nom)`)
        .eq('mutuelle_id', mutuelle.id)
        .in('adherent_id', profileIds)
        .limit(10)
      extra = extraContrats ?? []
    }

    const all = [...(data ?? []), ...extra]
    const seen = new Set<string>()
    const rows: ContratRef[] = all.filter((c: any) => !seen.has(c.id) && seen.add(c.id)).map((c: any) => ({
      id: c.id,
      numero_contrat: c.numero_contrat,
      statut: c.statut,
      adherent_id: c.adherent_id,
      adherent_nom: (c.profiles as any)?.full_name ?? '—',
      plan_nom: (c.plans_mutuelle as any)?.nom ?? '—',
      date_fin: c.date_fin ?? '',
    }))
    setAdherentResults(rows)
  }

  async function selectAdherent(c: ContratRef) {
    setSelectedAdherent(c)
    setAdherentResults([])
    setSearchAdherent(c.adherent_nom)
    setLoadingAdherentDocs(true)
    try {
      const { data } = await db.from('remboursement_demandes')
        .select('id, numero_demande, documents_demande(id, nom, url, type)')
        .eq('mutuelle_id', mutuelle!.id)
        .eq('adherent_id', c.adherent_id)
        .limit(20)

      const docs: AdherentDoc[] = []
      for (const d of (data ?? [])) {
        for (const doc of ((d as any).documents_demande ?? [])) {
          docs.push({ id: doc.id, nom: doc.nom ?? 'Document', url: doc.url, type: doc.type ?? 'doc' })
        }
      }
      setAdherentDocs(docs)
    } finally { setLoadingAdherentDocs(false) }
  }

  async function handleGetCarte() {
    if (!selectedAdherent) return
    setGeneratingCarte(true)
    try {
      const { data, error } = await supabase.functions.invoke('get-carte-mutuelle', {
        body: { contratId: selectedAdherent.id },
      })
      if (error) throw error
      const d = data?.data ?? data
      const qrData = `adherent:${d.adherentNom}|contrat:${d.numeroContrat}|token:${(d.qrToken ?? '').slice(0, 20)}`
      const html = `
        <style>
          body{font-family:sans-serif;display:flex;justify-content:center;padding:32px}
          .carte{width:340px;border:2px solid #2563eb;border-radius:16px;padding:24px;background:linear-gradient(135deg,#eff6ff,#dbeafe)}
          .h1{font-size:22px;font-weight:700;margin:0 0 4px}
          .mono{font-family:monospace;color:#334155;font-size:13px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;background:#fff9;border-radius:8px;padding:12px;font-size:12px}
          .label{color:#64748b}.val{font-weight:600;color:#111}
          .qr{width:90px;height:90px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;text-align:center;padding:4px}
        </style>
        <div class="carte">
          <div style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1px">${d.mutuelleNom}</div>
          <div class="h1">${d.adherentNom}</div>
          <div class="mono">${d.numeroContrat}</div>
          <div class="grid">
            <div><div class="label">Plan</div><div class="val">${d.planNom}</div></div>
            <div><div class="label">Type</div><div class="val" style="text-transform:capitalize">${d.typeCouverture}</div></div>
            <div><div class="label">Début</div><div class="val">${d.dateDebut ? format(new Date(d.dateDebut), 'd MMM yyyy', { locale: fr }) : '—'}</div></div>
            <div><div class="label">Fin</div><div class="val">${d.dateFin ? format(new Date(d.dateFin), 'd MMM yyyy', { locale: fr }) : '—'}</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="qr">QR Code<br/>${(d.qrToken ?? '').slice(-8)}</div>
            <div style="text-align:right;font-size:11px;color:#64748b">
              Tél. ${d.mutuelleTelephone}<br/>
              ${d.groupeSanguin ? `Gr. ${d.groupeSanguin}` : ''}
            </div>
          </div>
        </div>
      `
      printHTML(html, `Carte mutuelle — ${d.adherentNom}`)
    } catch { toast.error('Erreur génération carte') }
    finally { setGeneratingCarte(false) }
  }

  function handleGetAttestation() {
    if (!selectedAdherent) return
    setGeneratingAttestation(true)
    const html = `
      <style>body{font-family:sans-serif;padding:48px;max-width:600px;margin:auto} h1{color:#1d3557;font-size:22px} .section{margin:24px 0} .field{display:flex;gap:16px;margin:8px 0} .label{color:#64748b;width:140px;flex-shrink:0} .val{font-weight:600}</style>
      <h1>Attestation d'adhésion</h1>
      <p style="color:#64748b">La mutuelle atteste que :</p>
      <div class="section">
        <div class="field"><div class="label">Nom complet</div><div class="val">${selectedAdherent.adherent_nom}</div></div>
        <div class="field"><div class="label">N° Contrat</div><div class="val" style="font-family:monospace">${selectedAdherent.numero_contrat}</div></div>
        <div class="field"><div class="label">Plan</div><div class="val">${selectedAdherent.plan_nom}</div></div>
        <div class="field"><div class="label">Statut</div><div class="val">${selectedAdherent.statut}</div></div>
        <div class="field"><div class="label">Fin de validité</div><div class="val">${selectedAdherent.date_fin ? format(new Date(selectedAdherent.date_fin), 'd MMMM yyyy', { locale: fr }) : '—'}</div></div>
      </div>
      <p>est bien adhérent à notre mutuelle et bénéficie de la couverture prévue dans son contrat.</p>
      <div style="margin-top:48px;display:flex;justify-content:flex-end"><div style="border-top:1px solid #cbd5e1;padding-top:8px;color:#64748b;font-size:12px">Signature du gestionnaire<br/><br/><br/></div></div>
      <div style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px">Document généré le ${format(new Date(), 'd MMMM yyyy', { locale: fr })}</div>
    `
    printHTML(html, `Attestation — ${selectedAdherent.adherent_nom}`)
    setTimeout(() => setGeneratingAttestation(false), 500)
  }

  // ── Templates ─────────────────────────────────────────────────────────────────

  async function handleSaveTemplate(tpl: MutuelleTemplate) {
    if (!mutuelle?.id) return
    setSavingTemplate(true)
    try {
      await db.from('mutuelle_templates').upsert({
        id: tpl.id.startsWith('tpl-') ? undefined : tpl.id,
        mutuelle_id: mutuelle.id,
        nom: tpl.nom, slug: tpl.slug, contenu: tpl.contenu, variables: tpl.variables,
      })
      setTemplates(ts => ts.map(t => t.id === tpl.id ? tpl : t))
      setEditingTemplate(null)
      toast.success('Modèle sauvegardé')
    } catch { toast.error('Erreur sauvegarde modèle') }
    finally { setSavingTemplate(false) }
  }

  function handlePreviewTemplate(tpl: MutuelleTemplate) {
    const exemples: Record<string, string> = {
      '{{nom}}': 'Moussa Diallo', '{{n_contrat}}': 'SW-2024-00123',
      '{{validite}}': '31 Dec 2025', '{{plan}}': 'Plan Standard',
      '{{qr_code}}': '[QR CODE]', '{{mutuelle}}': mutuelle?.nom ?? 'Sene Wérr',
      '{{date_adhesion}}': '01 Jan 2024', '{{n_demande}}': 'DEM-2024-0042',
      '{{motif}}': 'Document manquant', '{{date}}': format(new Date(), 'd MMMM yyyy', { locale: fr }),
      '{{date_suspension}}': format(new Date(), 'd MMMM yyyy', { locale: fr }),
      '{{prestataire}}': 'Pharmacie Central', '{{acte}}': 'Médicaments', '{{taux}}': '80',
    }
    let contenu = tpl.contenu
    for (const [k, v] of Object.entries(exemples)) contenu = contenu.replaceAll(k, v)
    const html = `<pre style="font-family:inherit;white-space:pre-wrap;line-height:1.7;font-size:14px">${contenu}</pre>`
    printHTML(html, `Prévisualisation — ${tpl.nom}`)
  }

  // ── Filtres docs ──────────────────────────────────────────────────────────────

  const filteredDocs = docs
    .filter(d => showArchived || !d.archive)
    .filter(d => !searchDocs || d.nom.toLowerCase().includes(searchDocs.toLowerCase()))

  const TABS = [
    { id: 'mutuelle' as const, label: 'Documents mutuelle' },
    { id: 'adherents' as const, label: 'Adhérents' },
    { id: 'modeles' as const, label: 'Modèles' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-s-4 p-s-4 md:p-s-6">
      <h1 className="font-display text-h1 font-semibold text-ink">Documents</h1>

      {/* Sous-onglets */}
      <div className="flex gap-s-1 overflow-x-auto border-b border-line">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`shrink-0 border-b-2 -mb-px px-s-4 py-s-2.5 text-small font-medium transition-colors ${
              subTab === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Documents mutuelle ─────────────────────────────────────────────── */}
      {subTab === 'mutuelle' && (
        <section>
          {/* Rapport mensuel */}
          <div className="mb-s-4 flex flex-wrap items-center gap-s-3 rounded-xl border border-line bg-surface p-s-4">
            <div className="flex items-center gap-s-2">
              <Printer className="h-5 w-5 text-primary" />
              <p className="text-small font-semibold text-ink">Rapport mensuel</p>
            </div>
            <input type="month" value={rapportPeriode} onChange={e => setRapportPeriode(e.target.value)}
              className="rounded-lg border border-line bg-surface px-s-3 py-s-1.5 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            <Button variant="secondary" size="sm" loading={generatingRapport} onClick={handleGenererRapport}
              leftIcon={<Printer className="h-4 w-4" />}>
              Générer et imprimer
            </Button>
          </div>

          {/* Barre d'outils */}
          <div className="mb-s-3 flex flex-wrap items-center gap-s-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input value={searchDocs} onChange={e => setSearchDocs(e.target.value)} placeholder="Rechercher…"
                className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button onClick={() => setShowArchived(v => !v)}
              className={`flex items-center gap-s-1 rounded-full px-s-3 py-s-1.5 text-micro font-medium border ${showArchived ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-surface text-ink-3 hover:text-ink'}`}>
              <ArchiveIcon className="h-3.5 w-3.5" />
              {showArchived ? 'Masquer archivés' : 'Voir archivés'}
            </button>
            <div className="flex gap-s-1 rounded-lg border border-line p-s-0.5">
              <button onClick={() => setViewMode('list')} className={`rounded p-s-1.5 ${viewMode === 'list' ? 'bg-surface-2' : ''}`}><ListIcon className="h-4 w-4 text-ink-3" /></button>
              <button onClick={() => setViewMode('grid')} className={`rounded p-s-1.5 ${viewMode === 'grid' ? 'bg-surface-2' : ''}`}><Grid className="h-4 w-4 text-ink-3" /></button>
            </div>
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
              Uploader
            </Button>
          </div>

          {loadingDocs ? (
            <div className="space-y-s-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />)}</div>
          ) : filteredDocs.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} message="Aucun document" description="Uploadez vos premiers documents officiels avec le bouton ci-dessus." />
          ) : viewMode === 'list' ? (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-small">
                <thead className="bg-surface-2 border-b border-line">
                  <tr>
                    {['Nom', 'Catégorie', 'Taille', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-s-3 py-s-3 text-left font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredDocs.map(d => (
                    <tr key={d.id} className={`hover:bg-surface-2/50 ${d.archive ? 'opacity-60' : ''}`}>
                      <td className="px-s-3 py-s-3">
                        <div className="flex items-center gap-s-2">
                          <FileText className="h-4 w-4 shrink-0 text-ink-3" />
                          <span className="font-medium text-ink truncate max-w-[180px]">{d.nom}</span>
                          {d.archive && <span className="rounded-full bg-surface-2 px-s-1.5 py-s-0.5 text-micro text-ink-3">Archivé</span>}
                        </div>
                      </td>
                      <td className="px-s-3 py-s-3 text-ink-3 capitalize">{CATEGORIES.find(c => c.value === d.categorie)?.label ?? d.categorie}</td>
                      <td className="px-s-3 py-s-3 text-ink-3">{d.taille ? formatBytes(d.taille) : '—'}</td>
                      <td className="px-s-3 py-s-3 text-ink-3">{d.created_at ? format(parseISO(d.created_at), 'd MMM yyyy', { locale: fr }) : '—'}</td>
                      <td className="px-s-3 py-s-3">
                        <div className="flex gap-s-1">
                          <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => handlePreview(d)}>Voir</Button>
                          <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => handleDownload(d)}>DL</Button>
                          {!d.archive && <Button variant="ghost" size="sm" leftIcon={<ArchiveIcon className="h-3.5 w-3.5" />} onClick={() => handleArchive(d)}>Archiver</Button>}
                          <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => handleDelete(d)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-s-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredDocs.map(d => (
                <div key={d.id} className={`rounded-xl border border-line bg-surface p-s-4 flex flex-col gap-s-2 ${d.archive ? 'opacity-60' : ''}`}>
                  <FileText className="h-8 w-8 text-primary/60" />
                  <p className="text-small font-medium text-ink truncate">{d.nom}</p>
                  <p className="text-micro text-ink-3">{CATEGORIES.find(c => c.value === d.categorie)?.label ?? d.categorie}</p>
                  <div className="flex gap-s-1 mt-auto">
                    <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => handlePreview(d)}>Voir</Button>
                    <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => handleDownload(d)}>DL</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Documents adhérents ─────────────────────────────────────────────── */}
      {subTab === 'adherents' && (
        <section>
          {/* Recherche */}
          <div className="relative mb-s-4">
            <Search className="absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={searchAdherent}
              onChange={e => { setSearchAdherent(e.target.value); searchAdherents(e.target.value) }}
              placeholder="Nom de l'adhérent ou N° de contrat…"
              className="w-full rounded-lg border border-line bg-surface py-s-2.5 pl-s-9 pr-s-3 text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {adherentResults.length > 0 && (
              <div className="absolute z-10 mt-s-1 w-full rounded-xl border border-line bg-surface shadow-xl overflow-hidden">
                {adherentResults.map(c => (
                  <button key={c.id} onClick={() => selectAdherent(c)}
                    className="flex w-full items-center justify-between px-s-4 py-s-3 text-left text-small hover:bg-surface-2">
                    <div>
                      <p className="font-medium text-ink">{c.adherent_nom}</p>
                      <p className="font-mono text-micro text-ink-3">{c.numero_contrat} — {c.plan_nom}</p>
                    </div>
                    <span className={`rounded-full px-s-2 py-s-0.5 text-micro font-semibold ${c.statut === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-ink-3'}`}>{c.statut}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedAdherent ? (
            <div className="space-y-s-4">
              {/* En-tête adhérent */}
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-s-4">
                <div>
                  <p className="font-semibold text-ink">{selectedAdherent.adherent_nom}</p>
                  <p className="font-mono text-micro text-ink-3">{selectedAdherent.numero_contrat} — {selectedAdherent.plan_nom}</p>
                </div>
                <button onClick={() => { setSelectedAdherent(null); setSearchAdherent(''); setAdherentDocs([]) }}>
                  <X className="h-5 w-5 text-ink-3 hover:text-ink" />
                </button>
              </div>

              {/* Documents officiels */}
              <div className="rounded-xl border border-line overflow-hidden">
                <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
                  <p className="font-semibold text-ink">Documents officiels</p>
                </div>
                <div className="divide-y divide-line">
                  <div className="flex items-center justify-between px-s-4 py-s-3">
                    <div>
                      <p className="text-small font-medium text-ink">Carte mutuelle</p>
                      <p className="text-micro text-ink-3">Carte avec QR code d'éligibilité (JWT signé)</p>
                    </div>
                    <div className="flex gap-s-2">
                      <Button variant="secondary" size="sm" loading={generatingCarte} leftIcon={<Printer className="h-4 w-4" />} onClick={handleGetCarte}>
                        Générer / Imprimer
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-s-4 py-s-3">
                    <div>
                      <p className="text-small font-medium text-ink">Attestation d'adhésion</p>
                      <p className="text-micro text-ink-3">Document officiel certifiant l'adhésion</p>
                    </div>
                    <Button variant="secondary" size="sm" loading={generatingAttestation} leftIcon={<Printer className="h-4 w-4" />} onClick={handleGetAttestation}>
                      Générer / Imprimer
                    </Button>
                  </div>
                  <div className="flex items-center justify-between px-s-4 py-s-3">
                    <div>
                      <p className="text-small font-medium text-ink">Certificat de prise en charge</p>
                      <p className="text-micro text-ink-3">Disponible lors d'une demande de TP approuvée</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toast.info('Visible depuis l\'onglet Tiers Payant')}>
                      Voir TP
                    </Button>
                  </div>
                </div>
              </div>

              {/* Justificatifs soumis */}
              <div className="rounded-xl border border-line overflow-hidden">
                <div className="border-b border-line bg-surface-2 px-s-4 py-s-3">
                  <div className="flex items-center gap-s-2">
                    <p className="font-semibold text-ink">Justificatifs soumis</p>
                    <div className="rounded-full bg-amber-100 px-s-2 py-s-0.5 text-micro text-amber-700">
                      Documents de santé — stockage sécurisé
                    </div>
                  </div>
                </div>
                {loadingAdherentDocs ? (
                  <div className="p-s-4 space-y-s-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />)}</div>
                ) : adherentDocs.length === 0 ? (
                  <div className="p-s-6 text-center text-small text-ink-3">Aucun justificatif soumis par cet adhérent</div>
                ) : (
                  <div className="divide-y divide-line">
                    {adherentDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between px-s-4 py-s-3">
                        <div className="flex items-center gap-s-2">
                          <FileText className="h-4 w-4 text-ink-3" />
                          <div>
                            <p className="text-small font-medium text-ink">{d.nom}</p>
                            <p className="text-micro text-ink-3 uppercase">{d.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-s-2">
                          <a href={d.url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />}>Voir</Button>
                          </a>
                          <a href={d.url} download>
                            <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>DL</Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Search className="h-8 w-8" />} message="Recherchez un adhérent" description="Tapez son nom ou son numéro de contrat pour voir ses documents." />
          )}
        </section>
      )}

      {/* ─── Modèles ────────────────────────────────────────────────────────── */}
      {subTab === 'modeles' && (
        <section>
          {editingTemplate ? (
            <div className="space-y-s-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-ink">Modifier : {editingTemplate.nom}</h2>
                <Button variant="ghost" size="sm" leftIcon={<X className="h-4 w-4" />} onClick={() => setEditingTemplate(null)}>Annuler</Button>
              </div>
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Contenu du modèle</label>
                <p className="mb-s-2 text-micro text-ink-3">Variables disponibles : {editingTemplate.variables.join(', ')}</p>
                <textarea
                  value={editingTemplate.contenu}
                  onChange={e => setEditingTemplate(t => t ? { ...t, contenu: e.target.value } : t)}
                  rows={12}
                  className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 font-mono text-small text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />
              </div>
              <div className="flex gap-s-2 justify-end">
                <Button variant="secondary" onClick={() => handlePreviewTemplate(editingTemplate)} leftIcon={<Eye className="h-4 w-4" />}>Prévisualiser</Button>
                <Button variant="primary" loading={savingTemplate} onClick={() => handleSaveTemplate(editingTemplate)} leftIcon={<RefreshCw className="h-4 w-4" />}>Sauvegarder</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              {templates.map((tpl, i) => (
                <div key={tpl.id} className={`flex items-center justify-between px-s-4 py-s-3 ${i > 0 ? 'border-t border-line' : ''} hover:bg-surface-2/50`}>
                  <div>
                    <p className="text-small font-medium text-ink">{tpl.nom}</p>
                    <p className="text-micro text-ink-3">{tpl.variables.join(' · ')}</p>
                  </div>
                  <div className="flex gap-s-2">
                    <Button variant="ghost" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => handlePreviewTemplate(tpl)}>Prévisualiser</Button>
                    <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setEditingTemplate({ ...tpl })}>Modifier</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {mutuelle?.id && (
        <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} mutuelleId={mutuelle.id} onDone={loadDocs} />
      )}

      {/* PDF viewer inline */}
      <Modal open={!!pdfPreviewUrl} onOpenChange={v => { if (!v) setPdfPreviewUrl(null) }} title="Aperçu document" size="xl">
        {pdfPreviewUrl && (
          <div className="flex flex-col gap-s-3">
            <iframe src={pdfPreviewUrl} className="h-[60vh] w-full rounded-lg border border-line" title="Document" />
            <div className="flex justify-end gap-s-2">
              <a href={pdfPreviewUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />}>Télécharger</Button>
              </a>
              <Button variant="ghost" onClick={() => setPdfPreviewUrl(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
