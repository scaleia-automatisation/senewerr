import { useState, useEffect, useCallback, useRef } from 'react'
import { differenceInYears } from 'date-fns'
import {
  Eye, EyeOff, Camera, Pencil, Check, X, Plus, Trash2, Shield,
  ShieldCheck, Download, AlertTriangle, LogOut, ChevronRight, User,
  Phone, MapPin, Stethoscope, Syringe, Pill, AlertCircle, Lock, Mail,
  Sun, Moon, Laptop, Globe, Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PatientData {
  prenom: string
  nom: string
  date_naissance: string
  genre: string
  adresse: string
  telephone: string
  groupe_sanguin: string
  allergies: string[]
  antecedents: string[]
  traitements_actuels: { nom: string; posologie: string }[]
  medecin_traitant_id: string | null
  contacts_urgence: ContactUrgence[]
  photo_url: string | null
  preferences: { langue: string; theme: string; format_date: string }
}

interface ContactUrgence {
  prenom: string
  nom: string
  lien: string
  telephone: string
  acces_dossier: boolean
}

interface MedecinInfo {
  id: string
  first_name: string
  last_name: string
  specialite?: string
  telephone?: string
  email?: string
  photo_url?: string
  cabinet?: string
}

type Tab = 'infos' | 'medical' | 'securite' | 'preferences' | 'urgence'

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos',       label: 'Informations' },
  { key: 'medical',     label: 'Médical' },
  { key: 'securite',    label: 'Sécurité' },
  { key: 'preferences', label: 'Préférences' },
  { key: 'urgence',     label: 'Urgence' },
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const ALLERGY_SUGGESTIONS = ['Pénicilline', 'Aspirine', 'Ibuprofène', 'Latex', 'Arachides', 'Gluten', 'Lactose', 'Pollen', 'Acariens', 'Amoxicilline']
const ANTECEDENTS_SUGGESTIONS = ['Diabète type 2', 'Hypertension', 'Asthme', 'Épilepsie', 'Cancer', 'Cardiopathie', 'Appendicectomie', 'Fracture']
const GENRES = [
  { value: 'homme', label: 'Homme' },
  { value: 'femme', label: 'Femme' },
  { value: 'non_binaire', label: 'Non-binaire' },
  { value: 'autre', label: 'Autre' },
  { value: 'ne_pas_dire', label: 'Je préfère ne pas préciser' },
]
const LANGUES  = [{ value: 'fr', label: 'Français' }, { value: 'wo', label: 'Wolof' }, { value: 'en', label: 'English' }]
const THEMES   = [{ value: 'light', label: '☀️ Clair' }, { value: 'dark', label: '🌙 Sombre' }, { value: 'auto', label: '🌗 Automatique' }]
const DATE_FMT = [{ value: 'dd/mm/yyyy', label: 'JJ/MM/AAAA' }, { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' }]

// ─── Canvas resize 400×400 ────────────────────────────────────────────────────
function resizeImage(file: File, maxDim = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.88)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// ─── ProfileCompletion ────────────────────────────────────────────────────────
function completionPct(d: Partial<PatientData>): number {
  const checks = [
    !!d.prenom, !!d.nom, !!d.date_naissance, !!d.genre,
    !!d.telephone, !!d.adresse, !!d.groupe_sanguin,
    (d.allergies?.length ?? 0) > 0, (d.antecedents?.length ?? 0) > 0,
    !!d.photo_url, !!d.medecin_traitant_id,
    (d.contacts_urgence?.length ?? 0) > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ─── AvatarUpload ─────────────────────────────────────────────────────────────
function AvatarUpload({ photoUrl, patientId, onUploaded }: {
  photoUrl: string | null; patientId: string; onUploaded: (url: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const db = supabase as any

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Image trop grande (max 5 Mo).'); return }
    setUploading(true)
    try {
      const resized = await resizeImage(f, 400)
      const path = `avatars/${patientId}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, resized, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      // UPDATE patients table photo_url
      await db.from('patients').update({ photo_url: publicUrl }).eq('id', patientId)
      setPreview(publicUrl); onUploaded(publicUrl)
      toast.success('Photo mise à jour.')
    } catch { toast.error('Erreur lors du téléversement.') }
    setUploading(false)
  }

  const src = preview ?? photoUrl
  return (
    <div className="relative">
      <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-line bg-surface-2">
        {src ? (
          <img src={src} alt="avatar" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center"><User className="h-10 w-10 text-ink-3" /></div>
        )}
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm hover:bg-primary-dark transition-colors"
      >
        {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Camera className="h-4 w-4" />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── TagInput (allergies / antécédents) ───────────────────────────────────────
function TagInput({ tags, onChange, suggestions, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; suggestions?: string[]; placeholder?: string
}) {
  const [input, setInput] = useState('')
  const filtered = (suggestions ?? []).filter(s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))

  function add(val: string) {
    const v = val.trim(); if (!v || tags.includes(v)) return
    onChange([...tags, v]); setInput('')
  }
  function remove(v: string) { onChange(tags.filter(t => t !== v)) }

  return (
    <div>
      <div className="flex flex-wrap gap-s-1 mb-s-2">
        {tags.map(t => (
          <span key={t} className="flex items-center gap-s-1 rounded-pill bg-primary-soft border border-primary/20 px-s-2 py-0.5 text-micro text-primary">
            {t}
            <button onClick={() => remove(t)} className="hover:text-status-danger"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input) } }}
          placeholder={placeholder ?? 'Ajouter…'}
          className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"
        />
        {input && filtered.length > 0 && (
          <div className="absolute z-10 mt-s-1 w-full rounded-md border border-line bg-surface shadow-sm">
            {filtered.slice(0, 5).map(s => (
              <button key={s} onClick={() => add(s)} className="w-full px-s-3 py-s-2 text-left text-small text-ink hover:bg-surface-2">{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── InfosTab ─────────────────────────────────────────────────────────────────
function InfosTab({ data, patientId, medecin, onSave, onRefreshMedecin }: {
  data: PatientData; patientId: string; medecin: MedecinInfo | null
  onSave: (partial: Partial<PatientData>) => void; onRefreshMedecin: () => void
}) {
  const db = supabase as any
  const [editing, setEditing]     = useState(false)
  const [form, setForm]           = useState<Partial<PatientData>>({})
  const [nssVisible, setNssVisible] = useState(false)
  const [nss, setNss]             = useState<string | null>(null)
  const [loadingNss, setLoadingNss] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [searchMed, setSearchMed] = useState('')
  const [medResults, setMedResults] = useState<MedecinInfo[]>([])
  const [medModal, setMedModal]   = useState(false)

  function startEdit() { setForm({ ...data }); setEditing(true) }

  async function revealNss() {
    if (nss) { setNssVisible(v => !v); return }
    setLoadingNss(true)
    const { data: d } = await supabase.functions.invoke('decrypt-nss', { body: { patientId } })
    setNss(d?.nss ?? null); setNssVisible(true); setLoadingNss(false)
  }

  async function save() {
    setSaving(true)
    await supabase.functions.invoke('update-patient-profile', { body: { patientId, ...form } })
    onSave(form); setEditing(false); toast.success('Profil mis à jour.')
    setSaving(false)
  }

  async function searchMedecins(q: string) {
    if (!q) return
    const { data: r } = await db.from('profiles').select('id, first_name, last_name, telephone, photo_url')
      .eq('role', 'professional').ilike('last_name', `%${q}%`).limit(5)
    setMedResults(r ?? [])
  }

  async function selectMedecin(m: MedecinInfo) {
    await db.from('patients').update({ medecin_traitant_id: m.id }).eq('id', patientId)
    onSave({ medecin_traitant_id: m.id }); setMedModal(false); onRefreshMedecin()
    toast.success('Médecin traitant mis à jour.')
  }

  const f = (k: keyof PatientData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const fieldCls = "w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus"
  const readCls  = "text-small text-ink py-s-1"

  return (
    <div className="flex flex-col gap-s-6">
      {/* Personal info */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <div className="flex items-center justify-between mb-s-4">
          <h3 className="font-semibold text-ink">Informations personnelles</h3>
          {!editing
            ? <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={startEdit}>Modifier</Button>
            : <div className="flex gap-s-2">
                <Button size="sm" variant="secondary" leftIcon={<X className="h-4 w-4" />} onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
                <Button size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={save} loading={saving}>Enregistrer</Button>
              </div>
          }
        </div>
        <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
          {[
            { label: 'Prénom', key: 'prenom' as const },
            { label: 'Nom', key: 'nom' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <p className="mb-s-1 text-micro font-medium text-ink-3">{label}</p>
              {editing
                ? <input value={(form[key] as string) ?? ''} onChange={f(key)} className={fieldCls} />
                : <p className={readCls}>{data[key] || '—'}</p>}
            </div>
          ))}
          <div>
            <p className="mb-s-1 text-micro font-medium text-ink-3">Date de naissance</p>
            {editing
              ? <input type="date" value={(form.date_naissance as string) ?? ''} onChange={f('date_naissance')} className={fieldCls} />
              : <p className={readCls}>{data.date_naissance ? `${data.date_naissance} (${differenceInYears(new Date(), new Date(data.date_naissance))} ans)` : '—'}</p>}
          </div>
          <div>
            <p className="mb-s-1 text-micro font-medium text-ink-3">Genre</p>
            {editing
              ? <select value={(form.genre as string) ?? ''} onChange={f('genre')} className={fieldCls}>
                  {GENRES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              : <p className={readCls}>{GENRES.find(g => g.value === data.genre)?.label || '—'}</p>}
          </div>
          {/* NSS masqué */}
          <div className="sm:col-span-2">
            <p className="mb-s-1 text-micro font-medium text-ink-3">Numéro de sécurité sociale</p>
            <div className="flex items-center gap-s-2">
              <span className="text-small text-ink font-mono">
                {nssVisible && nss ? nss : '•••••••••••••'}
              </span>
              <button onClick={revealNss} disabled={loadingNss}
                className="text-ink-3 hover:text-ink transition-colors">
                {loadingNss
                  ? <div className="h-4 w-4 animate-spin rounded-full border border-ink-3 border-t-transparent" />
                  : nssVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <span className="text-micro text-ink-3">(déchiffrement via Edge Function)</span>
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-s-1 text-micro font-medium text-ink-3"><MapPin className="inline h-3.5 w-3.5 mr-s-1" />Adresse</p>
            {editing
              ? <input value={(form.adresse as string) ?? ''} onChange={f('adresse')} className={fieldCls} placeholder="Adresse complète" />
              : <p className={readCls}>{data.adresse || '—'}</p>}
          </div>
          <div>
            <p className="mb-s-1 text-micro font-medium text-ink-3"><Phone className="inline h-3.5 w-3.5 mr-s-1" />Téléphone</p>
            {editing
              ? <input type="tel" value={(form.telephone as string) ?? ''} onChange={f('telephone')} className={fieldCls} placeholder="+221 77 000 00 00" />
              : <p className={readCls}>{data.telephone || '—'}</p>}
          </div>
          <div>
            <p className="mb-s-1 text-micro font-medium text-ink-3"><Mail className="inline h-3.5 w-3.5 mr-s-1" />Email</p>
            <p className={readCls + ' text-ink-3'}>{useAuth().user?.email ?? '—'} <span className="text-micro">(modifier dans Sécurité)</span></p>
          </div>
        </div>
      </div>

      {/* Médecin traitant */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <div className="flex items-center justify-between mb-s-3">
          <h3 className="font-semibold text-ink flex items-center gap-s-2"><Stethoscope className="h-5 w-5 text-primary" />Médecin traitant</h3>
          <Button size="sm" variant="secondary" onClick={() => setMedModal(true)}>Changer</Button>
        </div>
        {medecin ? (
          <div className="flex items-center gap-s-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-surface-2 shrink-0">
              {medecin.photo_url
                ? <img src={medecin.photo_url} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full items-center justify-center text-ink-3"><User className="h-5 w-5" /></div>}
            </div>
            <div>
              <p className="text-small font-medium text-ink">Dr {medecin.first_name} {medecin.last_name}</p>
              <p className="text-micro text-ink-3">{medecin.cabinet ?? medecin.specialite ?? ''}{medecin.telephone ? ` · ${medecin.telephone}` : ''}</p>
            </div>
          </div>
        ) : <p className="text-small text-ink-3">Aucun médecin traitant renseigné.</p>}
      </div>

      {/* Modal recherche médecin */}
      <Modal open={medModal} onOpenChange={v => !v && setMedModal(false)} title="Choisir un médecin traitant" size="md">
        <div className="flex flex-col gap-s-3">
          <input
            value={searchMed}
            onChange={e => { setSearchMed(e.target.value); searchMedecins(e.target.value) }}
            placeholder="Rechercher par nom…"
            className={fieldCls}
          />
          {medResults.map(m => (
            <button key={m.id} onClick={() => selectMedecin(m)}
              className="flex items-center gap-s-3 rounded-md border border-line p-s-3 hover:bg-primary-soft hover:border-primary text-left transition-colors">
              <div className="h-8 w-8 rounded-full bg-surface-2 overflow-hidden shrink-0">
                {m.photo_url ? <img src={m.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="h-full w-full p-s-1 text-ink-3" />}
              </div>
              <div>
                <p className="text-small font-medium text-ink">Dr {m.first_name} {m.last_name}</p>
                <p className="text-micro text-ink-3">{m.telephone ?? ''}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-ink-3 shrink-0" />
            </button>
          ))}
          {searchMed && medResults.length === 0 && <p className="text-small text-ink-3 text-center py-s-3">Aucun résultat.</p>}
        </div>
      </Modal>
    </div>
  )
}

// ─── MedicalTab ───────────────────────────────────────────────────────────────
function MedicalTab({ data, patientId, onSave }: {
  data: PatientData; patientId: string; onSave: (p: Partial<PatientData>) => void
}) {
  const db = supabase as any
  const [sanguin, setSanguin]               = useState(data.groupe_sanguin)
  const [allergies, setAllergies]           = useState<string[]>(data.allergies ?? [])
  const [antecedents, setAntecedents]       = useState<string[]>(data.antecedents ?? [])
  const [traitements, setTraitements]       = useState(data.traitements_actuels ?? [])
  const [newTrait, setNewTrait]             = useState({ nom: '', posologie: '' })
  const [dirty, setDirty]                   = useState(false)
  const [saving, setSaving]                 = useState(false)

  function mark<T>(setter: React.Dispatch<React.SetStateAction<T>>, val: T) {
    setter(val); setDirty(true)
  }

  async function save() {
    setSaving(true)
    const patch = { groupe_sanguin: sanguin, allergies, antecedents, traitements_actuels: traitements }
    await db.from('patients').update(patch).eq('id', patientId)
    onSave(patch); setDirty(false); toast.success('Informations médicales mises à jour.')
    setSaving(false)
  }

  function addTrait() {
    if (!newTrait.nom) return
    mark(setTraitements, [...traitements, { ...newTrait }])
    setNewTrait({ nom: '', posologie: '' })
  }

  return (
    <div className="flex flex-col gap-s-4">
      <div className="rounded-md border border-line bg-surface p-s-4 flex flex-col gap-s-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Informations médicales</h3>
          {dirty && <Button size="sm" leftIcon={<Check className="h-4 w-4" />} onClick={save} loading={saving}>Enregistrer</Button>}
        </div>

        {/* Groupe sanguin */}
        <div>
          <p className="mb-s-1 text-small font-medium text-ink">Groupe sanguin</p>
          <div className="flex flex-wrap gap-s-2">
            {BLOOD_GROUPS.map(g => (
              <button key={g} onClick={() => mark(setSanguin, g)}
                className={cn('rounded-pill border px-s-3 py-s-1 text-small font-medium transition-colors',
                  sanguin === g ? 'border-primary bg-primary text-white' : 'border-line hover:bg-surface-2 text-ink')}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div>
          <p className="mb-s-1 text-small font-medium text-ink flex items-center gap-s-1">
            <AlertCircle className="h-4 w-4 text-status-danger" />Allergies
          </p>
          <TagInput tags={allergies} onChange={t => mark(setAllergies, t)} suggestions={ALLERGY_SUGGESTIONS} placeholder="Ajouter une allergie…" />
        </div>

        {/* Antécédents */}
        <div>
          <p className="mb-s-1 text-small font-medium text-ink flex items-center gap-s-1">
            <Syringe className="h-4 w-4 text-primary" />Antécédents médicaux
          </p>
          <TagInput tags={antecedents} onChange={t => mark(setAntecedents, t)} suggestions={ANTECEDENTS_SUGGESTIONS} placeholder="Ajouter un antécédent…" />
        </div>

        {/* Traitements */}
        <div>
          <p className="mb-s-2 text-small font-medium text-ink flex items-center gap-s-1">
            <Pill className="h-4 w-4 text-primary" />Traitements en cours
          </p>
          <div className="flex flex-col gap-s-2">
            {traitements.map((t, i) => (
              <div key={i} className="flex items-center gap-s-2 rounded-md bg-surface-2 px-s-3 py-s-2">
                <div className="flex-1 min-w-0">
                  <p className="text-small font-medium text-ink">{t.nom}</p>
                  <p className="text-micro text-ink-3">{t.posologie}</p>
                </div>
                <button onClick={() => mark(setTraitements, traitements.filter((_, j) => j !== i))} className="text-ink-3 hover:text-status-danger shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-s-2">
              <input value={newTrait.nom} onChange={e => setNewTrait(p => ({ ...p, nom: e.target.value }))} placeholder="Médicament"
                className="flex-1 rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus" />
              <input value={newTrait.posologie} onChange={e => setNewTrait(p => ({ ...p, posologie: e.target.value }))} placeholder="Posologie"
                className="flex-1 rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus" />
              <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={addTrait}>Ajouter</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SecuriteTab ──────────────────────────────────────────────────────────────
function SecuriteTab({ patientId }: { patientId: string }) {
  const { user, signOut } = useAuth()
  const db = supabase as any

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  // Password
  const [pwd, setPwd] = useState({ old: '', new_: '', confirm: '' })
  const [pwdSaving, setPwdSaving]   = useState(false)
  // 2FA
  const [mfaStatus, setMfaStatus]   = useState<'loading' | 'none' | 'active'>('loading')
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode]         = useState<string | null>(null)
  const [totpCode, setTotpCode]     = useState('')
  const [enrollId, setEnrollId]     = useState<string | null>(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  // Delete account
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [downloading, setDownloading] = useState(false)
  const db2 = supabase as any

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find((f: any) => f.status === 'verified')
      if (totp) { setMfaStatus('active'); setMfaFactorId(totp.id) }
      else setMfaStatus('none')
    })
  }, [])

  async function changeEmail() {
    if (!newEmail) return
    setEmailSaving(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) toast.error(error.message)
    else { toast.success('Un email de vérification a été envoyé.'); setNewEmail('') }
    setEmailSaving(false)
  }

  async function changePassword() {
    if (pwd.new_ !== pwd.confirm) { toast.error('Les mots de passe ne correspondent pas.'); return }
    if (pwd.new_.length < 8) { toast.error('Mot de passe trop court (min 8 caractères).'); return }
    setPwdSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwd.new_ })
    if (error) toast.error(error.message)
    else { toast.success('Mot de passe mis à jour.'); setPwd({ old: '', new_: '', confirm: '' }) }
    setPwdSaving(false)
  }

  async function enrollMfa() {
    setMfaLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error || !data) { toast.error('Erreur activation 2FA.'); setMfaLoading(false); return }
    setEnrollId(data.id)
    setQrCode(data.totp.qr_code)
    setMfaLoading(false)
  }

  async function verifyMfa() {
    if (!enrollId || !totpCode) return
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollId, code: totpCode })
    if (error) { toast.error('Code invalide.') }
    else { setMfaStatus('active'); setMfaFactorId(enrollId); setQrCode(null); toast.success('Double authentification activée !') }
    setMfaLoading(false)
  }

  async function unenrollMfa() {
    if (!mfaFactorId) return
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) toast.error(error.message)
    else { setMfaStatus('none'); setMfaFactorId(null); toast.success('2FA désactivée.') }
    setMfaLoading(false)
  }

  async function exportRGPD() {
    setDownloading(true)
    const { data } = await supabase.functions.invoke('export-patient-data', { body: { patientId } })
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `mes-donnees-${patientId.slice(0, 8)}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Export RGPD téléchargé.')
    }
    setDownloading(false)
  }

  async function deleteAccount() {
    if (deleteInput !== 'SUPPRIMER') return
    setDeleting(true)
    await supabase.functions.invoke('delete-patient-account', { body: { patientId } })
    // Notification admin
    try {
      await db2.from('notifications').insert({
        event_type: 'systeme',
        title: 'Demande suppression compte',
        message: `Le patient ${patientId.slice(0, 8)} a demandé la suppression de son compte.`,
        badge_category: 'admin',
        priority: 'high',
        data: { patient_id: patientId, type: 'compte_suppression_demandee' },
      })
    } catch { /* non-bloquant */ }
    toast.success('Demande de suppression enregistrée. Vous serez déconnecté dans 5 secondes.')
    setTimeout(() => signOut(), 5000)
    setDeleting(false); setDeleteModal(false)
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"

  return (
    <div className="flex flex-col gap-s-4">
      {/* Email */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <h3 className="mb-s-3 font-semibold text-ink flex items-center gap-s-2"><Mail className="h-5 w-5 text-primary" />Changer l'email</h3>
        <p className="mb-s-2 text-small text-ink-2">Actuel : <strong>{user?.email}</strong></p>
        <div className="flex gap-s-2">
          <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Nouvel email" className={inputCls} />
          <Button onClick={changeEmail} loading={emailSaving} disabled={!newEmail}>Envoyer</Button>
        </div>
        <p className="mt-s-1 text-micro text-ink-3">Un lien de vérification sera envoyé à la nouvelle adresse.</p>
      </div>

      {/* Mot de passe */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <h3 className="mb-s-3 font-semibold text-ink flex items-center gap-s-2"><Lock className="h-5 w-5 text-primary" />Mot de passe</h3>
        <div className="flex flex-col gap-s-2">
          <input type="password" value={pwd.new_} onChange={e => setPwd(p => ({ ...p, new_: e.target.value }))} placeholder="Nouveau mot de passe" className={inputCls} />
          <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Confirmer le nouveau mot de passe" className={inputCls} />
          <Button onClick={changePassword} loading={pwdSaving} disabled={!pwd.new_} className="self-start">Mettre à jour</Button>
        </div>
      </div>

      {/* 2FA */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <h3 className="mb-s-3 font-semibold text-ink flex items-center gap-s-2">
          <ShieldCheck className="h-5 w-5 text-primary" />Double authentification (2FA)
        </h3>
        {mfaStatus === 'loading' && <Skeleton className="h-10 rounded-md" />}
        {mfaStatus === 'active' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-s-2">
              <ShieldCheck className="h-5 w-5 text-status-success" />
              <span className="text-small font-medium text-status-success">Activée</span>
            </div>
            <Button size="sm" variant="secondary" onClick={unenrollMfa} loading={mfaLoading} className="text-status-danger border-status-danger/30">Désactiver</Button>
          </div>
        )}
        {mfaStatus === 'none' && !qrCode && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-s-2">
              <Shield className="h-5 w-5 text-ink-3" />
              <span className="text-small text-ink-2">Non activée</span>
            </div>
            <Button size="sm" leftIcon={<Shield className="h-4 w-4" />} onClick={enrollMfa} loading={mfaLoading}>Activer</Button>
          </div>
        )}
        {qrCode && (
          <div className="flex flex-col gap-s-3">
            <p className="text-small text-ink-2">Scannez ce QR code avec votre application TOTP (Google Authenticator, Authy…)</p>
            <img src={qrCode} alt="QR code 2FA" className="w-40 h-40 rounded-md border border-line" />
            <div className="flex gap-s-2">
              <input value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="Code à 6 chiffres"
                maxLength={6} inputMode="numeric" className={inputCls + ' w-48'} />
              <Button onClick={verifyMfa} loading={mfaLoading} disabled={totpCode.length < 6}>Vérifier</Button>
            </div>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <h3 className="mb-s-3 font-semibold text-ink">Sessions actives</h3>
        <div className="flex items-center justify-between rounded-md bg-surface-2 px-s-3 py-s-2">
          <div>
            <p className="text-small font-medium text-ink">Session courante</p>
            <p className="text-micro text-ink-3">Appareil actuel</p>
          </div>
          <span className="rounded-pill bg-status-success/10 px-s-2 py-0.5 text-micro text-status-success font-medium">Active</span>
        </div>
        <Button size="sm" variant="secondary" leftIcon={<LogOut className="h-4 w-4" />}
          onClick={() => supabase.auth.signOut({ scope: 'global' }).then(() => toast.success('Tous les appareils déconnectés.'))}
          className="mt-s-2 text-status-danger border-status-danger/30 hover:bg-status-danger/5">
          Déconnecter tous les appareils
        </Button>
      </div>

      {/* RGPD */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <h3 className="mb-s-2 font-semibold text-ink">Mes données (RGPD)</h3>
        <p className="mb-s-3 text-small text-ink-2">Téléchargez un export JSON de toutes vos données : profil, RDV, ordonnances, documents, paiements.</p>
        <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportRGPD} loading={downloading}>
          Télécharger mes données
        </Button>
      </div>

      {/* Suppression */}
      <div className="rounded-md border border-status-danger/30 bg-status-danger/5 p-s-4">
        <h3 className="mb-s-2 font-semibold text-status-danger flex items-center gap-s-2">
          <AlertTriangle className="h-5 w-5" />Supprimer mon compte
        </h3>
        <p className="mb-s-3 text-small text-ink-2">Cette action entraîne un soft-delete de 30 jours. L'administrateur peut restaurer votre compte pendant ce délai.</p>
        <Button className="bg-status-danger hover:bg-status-danger/90" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteModal(true)}>
          Supprimer mon compte
        </Button>
      </div>

      <Modal open={deleteModal} onOpenChange={v => !v && setDeleteModal(false)} title="Supprimer votre compte" size="sm">
        <div className="flex flex-col gap-s-4">
          <div className="flex items-start gap-s-3 rounded-md bg-status-danger/10 p-s-3">
            <AlertTriangle className="h-5 w-5 text-status-danger shrink-0 mt-0.5" />
            <div className="text-small text-ink-2">
              <p className="font-semibold text-ink mb-s-1">Action irréversible après 30 jours</p>
              <p>Vos données seront définitivement supprimées après 30 jours. Vous serez déconnecté immédiatement.</p>
            </div>
          </div>
          <div>
            <label className="mb-s-1 block text-small font-medium text-ink">Tapez <strong>SUPPRIMER</strong> pour confirmer</label>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="SUPPRIMER"
              className="w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteModal(false)} disabled={deleting}>Annuler</Button>
            <Button className="flex-1 bg-status-danger hover:bg-status-danger/90" onClick={deleteAccount} loading={deleting} disabled={deleteInput !== 'SUPPRIMER'}>
              Confirmer la suppression
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── PreferencesTab ───────────────────────────────────────────────────────────
function PreferencesTab({ prefs, patientId, onSave }: {
  prefs: PatientData['preferences']; patientId: string; onSave: (p: PatientData['preferences']) => void
}) {
  const db = supabase as any
  const [local, setLocal] = useState({ ...prefs })

  async function update(key: keyof PatientData['preferences'], val: string) {
    const updated = { ...local, [key]: val }
    setLocal(updated)
    await db.from('patients').update({ preferences: updated }).eq('id', patientId)
    onSave(updated)
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', val === 'auto' ? '' : val)
    }
  }

  return (
    <div className="flex flex-col gap-s-4">
      {[
        { key: 'langue' as const,      label: 'Langue',          icon: <Globe className="h-5 w-5 text-primary" />,  opts: LANGUES },
        { key: 'theme' as const,       label: 'Thème',           icon: local.theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />, opts: THEMES },
        { key: 'format_date' as const, label: 'Format de date',  icon: <Clock className="h-5 w-5 text-primary" />, opts: DATE_FMT },
      ].map(({ key, label, icon, opts }) => (
        <div key={key} className="rounded-md border border-line bg-surface p-s-4">
          <div className="flex items-center gap-s-2 mb-s-3">
            {icon}
            <h3 className="font-semibold text-ink">{label}</h3>
          </div>
          <div className="flex flex-wrap gap-s-2">
            {opts.map(o => (
              <button key={o.value} onClick={() => update(key, o.value)}
                className={cn('rounded-pill border px-s-3 py-s-1 text-small font-medium transition-colors',
                  local[key] === o.value ? 'border-primary bg-primary text-white' : 'border-line hover:bg-surface-2 text-ink')}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── UrgenceTab ───────────────────────────────────────────────────────────────
function UrgenceTab({ contacts, patientId, onSave }: {
  contacts: ContactUrgence[]; patientId: string; onSave: (c: ContactUrgence[]) => void
}) {
  const db = supabase as any
  const [list, setList] = useState<ContactUrgence[]>(contacts ?? [])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<ContactUrgence>({ prenom: '', nom: '', lien: '', telephone: '', acces_dossier: false })
  const [saving, setSaving] = useState(false)

  async function persist(updated: ContactUrgence[]) {
    setSaving(true)
    await db.from('patients').update({ contacts_urgence: updated }).eq('id', patientId)
    onSave(updated); setSaving(false)
  }

  async function add() {
    if (!form.prenom || !form.telephone) return
    const updated = [...list, { ...form }].slice(0, 3)
    setList(updated); await persist(updated); setAdding(false)
    setForm({ prenom: '', nom: '', lien: '', telephone: '', acces_dossier: false })
  }

  async function remove(i: number) {
    const updated = list.filter((_, j) => j !== i)
    setList(updated); await persist(updated)
  }

  async function toggleAcces(i: number, val: boolean) {
    const updated = list.map((c, j) => j === i ? { ...c, acces_dossier: val } : c)
    setList(updated); await persist(updated)
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-s-3 py-s-2 text-small placeholder:text-ink-3 focus:outline-none focus:shadow-focus"

  return (
    <div className="flex flex-col gap-s-4">
      <p className="text-small text-ink-2">Maximum 3 contacts d'urgence. Ces personnes seront contactées en cas d'urgence médicale.</p>

      {list.map((c, i) => (
        <div key={i} className="rounded-md border border-line bg-surface p-s-4">
          <div className="flex items-center justify-between mb-s-2">
            <p className="font-semibold text-ink">{c.prenom} {c.nom} <span className="text-small text-ink-3">({c.lien})</span></p>
            <button onClick={() => remove(i)} className="text-ink-3 hover:text-status-danger"><Trash2 className="h-4 w-4" /></button>
          </div>
          <p className="text-small text-ink-2 mb-s-2"><Phone className="inline h-4 w-4 mr-s-1" />{c.telephone}</p>
          <Switch
            checked={c.acces_dossier}
            onCheckedChange={v => toggleAcces(i, v)}
            label="Accès au dossier en urgence"
            description="Ce contact peut consulter votre dossier médical en cas d'urgence."
          />
        </div>
      ))}

      {!adding && list.length < 3 && (
        <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
          Ajouter un contact d'urgence
        </Button>
      )}

      {adding && (
        <div className="rounded-md border border-primary bg-surface p-s-4 flex flex-col gap-s-3">
          <h3 className="font-semibold text-ink">Nouveau contact</h3>
          <div className="grid grid-cols-2 gap-s-2">
            <input value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))} placeholder="Prénom *" className={inputCls} />
            <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Nom" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-s-2">
            <input value={form.lien} onChange={e => setForm(p => ({ ...p, lien: e.target.value }))} placeholder="Lien (ex: Épouse)" className={inputCls} />
            <input type="tel" value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))} placeholder="Téléphone *" className={inputCls} />
          </div>
          <Switch checked={form.acces_dossier} onCheckedChange={v => setForm(p => ({ ...p, acces_dossier: v }))}
            label="Accès dossier en urgence" />
          <div className="flex gap-s-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>Annuler</Button>
            <Button className="flex-1" onClick={add} loading={saving} disabled={!form.prenom || !form.telephone}>Ajouter</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ProfilPage ───────────────────────────────────────────────────────────────
const DEFAULT_DATA: PatientData = {
  prenom: '', nom: '', date_naissance: '', genre: '', adresse: '', telephone: '',
  groupe_sanguin: '', allergies: [], antecedents: [], traitements_actuels: [],
  medecin_traitant_id: null, contacts_urgence: [], photo_url: null,
  preferences: { langue: 'fr', theme: 'auto', format_date: 'dd/mm/yyyy' },
}

export default function ProfilPage() {
  const db = supabase as any
  const { profile, refreshProfile } = useAuth()

  const [data, setData]       = useState<PatientData>(DEFAULT_DATA)
  const [medecin, setMedecin] = useState<MedecinInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('infos')

  const patientId = profile?.id ?? ''

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    const { data: row } = await db.from('patients').select('*').eq('id', patientId).maybeSingle()
    if (row) setData({ ...DEFAULT_DATA, ...row, preferences: { ...DEFAULT_DATA.preferences, ...(row.preferences ?? {}) } })
    setLoading(false)
  }, [patientId])

  const loadMedecin = useCallback(async () => {
    if (!data.medecin_traitant_id) { setMedecin(null); return }
    const { data: m } = await db.from('profiles').select('id, first_name, last_name, telephone, photo_url').eq('id', data.medecin_traitant_id).maybeSingle()
    setMedecin(m ?? null)
  }, [data.medecin_traitant_id])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadMedecin() }, [loadMedecin])

  function patch(partial: Partial<PatientData>) {
    setData(prev => ({ ...prev, ...partial }))
  }

  const pct = completionPct(data)
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ') || 'Votre profil'
  const ageStr = data.date_naissance ? `${differenceInYears(new Date(), new Date(data.date_naissance))} ans` : ''

  if (loading) {
    return (
      <div className="flex flex-col gap-s-4 pb-s-8 max-w-2xl mx-auto">
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-40 rounded-md" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-s-4 pb-s-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="rounded-md border border-line bg-surface p-s-4">
        <div className="flex items-center gap-s-4">
          <AvatarUpload photoUrl={data.photo_url} patientId={patientId} onUploaded={url => { patch({ photo_url: url }); refreshProfile() }} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-h1 font-semibold text-ink truncate">{fullName}</h1>
            <p className="text-small text-ink-2">{ageStr}{data.genre ? ` · ${GENRES.find(g => g.value === data.genre)?.label ?? ''}` : ''}</p>
            {/* Barre complétion */}
            <div className="mt-s-2">
              <div className="flex items-center justify-between mb-s-0.5">
                <span className="text-micro text-ink-3">Complétion du profil</span>
                <span className="text-micro font-semibold text-ink">{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className={cn('h-full rounded-full transition-all', pct >= 80 ? 'bg-status-success' : pct >= 50 ? 'bg-status-pending' : 'bg-status-danger')}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-s-1 border-b border-line overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('shrink-0 pb-s-2 px-s-3 text-small font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-ink-2 hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {tab === 'infos' && (
        <InfosTab data={data} patientId={patientId} medecin={medecin} onSave={patch} onRefreshMedecin={loadMedecin} />
      )}
      {tab === 'medical' && (
        <MedicalTab data={data} patientId={patientId} onSave={patch} />
      )}
      {tab === 'securite' && <SecuriteTab patientId={patientId} />}
      {tab === 'preferences' && (
        <PreferencesTab prefs={data.preferences} patientId={patientId} onSave={p => patch({ preferences: p })} />
      )}
      {tab === 'urgence' && (
        <UrgenceTab contacts={data.contacts_urgence} patientId={patientId} onSave={c => patch({ contacts_urgence: c })} />
      )}
    </div>
  )
}
