import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Pencil, Plus, X, Upload, FileText, Image, AlertTriangle,
  Activity, Stethoscope, Pill, FolderOpen, BarChart2, ShieldAlert,
  Check, Loader2, Eye, Download,
} from 'lucide-react'
import {
  format, parseISO, differenceInYears, subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { AllergyBadge } from '@/components/praticien/AllergyBadge'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientProfile {
  id: string
  full_name: string
  date_naissance?: string | null
  sexe?: string | null
  avatar_url?: string | null
  telephone?: string | null
  email?: string | null
}

interface DossierMedical {
  groupe_sanguin?: string | null
  allergies: string[]
  pathologies_chroniques: string[]
  antecedents_medicaux?: string | null
  antecedents_chirurgicaux?: string | null
  antecedents_familiaux?: string | null
  vaccinations?: VaccinEntry[]
  traitements_chroniques?: string[]
}

interface VaccinEntry {
  nom: string
  date: string
  rappel?: string | null
}

interface Consultation {
  id: string
  starts_at: string
  motif?: string | null
  duration_minutes?: number | null
  status: string
  notes_soap?: string | null
  has_ordonnance: boolean
}

interface Ordonnance {
  id: string
  created_at: string
  statut: string
  medicaments?: Array<{ nom: string; posologie: string }>
  valide_jusqu?: string | null
}

interface Document {
  id: string
  nom: string
  type: string
  url: string
  created_at: string
  size_bytes?: number | null
}

interface Constante {
  id: string
  mesure_at: string
  poids_kg?: number | null
  taille_cm?: number | null
  tension_systolique?: number | null
  tension_diastolique?: number | null
  frequence_cardiaque?: number | null
  temperature_c?: number | null
  saturation_o2?: number | null
  glycemie_mmol?: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function imc(poids?: number | null, taille?: number | null): string | null {
  if (!poids || !taille) return null
  const val = poids / ((taille / 100) ** 2)
  return val.toFixed(1)
}

function imcLabel(v: number): string {
  if (v < 18.5) return 'Insuffisance pondérale'
  if (v < 25)   return 'Normal'
  if (v < 30)   return 'Surpoids'
  return 'Obésité'
}

const ORDONNANCE_STATUS_VARIANT: Record<string, 'success'|'neutral'|'pending'|'danger'> = {
  active:               'success',
  expiree:              'neutral',
  dispensee_partielle:  'pending',
  terminee:             'neutral',
}

const DOC_ICONS: Record<string, React.ReactNode> = {
  pdf:    <FileText className="h-5 w-5 text-red-500" />,
  image:  <Image className="h-5 w-5 text-blue-500" />,
  autre:  <FolderOpen className="h-5 w-5 text-ink-3" />,
}

// ── Tab: Résumé clinique ──────────────────────────────────────────────────────

function TabResume({ patientId, dossier, onRefresh }: {
  patientId: string
  dossier: DossierMedical
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal]     = useState({ ...dossier })
  const [newAllergie, setNewAllergie] = useState('')
  const [newVaccin,   setNewVaccin]   = useState({ nom: '', date: '', rappel: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => { setLocal({ ...dossier }) }, [dossier])

  const PATHOLOGIES_TAGS = ['Diabète', 'HTA', 'Asthme', 'Drépanocytose', 'Autre']

  function togglePatho(p: string) {
    setLocal(d => ({
      ...d,
      pathologies_chroniques: d.pathologies_chroniques.includes(p)
        ? d.pathologies_chroniques.filter(x => x !== p)
        : [...d.pathologies_chroniques, p],
    }))
  }

  function addAllergie() {
    const v = newAllergie.trim()
    if (v && !local.allergies.includes(v)) {
      setLocal(d => ({ ...d, allergies: [...d.allergies, v] }))
    }
    setNewAllergie('')
  }

  function addVaccin() {
    if (!newVaccin.nom || !newVaccin.date) return
    setLocal(d => ({
      ...d,
      vaccinations: [...(d.vaccinations ?? []), {
        nom: newVaccin.nom, date: newVaccin.date, rappel: newVaccin.rappel || null,
      }],
    }))
    setNewVaccin({ nom: '', date: '', rappel: '' })
  }

  async function save() {
    setLoading(true)
    const { error } = await supabase.functions.invoke('update-dossier-medical', {
      body: {
        patient_id: patientId,
        allergies:              local.allergies,
        pathologies_chroniques: local.pathologies_chroniques,
        antecedents_medicaux:   local.antecedents_medicaux,
        antecedents_chirurgicaux: local.antecedents_chirurgicaux,
        antecedents_familiaux:  local.antecedents_familiaux,
        vaccinations:           local.vaccinations,
        traitements_chroniques: local.traitements_chroniques,
        groupe_sanguin:         local.groupe_sanguin,
      }
    })
    setLoading(false)
    if (error) { toast.error('Erreur sauvegarde'); return }
    toast.success('Dossier mis à jour')
    setEditing(false)
    onRefresh()
  }

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Résumé clinique</h3>
        {!editing
          ? <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Modifier</Button>
          : (
            <div className="flex gap-s-2">
              <Button variant="ghost" size="sm" onClick={() => { setLocal({ ...dossier }); setEditing(false) }}>Annuler</Button>
              <Button variant="primary" size="sm" loading={loading} leftIcon={<Check className="h-4 w-4" />} onClick={save}>Enregistrer</Button>
            </div>
          )
        }
      </div>

      {/* Allergies */}
      <Card className="p-s-4">
        <div className="flex items-center justify-between mb-s-2">
          <h4 className="font-medium text-ink flex items-center gap-s-1">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Allergies
          </h4>
        </div>
        {local.allergies.length === 0
          ? <p className="text-small text-ink-3">Aucune allergie connue</p>
          : (
            <div className="flex flex-wrap gap-s-1">
              {local.allergies.map(a => (
                <span key={a} className="flex items-center gap-s-1 rounded-pill bg-red-100 px-s-2 py-0.5 text-micro font-medium text-red-700">
                  {a}
                  {editing && (
                    <button onClick={() => setLocal(d => ({ ...d, allergies: d.allergies.filter(x => x !== a) }))} className="hover:text-red-900">×</button>
                  )}
                </span>
              ))}
            </div>
          )
        }
        {editing && (
          <div className="mt-s-2 flex gap-s-2">
            <Input value={newAllergie} onChange={e => setNewAllergie(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAllergie())}
              placeholder="Ajouter une allergie…" className="flex-1" />
            <Button variant="secondary" size="sm" onClick={addAllergie}>+</Button>
          </div>
        )}
      </Card>

      {/* Pathologies chroniques */}
      <Card className="p-s-4">
        <h4 className="mb-s-2 font-medium text-ink">Pathologies chroniques</h4>
        {editing
          ? (
            <div className="flex flex-wrap gap-s-2">
              {PATHOLOGIES_TAGS.map(p => (
                <button key={p} onClick={() => togglePatho(p)}
                  className={cn(
                    'rounded-pill border px-s-3 py-s-1 text-small transition-colors',
                    local.pathologies_chroniques.includes(p)
                      ? 'border-primary bg-primary text-white'
                      : 'border-line bg-surface text-ink hover:border-primary',
                  )}>
                  {p}
                </button>
              ))}
            </div>
          )
          : local.pathologies_chroniques.length === 0
            ? <p className="text-small text-ink-3">Aucune</p>
            : (
              <div className="flex flex-wrap gap-s-1">
                {local.pathologies_chroniques.map(p => (
                  <Badge key={p} variant="accent">{p}</Badge>
                ))}
              </div>
            )
        }
      </Card>

      {/* Antécédents */}
      {(['antecedents_medicaux', 'antecedents_chirurgicaux', 'antecedents_familiaux'] as const).map(field => {
        const labels: Record<string, string> = {
          antecedents_medicaux:     'Antécédents médicaux',
          antecedents_chirurgicaux: 'Antécédents chirurgicaux',
          antecedents_familiaux:    'Antécédents familiaux',
        }
        return (
          <Card key={field} className="p-s-4">
            <h4 className="mb-s-2 font-medium text-ink">{labels[field]}</h4>
            {editing
              ? (
                <textarea
                  className="w-full rounded-lg border border-line bg-surface p-s-2 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
                  rows={3}
                  value={local[field] ?? ''}
                  onChange={e => setLocal(d => ({ ...d, [field]: e.target.value }))}
                  placeholder="Saisir les antécédents…"
                />
              )
              : <p className="text-small text-ink-2 whitespace-pre-wrap">{local[field] || <span className="text-ink-3">Non renseigné</span>}</p>
            }
          </Card>
        )
      })}

      {/* Vaccinations */}
      <Card className="p-s-4">
        <h4 className="mb-s-3 font-medium text-ink">Vaccinations</h4>
        {(local.vaccinations ?? []).length === 0
          ? <p className="text-small text-ink-3">Aucune vaccination enregistrée</p>
          : (
            <div className="flex flex-col gap-s-2">
              {(local.vaccinations ?? []).map((v, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2 text-small">
                  <span className="font-medium text-ink">{v.nom}</span>
                  <span className="text-ink-3">{format(parseISO(v.date), 'dd/MM/yyyy')}</span>
                  {v.rappel && <span className="text-ink-3">Rappel : {format(parseISO(v.rappel), 'MM/yyyy')}</span>}
                  {editing && (
                    <button onClick={() => setLocal(d => ({ ...d, vaccinations: (d.vaccinations ?? []).filter((_, j) => j !== i) }))}
                      className="text-ink-3 hover:text-red-500"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>
          )
        }
        {editing && (
          <div className="mt-s-3 grid grid-cols-3 gap-s-2">
            <Input placeholder="Vaccin" value={newVaccin.nom} onChange={e => setNewVaccin(v => ({ ...v, nom: e.target.value }))} />
            <Input type="date" label="Date" value={newVaccin.date} onChange={e => setNewVaccin(v => ({ ...v, date: e.target.value }))} />
            <Input type="month" label="Rappel" value={newVaccin.rappel} onChange={e => setNewVaccin(v => ({ ...v, rappel: e.target.value }))} />
            <Button variant="secondary" size="sm" className="col-span-3" onClick={addVaccin}>Ajouter vaccin</Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Tab: Consultations ────────────────────────────────────────────────────────

function TabConsultations({ patientId }: { patientId: string }) {
  const navigate = useNavigate()
  const [consults, setConsults] = useState<Consultation[]>([])
  const [loading, setLoading]   = useState(true)
  const db = supabase as any

  useEffect(() => {
    ;(async () => {
      const { data } = await db.from('appointments')
        .select('id, starts_at, motif, duration_minutes, status, notes_soap, ordonnances(id)')
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('starts_at', { ascending: false })
        .limit(50)
      setConsults((data ?? []).map((r: any) => ({
        ...r,
        has_ordonnance: (r.ordonnances?.length ?? 0) > 0,
      })))
      setLoading(false)
    })()
  }, [patientId])

  return (
    <div className="flex flex-col gap-s-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Historique des consultations</h3>
        <Button variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => navigate(`/pro/consultations/nouvelle?patient=${patientId}`)}>
          Nouvelle consultation
        </Button>
      </div>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
        : consults.length === 0
          ? <p className="py-s-8 text-center text-small text-ink-3">Aucune consultation enregistrée</p>
          : consults.map(c => (
            <button key={c.id}
              onClick={() => navigate(`/pro/consultation/${c.id}`)}
              className="flex items-start justify-between rounded-lg border border-line bg-surface p-s-3 text-left transition-colors hover:border-primary/40 hover:shadow-1">
              <div>
                <p className="font-medium text-ink">{format(parseISO(c.starts_at), 'EEEE d MMMM yyyy', { locale: fr })}</p>
                {c.motif && <p className="text-small text-ink-3">{c.motif}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-s-2">
                {c.has_ordonnance && <span title="Ordonnance"><Pill className="h-4 w-4 text-primary" /></span>}
                {c.duration_minutes && <span className="text-small text-ink-3">{c.duration_minutes} min</span>}
                <ChevronLeft className="h-4 w-4 rotate-180 text-ink-3" />
              </div>
            </button>
          ))
      }
    </div>
  )
}

// ── Tab: Ordonnances ──────────────────────────────────────────────────────────

const ORD_LABEL: Record<string, string> = {
  active:               'Active',
  expiree:              'Expirée',
  dispensee_partielle:  'Dispensée partielle',
  terminee:             'Terminée',
}

function TabOrdonnances({ patientId, praticienId }: { patientId: string; praticienId: string }) {
  const navigate = useNavigate()
  const [ords, setOrds] = useState<Ordonnance[]>([])
  const [loading, setLoading] = useState(true)
  const db = supabase as any

  useEffect(() => {
    ;(async () => {
      const { data } = await db.from('ordonnances')
        .select('id, created_at, statut, medicaments, valide_jusqu')
        .eq('patient_id', patientId)
        .eq('praticien_id', praticienId)
        .order('created_at', { ascending: false })
      setOrds(data ?? [])
      setLoading(false)
    })()
  }, [patientId, praticienId])

  return (
    <div className="flex flex-col gap-s-3">
      <h3 className="font-semibold text-ink">Ordonnances</h3>
      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
        : ords.length === 0
          ? <p className="py-s-8 text-center text-small text-ink-3">Aucune ordonnance</p>
          : ords.map(o => (
            <div key={o.id} className="flex items-start justify-between rounded-lg border border-line bg-surface p-s-3">
              <div>
                <p className="font-medium text-ink">{format(parseISO(o.created_at), 'd MMM yyyy', { locale: fr })}</p>
                {o.medicaments?.slice(0, 2).map((m, i) => (
                  <p key={i} className="text-small text-ink-3">{m.nom}</p>
                ))}
                {(o.medicaments?.length ?? 0) > 2 && (
                  <p className="text-small text-ink-3">+{(o.medicaments?.length ?? 0) - 2} autres</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-s-2">
                <Badge variant={ORDONNANCE_STATUS_VARIANT[o.statut] ?? 'neutral'}>
                  {ORD_LABEL[o.statut] ?? o.statut}
                </Badge>
                {o.statut === 'expiree' && (
                  <Button variant="ghost" size="sm" leftIcon={<Plus className="h-3 w-3" />}
                    onClick={() => navigate(`/pro/ordonnances/nouvelle?patient=${patientId}&renouveler=${o.id}`)}>
                    Renouveler
                  </Button>
                )}
              </div>
            </div>
          ))
      }
    </div>
  )
}

// ── Tab: Documents ────────────────────────────────────────────────────────────

function TabDocuments({ patientId }: { patientId: string }) {
  const [docs, setDocs]       = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Document | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const db = supabase as any

  const loadDocs = useCallback(async () => {
    const { data } = await db.from('patient_documents')
      .select('id, nom, type, url, created_at, size_bytes')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { loadDocs() }, [loadDocs])

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext   = file.name.split('.').pop()?.toLowerCase() ?? ''
      const path  = `patient-docs/${patientId}/${Date.now()}_${file.name}`
      const { data: upload, error } = await supabase.storage.from('documents').upload(path, file)
      if (error) { toast.error(`Erreur upload ${file.name}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const type = ['jpg','jpeg','png','gif','webp'].includes(ext) ? 'image'
        : ext === 'pdf' ? 'pdf' : 'autre'
      await db.from('patient_documents').insert({
        patient_id: patientId, nom: file.name, type, url: publicUrl,
        size_bytes: file.size,
      })
    }
    setUploading(false)
    loadDocs()
    toast.success('Document(s) ajouté(s)')
  }

  function formatSize(n?: number | null) {
    if (!n) return ''
    if (n < 1024) return `${n} B`
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} Ko`
    return `${(n / 1024 ** 2).toFixed(1)} Mo`
  }

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Documents médicaux</h3>
        <div className="flex gap-s-2">
          <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden" onChange={e => handleUpload(e.target.files)} />
          <Button variant="secondary" size="sm" loading={uploading}
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => fileRef.current?.click()}>
            Ajouter document
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
        className="rounded-lg border-2 border-dashed border-line bg-surface-2 p-s-6 text-center text-small text-ink-3 hover:border-primary/60 transition-colors"
      >
        <Upload className="mx-auto mb-s-2 h-8 w-8 opacity-40" />
        Glissez-déposez vos fichiers ici, ou cliquez sur "Ajouter document"<br />
        PDF, images (JPG, PNG, WebP)
      </div>

      {loading
        ? <Skeleton className="h-32 rounded-lg" />
        : docs.length === 0
          ? <p className="text-center text-small text-ink-3 py-s-4">Aucun document</p>
          : (
            <div className="grid gap-s-2 sm:grid-cols-2">
              {docs.map(d => (
                <div key={d.id}
                  className="flex items-center gap-s-3 rounded-lg border border-line bg-surface p-s-3">
                  {DOC_ICONS[d.type] ?? DOC_ICONS.autre}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-medium text-ink">{d.nom}</p>
                    <p className="text-micro text-ink-3">
                      {format(parseISO(d.created_at), 'd MMM yyyy', { locale: fr })}
                      {d.size_bytes ? ` · ${formatSize(d.size_bytes)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-s-1">
                    <button onClick={() => setPreview(d)}
                      className="rounded p-s-1 text-ink-3 hover:text-primary"><Eye className="h-4 w-4" /></button>
                    <a href={d.url} download={d.nom}
                      className="rounded p-s-1 text-ink-3 hover:text-primary"><Download className="h-4 w-4" /></a>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      {/* Visionneuse */}
      <Modal open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}
        title={preview?.nom ?? ''} size="xl">
        {preview && (
          preview.type === 'pdf'
            ? <iframe src={preview.url} className="h-[70vh] w-full rounded" title={preview.nom} />
            : <img src={preview.url} alt={preview.nom} className="max-h-[70vh] mx-auto object-contain rounded" />
        )}
      </Modal>
    </div>
  )
}

// ── Tab: Constantes ───────────────────────────────────────────────────────────

function TabConstantes({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) {
  const [constantes, setConstantes] = useState<Constante[]>([])
  const [loading, setLoading]       = useState(true)
  const [showSaisie, setShowSaisie] = useState(false)
  const [saving, setSaving]         = useState(false)
  const db = supabase as any

  const [form, setForm] = useState({
    poids_kg: '', taille_cm: '', tension_s: '', tension_d: '',
    fc: '', temp: '', spo2: '', glycemie: '',
  })

  const load = useCallback(async () => {
    const { data } = await db.from('constantes_vitales')
      .select('*')
      .eq('patient_id', patientId)
      .order('mesure_at', { ascending: false })
      .limit(24)
    setConstantes(data ?? [])
    setLoading(false)
  }, [patientId])

  useEffect(() => { load() }, [load])

  async function saveConstantes() {
    const poids = form.poids_kg ? parseFloat(form.poids_kg) : null
    const taille = form.taille_cm ? parseFloat(form.taille_cm) : null
    setSaving(true)
    const { error } = await db.from('constantes_vitales').insert({
      patient_id:           patientId,
      appointment_id:       appointmentId ?? null,
      mesure_at:            new Date().toISOString(),
      poids_kg:             poids,
      taille_cm:            taille,
      tension_systolique:   form.tension_s ? parseInt(form.tension_s) : null,
      tension_diastolique:  form.tension_d ? parseInt(form.tension_d) : null,
      frequence_cardiaque:  form.fc ? parseInt(form.fc) : null,
      temperature_c:        form.temp ? parseFloat(form.temp) : null,
      saturation_o2:        form.spo2 ? parseFloat(form.spo2) : null,
      glycemie_mmol:        form.glycemie ? parseFloat(form.glycemie) : null,
    })
    setSaving(false)
    if (error) { toast.error('Erreur sauvegarde'); return }
    toast.success('Constantes enregistrées')
    setShowSaisie(false)
    setForm({ poids_kg:'', taille_cm:'', tension_s:'', tension_d:'', fc:'', temp:'', spo2:'', glycemie:'' })
    load()
  }

  // Chart data (12 derniers mois)
  const cutoff = subMonths(new Date(), 12)
  const chartData = constantes
    .filter(c => parseISO(c.mesure_at) >= cutoff && (c.poids_kg || c.tension_systolique))
    .reverse()
    .map(c => ({
      date: format(parseISO(c.mesure_at), 'dd/MM', { locale: fr }),
      Poids: c.poids_kg ?? undefined,
      'TA sys': c.tension_systolique ?? undefined,
      'TA dia': c.tension_diastolique ?? undefined,
    }))

  const latest = constantes[0]
  const imcVal = imc(latest?.poids_kg, latest?.taille_cm)

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Constantes & mesures</h3>
        <Button variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowSaisie(true)}>
          Saisir constantes
        </Button>
      </div>

      {/* Dernières valeurs */}
      {latest && (
        <div className="grid grid-cols-2 gap-s-2 sm:grid-cols-4">
          {[
            { label: 'Poids', value: latest.poids_kg ? `${latest.poids_kg} kg` : null },
            { label: 'Taille', value: latest.taille_cm ? `${latest.taille_cm} cm` : null },
            { label: 'IMC', value: imcVal ? `${imcVal} — ${imcLabel(parseFloat(imcVal))}` : null },
            { label: 'Tension', value: latest.tension_systolique ? `${latest.tension_systolique}/${latest.tension_diastolique} mmHg` : null },
            { label: 'FC', value: latest.frequence_cardiaque ? `${latest.frequence_cardiaque} bpm` : null },
            { label: 'Température', value: latest.temperature_c ? `${latest.temperature_c}°C` : null },
            { label: 'SpO2', value: latest.saturation_o2 ? `${latest.saturation_o2}%` : null },
            { label: 'Glycémie', value: latest.glycemie_mmol ? `${latest.glycemie_mmol} mmol/L` : null },
          ].filter(x => x.value).map(({ label, value }) => (
            <Card key={label} className="p-s-3 text-center">
              <p className="text-micro text-ink-3">{label}</p>
              <p className="mt-s-1 font-semibold text-ink">{value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <Card className="p-s-4">
          <h4 className="mb-s-3 font-medium text-ink">Évolution sur 12 mois</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Poids" stroke="#1A7A4C" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="TA sys" stroke="#0EA5E9" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="TA dia" stroke="#8B5CF6" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Historique table */}
      {loading
        ? <Skeleton className="h-32 rounded-lg" />
        : constantes.length === 0
          ? <p className="text-center text-small text-ink-3 py-s-6">Aucune constante enregistrée</p>
          : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-small">
                <thead className="border-b border-line bg-surface-2">
                  <tr>
                    {['Date', 'Poids', 'IMC', 'Tension', 'FC', 'T°', 'SpO2', 'Glycémie'].map(h => (
                      <th key={h} className="px-s-3 py-s-2 text-left text-micro font-semibold text-ink-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {constantes.map(c => {
                    const imcC = imc(c.poids_kg, c.taille_cm)
                    return (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="px-s-3 py-s-2 font-medium text-ink">{format(parseISO(c.mesure_at), 'dd/MM/yy HH:mm')}</td>
                        <td className="px-s-3 py-s-2">{c.poids_kg ? `${c.poids_kg}kg` : '—'}</td>
                        <td className="px-s-3 py-s-2">{imcC ?? '—'}</td>
                        <td className="px-s-3 py-s-2">{c.tension_systolique ? `${c.tension_systolique}/${c.tension_diastolique}` : '—'}</td>
                        <td className="px-s-3 py-s-2">{c.frequence_cardiaque ? `${c.frequence_cardiaque}bpm` : '—'}</td>
                        <td className="px-s-3 py-s-2">{c.temperature_c ? `${c.temperature_c}°C` : '—'}</td>
                        <td className="px-s-3 py-s-2">{c.saturation_o2 ? `${c.saturation_o2}%` : '—'}</td>
                        <td className="px-s-3 py-s-2">{c.glycemie_mmol ? `${c.glycemie_mmol}mmol/L` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      }

      {/* Modal saisie */}
      <Modal open={showSaisie} onOpenChange={setShowSaisie} title="Saisir les constantes" size="md">
        <div className="grid grid-cols-2 gap-s-3">
          <Input label="Poids (kg)" type="number" step="0.1" value={form.poids_kg} onChange={e => setForm(f => ({ ...f, poids_kg: e.target.value }))} />
          <Input label="Taille (cm)" type="number" value={form.taille_cm} onChange={e => setForm(f => ({ ...f, taille_cm: e.target.value }))} />
          <Input label="TA systolique" type="number" value={form.tension_s} onChange={e => setForm(f => ({ ...f, tension_s: e.target.value }))} />
          <Input label="TA diastolique" type="number" value={form.tension_d} onChange={e => setForm(f => ({ ...f, tension_d: e.target.value }))} />
          <Input label="FC (bpm)" type="number" value={form.fc} onChange={e => setForm(f => ({ ...f, fc: e.target.value }))} />
          <Input label="Température (°C)" type="number" step="0.1" value={form.temp} onChange={e => setForm(f => ({ ...f, temp: e.target.value }))} />
          <Input label="SpO2 (%)" type="number" step="0.1" value={form.spo2} onChange={e => setForm(f => ({ ...f, spo2: e.target.value }))} />
          <Input label="Glycémie (mmol/L)" type="number" step="0.1" value={form.glycemie} onChange={e => setForm(f => ({ ...f, glycemie: e.target.value }))} />
        </div>
        <div className="mt-s-4 flex justify-end gap-s-2">
          <Button variant="ghost" onClick={() => setShowSaisie(false)}>Annuler</Button>
          <Button variant="primary" loading={saving} onClick={saveConstantes}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Main Page — Dossier Patient ────────────────────────────────────────────────

type TabId = 'resume' | 'consultations' | 'ordonnances' | 'documents' | 'constantes'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'resume',        label: 'Résumé clinique', icon: <Activity className="h-4 w-4" /> },
  { id: 'consultations', label: 'Consultations',   icon: <Stethoscope className="h-4 w-4" /> },
  { id: 'ordonnances',   label: 'Ordonnances',     icon: <Pill className="h-4 w-4" /> },
  { id: 'documents',     label: 'Documents',       icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'constantes',    label: 'Constantes',      icon: <BarChart2 className="h-4 w-4" /> },
]

const GROUPES_SANGUINS_LABEL: Record<string, string> = {
  'A+':'A+','A-':'A-','B+':'B+','B-':'B-','AB+':'AB+','AB-':'AB-','O+':'O+','O-':'O-'
}

export default function DossierPatientPage() {
  const { id: patientId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const db = supabase as any

  const [patient, setPatient]   = useState<PatientProfile | null>(null)
  const [dossier, setDossier]   = useState<DossierMedical>({
    allergies: [], pathologies_chroniques: [],
  })
  const [mutuelle, setMutuelle] = useState<{ nom: string; contrat: string } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('resume')

  const load = useCallback(async () => {
    if (!patientId || !profile?.id) return
    setLoading(true)

    // Verify access right (praticien_patients relation)
    const { data: rel } = await db.from('praticien_patients')
      .select('id')
      .eq('praticien_id', profile.id)
      .eq('patient_id', patientId)
      .eq('actif', true)
      .maybeSingle()

    if (!rel) { setForbidden(true); setLoading(false); return }

    const [profRes, dossierRes, mutuelleRes] = await Promise.all([
      db.from('profiles').select('id, full_name, date_naissance, sexe, avatar_url, telephone, email')
        .eq('id', patientId).single(),
      db.from('dossiers_medicaux').select('*').eq('patient_id', patientId).maybeSingle(),
      db.from('assurances_patients').select('nom_mutuelle, numero_contrat')
        .eq('patient_id', patientId).eq('statut', 'active').maybeSingle(),
    ])

    setPatient(profRes.data)
    setDossier({
      allergies: [],
      pathologies_chroniques: [],
      ...(dossierRes.data ?? {}),
    })
    setMutuelle(mutuelleRes.data
      ? { nom: mutuelleRes.data.nom_mutuelle, contrat: mutuelleRes.data.numero_contrat }
      : null)
    setLoading(false)

    // Audit log — every dossier access is logged
    await db.from('audit_logs').insert({
      actor_id:   profile.id,
      target_id:  patientId,
      action:     'dossier_viewed',
      table_name: 'profiles',
      metadata:   { tab: activeTab },
    }).catch(() => {})
  }, [patientId, profile?.id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-s-6">
        <Skeleton className="mb-s-4 h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (forbidden || !patient) {
    return (
      <div className="flex flex-col items-center justify-center p-s-12 text-center gap-s-4">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <h2 className="text-heading font-bold text-ink">Accès refusé</h2>
        <p className="text-small text-ink-3 max-w-sm">
          Vous n'avez pas de relation de soin active avec ce patient. Seul le praticien référent peut consulter ce dossier.
        </p>
        <Button variant="ghost" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={() => navigate('/pro/patients')}>
          Retour à mes patients
        </Button>
      </div>
    )
  }

  const age = patient.date_naissance
    ? differenceInYears(new Date(), parseISO(patient.date_naissance))
    : null
  const hasAllergies = dossier.allergies.length > 0

  return (
    <div className="flex flex-col gap-s-4 p-s-4 md:p-s-6">

      {/* Breadcrumb */}
      <button onClick={() => navigate('/pro/patients')}
        className="flex items-center gap-s-1 text-small text-ink-3 hover:text-ink w-fit">
        <ChevronLeft className="h-4 w-4" /> Mes patients
      </button>

      {/* Avertissement légal */}
      <div className="flex items-center gap-s-2 rounded-lg border border-amber-200 bg-amber-50 px-s-4 py-s-2 text-small text-amber-800">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
        Données de santé — accès réservé au praticien référent dans le cadre du suivi médical.
        Cet accès est audité.
      </div>

      {/* En-tête patient */}
      <Card className="p-s-4">
        <div className="flex flex-wrap items-start gap-s-4">
          <Avatar src={patient.avatar_url} fallback={patient.full_name} size="lg" />

          <div className="flex-1 min-w-0">
            <h1 className="text-heading font-bold text-ink">{patient.full_name}</h1>
            <p className="text-small text-ink-3">
              {age !== null ? `${age} ans` : '—'}
              {patient.sexe ? ` · ${patient.sexe === 'M' ? 'Homme' : patient.sexe === 'F' ? 'Femme' : 'Autre'}` : ''}
              {dossier.groupe_sanguin ? ` · Groupe ${GROUPES_SANGUINS_LABEL[dossier.groupe_sanguin] ?? dossier.groupe_sanguin}` : ''}
            </p>
            {patient.telephone && <p className="text-small text-ink-3">{patient.telephone}</p>}

            {/* Badges */}
            <div className="mt-s-2 flex flex-wrap gap-s-1">
              {hasAllergies && (
                <span className="flex items-center gap-s-1 rounded-pill bg-red-100 px-s-2 py-0.5 text-micro font-bold text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  Allergies : {dossier.allergies.join(', ')}
                </span>
              )}
              {mutuelle && (
                <span className="rounded-pill bg-emerald-100 px-s-2 py-0.5 text-micro font-medium text-emerald-700">
                  {mutuelle.nom} · {mutuelle.contrat}
                </span>
              )}
              {dossier.pathologies_chroniques.map(p => (
                <Badge key={p} variant="accent">{p}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Onglets */}
      <div className="flex overflow-x-auto gap-s-0 rounded-lg border border-line bg-surface-2 p-0.5">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-s-1.5 whitespace-nowrap rounded-md px-s-3 py-s-2 text-small font-medium transition-colors flex-1 justify-center',
              activeTab === tab.id ? 'bg-surface text-ink shadow-1' : 'text-ink-3 hover:text-ink',
            )}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}>
          {activeTab === 'resume' && (
            <TabResume patientId={patientId!} dossier={dossier} onRefresh={load} />
          )}
          {activeTab === 'consultations' && (
            <TabConsultations patientId={patientId!} />
          )}
          {activeTab === 'ordonnances' && (
            <TabOrdonnances patientId={patientId!} praticienId={profile!.id} />
          )}
          {activeTab === 'documents' && (
            <TabDocuments patientId={patientId!} />
          )}
          {activeTab === 'constantes' && (
            <TabConstantes patientId={patientId!} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
