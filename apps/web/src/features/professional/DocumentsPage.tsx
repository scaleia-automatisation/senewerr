import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Download, Plus, Filter, Eye, StickyNote,
  FileImage, FileBarChart, ShieldCheck, FilePlus, Loader2, X,
} from 'lucide-react'
import { format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'

// ── Types ──────────────────────────────────────────────────────────────────────

type DocType = 'rapport' | 'resultat' | 'certificat' | 'consentement' | 'autre' | ''

interface Document {
  id: string
  patient_id: string
  patient_name: string
  patient_avatar?: string | null
  nom: string
  type: DocType
  created_at: string
  url: string
  taille_ko?: number | null
  mime_type?: string | null
}

interface PatientOpt {
  id: string
  nom: string
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<DocType, string> = {
  rapport:      'Rapport',
  resultat:     'Résultat',
  certificat:   'Certificat',
  consentement: 'Consentement',
  autre:        'Autre',
  '':           'Tous types',
}

const TYPE_ICON: Record<DocType, React.ReactNode> = {
  rapport:      <FileBarChart className="h-4 w-4" />,
  resultat:     <FileText className="h-4 w-4" />,
  certificat:   <ShieldCheck className="h-4 w-4" />,
  consentement: <FilePlus className="h-4 w-4" />,
  autre:        <FileImage className="h-4 w-4" />,
  '':           <FileText className="h-4 w-4" />,
}

const TYPE_OPTS = [
  { value: '',            label: 'Tous types' },
  { value: 'rapport',     label: 'Rapport' },
  { value: 'resultat',    label: 'Résultat' },
  { value: 'certificat',  label: 'Certificat' },
  { value: 'consentement',label: 'Consentement' },
  { value: 'autre',       label: 'Autre' },
]

const PERIODE_OPTS = [
  { value: 'tous',   label: 'Toutes périodes' },
  { value: 'mois',   label: 'Ce mois' },
  { value: '3mois',  label: '3 derniers mois' },
  { value: '6mois',  label: '6 derniers mois' },
]

const PAGE = 20

// ── Composant ──────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const db = supabase as any

  const [docs, setDocs]       = useState<Document[]>([])
  const [patients, setPatients] = useState<PatientOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter]     = useState<DocType>('')
  const [patientFilter, setPatientFilter] = useState('')
  const [periode, setPeriode] = useState('tous')
  const [page, setPage]       = useState(0)

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPatient, setUploadPatient] = useState('')
  const [uploadType, setUploadType]       = useState<DocType>('autre')
  const [uploadNom, setUploadNom]         = useState('')
  const [uploading, setUploading]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View modal
  const [viewDoc, setViewDoc] = useState<Document | null>(null)

  // Note modal
  const [noteDoc, setNoteDoc]   = useState<Document | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Load patients list
  useEffect(() => {
    if (!profile?.id) return
    db.from('praticien_patients')
      .select('patient_id, patient:patient_id(id, full_name)')
      .eq('praticien_id', profile.id)
      .eq('actif', true)
      .then(({ data }: any) => {
        setPatients((data ?? []).map((r: any) => ({
          id:  r.patient?.id ?? r.patient_id,
          nom: r.patient?.full_name ?? '—',
        })))
      })
  }, [profile?.id])

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const now = new Date()
    let dateMin: string | null = null
    if (periode === 'mois')  dateMin = startOfMonth(now).toISOString()
    if (periode === '3mois') dateMin = subMonths(now, 3).toISOString()
    if (periode === '6mois') dateMin = subMonths(now, 6).toISOString()

    // Documents partagés par patients avec ce praticien
    let q = db.from('patient_documents')
      .select(`
        id, patient_id, nom, type, created_at, url, taille_ko, mime_type,
        patient:patient_id ( full_name, avatar_url ),
        patient_professional_access!inner ( approved )
      `)
      .eq('patient_professional_access.praticien_id', profile.id)
      .eq('patient_professional_access.approved', true)
      .eq('shared_with_professionals', true)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    if (typeFilter) q = q.eq('type', typeFilter)
    if (patientFilter) q = q.eq('patient_id', patientFilter)
    if (dateMin) q = q.gte('created_at', dateMin)

    const { data } = await q
    let flat: Document[] = (data ?? []).map((d: any) => ({
      id:           d.id,
      patient_id:   d.patient_id,
      patient_name: d.patient?.full_name ?? '—',
      patient_avatar: d.patient?.avatar_url,
      nom:          d.nom,
      type:         d.type as DocType,
      created_at:   d.created_at,
      url:          d.url,
      taille_ko:    d.taille_ko,
      mime_type:    d.mime_type,
    }))

    if (search.trim()) {
      const s = search.toLowerCase()
      flat = flat.filter(d =>
        d.nom.toLowerCase().includes(s) ||
        d.patient_name.toLowerCase().includes(s)
      )
    }

    setDocs(flat)
    setLoading(false)
  }, [profile?.id, page, typeFilter, patientFilter, periode, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, typeFilter, patientFilter, periode])

  async function handleUpload() {
    if (!uploadFile || !uploadPatient || !uploadNom.trim()) {
      toast.error('Remplissez tous les champs')
      return
    }
    setUploading(true)
    try {
      const ext = uploadFile.name.split('.').pop() ?? 'bin'
      const path = `pro_docs/${profile!.id}/${uploadPatient}/${Date.now()}.${ext}`

      const { error: storErr } = await supabase.storage
        .from('patient-documents')
        .upload(path, uploadFile, { contentType: uploadFile.type })
      if (storErr) throw storErr

      const { data: urlData } = supabase.storage
        .from('patient-documents')
        .getPublicUrl(path)

      const { error: dbErr } = await db.from('patient_documents').insert({
        patient_id:                uploadPatient,
        praticien_id:              profile!.id,
        nom:                       uploadNom.trim(),
        type:                      uploadType,
        url:                       urlData.publicUrl,
        taille_ko:                 Math.round(uploadFile.size / 1024),
        mime_type:                 uploadFile.type,
        shared_with_professionals: true,
      })
      if (dbErr) throw dbErr

      toast.success('Document ajouté')
      setShowUpload(false)
      setUploadFile(null); setUploadNom(''); setUploadType('autre'); setUploadPatient('')
      await load()
    } catch (e: any) {
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  async function addToNotes() {
    if (!noteDoc || !noteText.trim()) return
    setSavingNote(true)
    try {
      await db.from('notes_internes').insert({
        praticien_id:              profile!.id,
        patient_id:                noteDoc.patient_id,
        contenu:                   `[Document : ${noteDoc.nom}]\n${noteText.trim()}`,
        shared_with_professionals: false,
      })
      toast.success('Note ajoutée au dossier')
      setNoteDoc(null)
      setNoteText('')
    } catch {
      toast.error('Erreur lors de l\'ajout de la note')
    } finally {
      setSavingNote(false)
    }
  }

  const patientSelectOpts = [
    { value: '', label: 'Tous les patients' },
    ...patients.map(p => ({ value: p.id, label: p.nom })),
  ]

  const patientUploadOpts = patients.map(p => ({ value: p.id, label: p.nom }))

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-s-2">
        <div className="relative flex-1 min-w-[160px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher par nom ou patient…"
            className="w-full rounded-lg border border-line bg-surface py-s-2 pl-s-3 pr-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
        </div>
        <Select options={patientSelectOpts} value={patientFilter} onValueChange={setPatientFilter} />
        <Select options={TYPE_OPTS}         value={typeFilter}     onValueChange={v => setTypeFilter(v as DocType)} />
        <Select options={PERIODE_OPTS}      value={periode}        onValueChange={setPeriode} />
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowUpload(true)}>
          Ajouter un document
        </Button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              {['Document', 'Patient', 'Type', 'Date', 'Taille', 'Actions'].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))
              : docs.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-s-3 py-s-12 text-center text-ink-3">
                      <FileText className="mx-auto mb-s-2 h-8 w-8 opacity-30" />
                      Aucun document
                    </td>
                  </tr>
                )
                : docs.map(doc => (
                  <tr key={doc.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-2">
                        <span className="text-ink-3 shrink-0">
                          {TYPE_ICON[doc.type] ?? <FileText className="h-4 w-4" />}
                        </span>
                        <span className="font-medium text-ink truncate max-w-[160px]">{doc.nom}</span>
                      </div>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <button
                        onClick={() => navigate(`/pro/patients/${doc.patient_id}`)}
                        className="flex items-center gap-s-2 hover:text-primary group"
                      >
                        <Avatar src={doc.patient_avatar} fallback={doc.patient_name} size="sm" />
                        <span className="text-ink group-hover:text-primary truncate max-w-[100px]">
                          {doc.patient_name}
                        </span>
                      </button>
                    </td>
                    <td className="px-s-3 py-s-2">
                      <Badge variant="neutral">{TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(doc.created_at), 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {doc.taille_ko ? `${doc.taille_ko} Ko` : '—'}
                    </td>
                    <td className="px-s-3 py-s-2">
                      <div className="flex items-center gap-s-1">
                        <button
                          onClick={() => setViewDoc(doc)}
                          className="rounded p-s-1 text-ink-3 hover:text-primary hover:bg-surface-2 transition-colors"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <a
                          href={doc.url}
                          download={doc.nom}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded p-s-1 text-ink-3 hover:text-primary hover:bg-surface-2 transition-colors"
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => { setNoteDoc(doc); setNoteText('') }}
                          className="rounded p-s-1 text-ink-3 hover:text-accent hover:bg-surface-2 transition-colors"
                          title="Ajouter aux notes"
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-s-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
        <span className="text-small text-ink-3">Page {page + 1}</span>
        <Button variant="ghost" size="sm" disabled={docs.length < PAGE} onClick={() => setPage(p => p + 1)}>Suivant</Button>
      </div>

      {/* ── Modal Upload ──────────────────────────────────────────────────────── */}
      <Modal open={showUpload} onOpenChange={open => { if (!open) setShowUpload(false) }} title="Ajouter un document">
        <div className="flex flex-col gap-s-4 p-s-4">
          {/* Patient */}
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Patient *</label>
            <select
              value={uploadPatient}
              onChange={e => setUploadPatient(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none"
            >
              <option value="">Sélectionner un patient…</option>
              {patientUploadOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Nom */}
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Nom du document *</label>
            <input
              value={uploadNom}
              onChange={e => setUploadNom(e.target.value)}
              placeholder="Ex : Résultat NFS 2026-09"
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Type</label>
            <select
              value={uploadType}
              onChange={e => setUploadType(e.target.value as DocType)}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:border-primary focus:outline-none"
            >
              {TYPE_OPTS.filter(o => o.value).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Fichier */}
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Fichier *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-s-2 rounded-lg border-2 border-dashed border-line py-s-4 text-small text-ink-3 hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-4 w-4" />
              {uploadFile ? uploadFile.name : 'Cliquer pour sélectionner (PDF, JPG, PNG, DOC)'}
            </button>
          </div>

          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Annuler</Button>
            <Button
              variant="primary"
              leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              disabled={uploading || !uploadFile || !uploadPatient || !uploadNom.trim()}
              onClick={handleUpload}
            >
              {uploading ? 'Upload…' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Viewer ──────────────────────────────────────────────────────── */}
      <Modal open={!!viewDoc} onOpenChange={open => { if (!open) setViewDoc(null) }}
        title={viewDoc?.nom ?? 'Document'}>
        {viewDoc && (
          <div className="flex flex-col gap-s-4 p-s-4">
            <div className="flex flex-col gap-s-1 text-small">
              <div className="flex gap-s-2">
                <span className="text-ink-3 w-20">Patient :</span>
                <span className="font-medium text-ink">{viewDoc.patient_name}</span>
              </div>
              <div className="flex gap-s-2">
                <span className="text-ink-3 w-20">Type :</span>
                <span className="text-ink">{TYPE_LABEL[viewDoc.type]}</span>
              </div>
              <div className="flex gap-s-2">
                <span className="text-ink-3 w-20">Ajouté :</span>
                <span className="text-ink">{format(parseISO(viewDoc.created_at), 'dd/MM/yyyy', { locale: fr })}</span>
              </div>
              {viewDoc.taille_ko && (
                <div className="flex gap-s-2">
                  <span className="text-ink-3 w-20">Taille :</span>
                  <span className="text-ink">{viewDoc.taille_ko} Ko</span>
                </div>
              )}
            </div>

            {viewDoc.mime_type?.startsWith('image/') ? (
              <img src={viewDoc.url} alt={viewDoc.nom} className="rounded-lg max-h-[60vh] object-contain" />
            ) : viewDoc.mime_type === 'application/pdf' ? (
              <iframe src={viewDoc.url} title={viewDoc.nom} className="w-full h-[60vh] rounded-lg border border-line" />
            ) : (
              <div className="flex flex-col items-center gap-s-3 py-s-8">
                <FileText className="h-12 w-12 text-ink-3 opacity-40" />
                <p className="text-small text-ink-3">Aperçu non disponible pour ce type de fichier.</p>
              </div>
            )}

            <div className="flex gap-s-2">
              <a href={viewDoc.url} download={viewDoc.nom} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" leftIcon={<Download className="h-4 w-4" />}>Télécharger</Button>
              </a>
              <Button variant="ghost" leftIcon={<StickyNote className="h-4 w-4" />}
                onClick={() => { setViewDoc(null); setNoteDoc(viewDoc); setNoteText('') }}>
                Ajouter aux notes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal Note ────────────────────────────────────────────────────────── */}
      <Modal open={!!noteDoc} onOpenChange={open => { if (!open) setNoteDoc(null) }}
        title="Ajouter aux notes du patient">
        {noteDoc && (
          <div className="flex flex-col gap-s-4 p-s-4">
            <p className="text-small text-ink-3">
              Ajout d'une note interne liée au document <strong className="text-ink">{noteDoc.nom}</strong>
              &nbsp;(patient : {noteDoc.patient_name}).
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-s-3">
              <p className="text-micro text-amber-700 font-medium">
                ⚠ Note interne — jamais visible par le patient
              </p>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Votre commentaire ou observation sur ce document…"
              rows={4}
              className="w-full rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-s-2">
              <Button variant="ghost" onClick={() => setNoteDoc(null)}>Annuler</Button>
              <Button
                variant="primary"
                leftIcon={savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                disabled={savingNote || !noteText.trim()}
                onClick={addToNotes}
              >
                {savingNote ? 'Enregistrement…' : 'Ajouter la note'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
