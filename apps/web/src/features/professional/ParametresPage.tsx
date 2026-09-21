import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, DollarSign, Bell, Video, Shield, Database,
  CreditCard, ChevronRight, Check, Loader2, Eye, EyeOff,
  Smartphone, LogOut, Download, Trash2, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type SectionId =
  | 'infos' | 'tarifs' | 'banque' | 'notifs'
  | 'teleconsult' | 'securite' | 'donnees' | 'abonnement'

interface Section { id: SectionId; label: string; icon: React.ReactNode }

interface ProfilForm {
  full_name:     string
  specialite:    string
  type_pro:      string
  numero_ordre:  string
  biographie:    string
  langues:       string[]
}

interface TarifsForm {
  tarif_consultation: string
  tarif_acte:         string
  tarif_urgence:      string
}

interface NotifsForm {
  email_rdv:         boolean
  email_ordonnance:  boolean
  email_paiement:    boolean
  push_rdv:          boolean
  push_ordonnance:   boolean
  push_paiement:     boolean
}

interface TeleconsultForm {
  actif:      boolean
  plateforme: string
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: 'infos',       label: 'Informations personnelles', icon: <User className="h-4 w-4" /> },
  { id: 'tarifs',      label: 'Tarifs',                    icon: <DollarSign className="h-4 w-4" /> },
  { id: 'banque',      label: 'Comptes bancaires',         icon: <CreditCard className="h-4 w-4" /> },
  { id: 'notifs',      label: 'Notifications',             icon: <Bell className="h-4 w-4" /> },
  { id: 'teleconsult', label: 'Téléconsultation',          icon: <Video className="h-4 w-4" /> },
  { id: 'securite',    label: 'Sécurité',                  icon: <Shield className="h-4 w-4" /> },
  { id: 'donnees',     label: 'Données',                   icon: <Database className="h-4 w-4" /> },
  { id: 'abonnement',  label: 'Abonnement',                icon: <CreditCard className="h-4 w-4" /> },
]

const TYPE_PRO_OPTS = [
  { value: 'medecin',        label: 'Médecin' },
  { value: 'dentiste',       label: 'Dentiste' },
  { value: 'pharmacien',     label: 'Pharmacien' },
  { value: 'infirmier',      label: 'Infirmier(e)' },
  { value: 'sage_femme',     label: 'Sage-femme' },
  { value: 'kinesitherapeute',label: 'Kinésithérapeute' },
  { value: 'radiologue',     label: 'Radiologue' },
  { value: 'biologiste',     label: 'Biologiste' },
  { value: 'autre',          label: 'Autre' },
]

const SPECIALITES_OPTS = [
  { value: '',                   label: 'Généraliste' },
  { value: 'cardiologie',        label: 'Cardiologie' },
  { value: 'pediatrie',          label: 'Pédiatrie' },
  { value: 'gynecologie',        label: 'Gynécologie-obstétrique' },
  { value: 'chirurgie',          label: 'Chirurgie' },
  { value: 'neurologie',         label: 'Neurologie' },
  { value: 'ophtalmologie',      label: 'Ophtalmologie' },
  { value: 'dermatologie',       label: 'Dermatologie' },
  { value: 'psychiatrie',        label: 'Psychiatrie' },
  { value: 'oto_rhino',          label: 'ORL' },
  { value: 'rhumatologie',       label: 'Rhumatologie' },
  { value: 'endocrinologie',     label: 'Endocrinologie' },
  { value: 'nephrologie',        label: 'Néphrologie' },
  { value: 'pneumologie',        label: 'Pneumologie' },
  { value: 'gastroenterologie',  label: 'Gastro-entérologie' },
  { value: 'urologie',           label: 'Urologie' },
]

const LANGUES_OPTS = ['Français', 'Wolof', 'Arabe', 'Anglais', 'Peul', 'Sereer', 'Mandingue', 'Diola']
const PLATEFORME_OPTS = [
  { value: 'meet',  label: 'Google Meet' },
  { value: 'zoom',  label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'autre', label: 'Autre' },
]

const EMPTY_PROFIL: ProfilForm = { full_name: '', specialite: '', type_pro: 'medecin', numero_ordre: '', biographie: '', langues: [] }
const EMPTY_TARIFS: TarifsForm = { tarif_consultation: '', tarif_acte: '', tarif_urgence: '' }
const EMPTY_NOTIFS: NotifsForm = { email_rdv: true, email_ordonnance: true, email_paiement: true, push_rdv: true, push_ordonnance: false, push_paiement: true }
const EMPTY_TELE: TeleconsultForm = { actif: false, plateforme: 'meet' }

// ── Composant ──────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const db = supabase as any
  const fileRef = useRef<HTMLInputElement>(null)

  const [activeSection, setActiveSection] = useState<SectionId>('infos')
  const [loading, setLoading] = useState(true)

  // Forms
  const [profil, setProfil]       = useState<ProfilForm>(EMPTY_PROFIL)
  const [tarifs, setTarifs]       = useState<TarifsForm>(EMPTY_TARIFS)
  const [notifs, setNotifs]       = useState<NotifsForm>(EMPTY_NOTIFS)
  const [teleconsult, setTeleconsult] = useState<TeleconsultForm>(EMPTY_TELE)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Comptes bancaires
  const [comptes, setComptes]     = useState<any[]>([])
  const [newCompte, setNewCompte] = useState({ iban: '', numero: '', intitule: '' })

  // Securité
  const [sessions, setSessions]   = useState<any[]>([])
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [newPwd, setNewPwd]       = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd]     = useState(false)

  // Saving states
  const [savingProfil, setSavingProfil] = useState(false)
  const [savingTarifs, setSavingTarifs] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [savingTele, setSavingTele]     = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [addingCompte, setAddingCompte]       = useState(false)
  const [changingPwd, setChangingPwd]         = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    const [profRes, prosRes, notifsRes, teleRes, comptesRes] = await Promise.all([
      db.from('profiles')
        .select('full_name, specialite, type_professionnel, numero_ordre, biographie, langues, avatar_url')
        .eq('id', profile.id).single(),
      db.from('professionals')
        .select('tarif_consultation, tarif_acte, tarif_urgence, teleconsult_actif, teleconsult_plateforme')
        .eq('profile_id', profile.id).maybeSingle(),
      db.from('notification_preferences')
        .select('*').eq('profile_id', profile.id).maybeSingle(),
      db.from('professionals')
        .select('teleconsult_actif, teleconsult_plateforme')
        .eq('profile_id', profile.id).maybeSingle(),
      db.from('comptes_bancaires')
        .select('id, intitule, iban, numero_compte, created_at')
        .eq('professional_id', profile.id).order('created_at', { ascending: false }),
    ])

    const p = profRes.data ?? {}
    const pro = prosRes.data ?? {}
    const n = notifsRes.data ?? {}

    setProfil({
      full_name:    p.full_name ?? '',
      specialite:   p.specialite ?? '',
      type_pro:     p.type_professionnel ?? 'medecin',
      numero_ordre: p.numero_ordre ?? '',
      biographie:   p.biographie ?? '',
      langues:      p.langues ?? [],
    })
    setAvatarUrl(p.avatar_url)
    setTarifs({
      tarif_consultation: pro.tarif_consultation ? String(pro.tarif_consultation) : '',
      tarif_acte:         pro.tarif_acte         ? String(pro.tarif_acte)         : '',
      tarif_urgence:      pro.tarif_urgence       ? String(pro.tarif_urgence)      : '',
    })
    setNotifs({
      email_rdv:        n.email_rdv        ?? true,
      email_ordonnance: n.email_ordonnance ?? true,
      email_paiement:   n.email_paiement   ?? true,
      push_rdv:         n.push_rdv         ?? true,
      push_ordonnance:  n.push_ordonnance  ?? false,
      push_paiement:    n.push_paiement    ?? true,
    })
    setTeleconsult({
      actif:      pro.teleconsult_actif      ?? false,
      plateforme: pro.teleconsult_plateforme ?? 'meet',
    })
    setComptes(comptesRes.data ?? [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  // ── Sauvegarde infos personnelles ─────────────────────────────────────────
  async function saveProfil() {
    if (!profile?.id) return
    setSavingProfil(true)
    try {
      const { error } = await db.from('profiles').update({
        full_name:            profil.full_name.trim(),
        specialite:           profil.specialite,
        type_professionnel:   profil.type_pro,
        numero_ordre:         profil.numero_ordre.trim(),
        biographie:           profil.biographie.trim(),
        langues:              profil.langues,
      }).eq('id', profile.id)
      if (error) throw error
      if (refreshProfile) await refreshProfile()
      toast.success('Profil mis à jour')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSavingProfil(false) }
  }

  // ── Upload avatar ─────────────────────────────────────────────────────────
  async function uploadAvatar(file: File) {
    if (!profile?.id) return
    setUploadingAvatar(true)
    try {
      const path = `avatars/${profile.id}/${Date.now()}.${file.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      await db.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      setAvatarUrl(urlData.publicUrl)
      if (refreshProfile) await refreshProfile()
      toast.success('Photo mise à jour')
    } catch { toast.error('Erreur upload photo') }
    finally { setUploadingAvatar(false) }
  }

  // ── Sauvegarde tarifs ─────────────────────────────────────────────────────
  async function saveTarifs() {
    if (!profile?.id) return
    setSavingTarifs(true)
    try {
      const { error } = await db.from('professionals').upsert({
        profile_id:         profile.id,
        tarif_consultation: tarifs.tarif_consultation ? parseInt(tarifs.tarif_consultation) : null,
        tarif_acte:         tarifs.tarif_acte         ? parseInt(tarifs.tarif_acte)         : null,
        tarif_urgence:      tarifs.tarif_urgence       ? parseInt(tarifs.tarif_urgence)      : null,
      }, { onConflict: 'profile_id' })
      if (error) throw error
      toast.success('Tarifs mis à jour')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSavingTarifs(false) }
  }

  // ── Ajouter compte bancaire ───────────────────────────────────────────────
  async function addCompteBancaire() {
    if (!newCompte.iban.trim() && !newCompte.numero.trim()) {
      toast.error('IBAN ou numéro de compte requis'); return
    }
    setAddingCompte(true)
    try {
      const { error } = await db.from('comptes_bancaires').insert({
        professional_id: profile!.id,
        intitule:        newCompte.intitule.trim() || null,
        iban:            newCompte.iban.trim()     || null,
        numero_compte:   newCompte.numero.trim()   || null,
      })
      if (error) throw error
      toast.success('Compte ajouté')
      setNewCompte({ iban: '', numero: '', intitule: '' })
      await load()
    } catch { toast.error('Erreur lors de l\'ajout') }
    finally { setAddingCompte(false) }
  }

  async function removeCompte(id: string) {
    await db.from('comptes_bancaires').delete().eq('id', id).eq('professional_id', profile!.id)
    setComptes(c => c.filter(x => x.id !== id))
    toast.success('Compte supprimé')
  }

  // ── Sauvegarder notifications ─────────────────────────────────────────────
  async function saveNotifs() {
    if (!profile?.id) return
    setSavingNotifs(true)
    try {
      await db.from('notification_preferences').upsert({
        profile_id:       profile.id,
        ...notifs,
      }, { onConflict: 'profile_id' })
      toast.success('Préférences notifications mises à jour')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSavingNotifs(false) }
  }

  // ── Sauvegarder téléconsultation ──────────────────────────────────────────
  async function saveTeleconsult() {
    if (!profile?.id) return
    setSavingTele(true)
    try {
      await db.from('professionals').upsert({
        profile_id:             profile.id,
        teleconsult_actif:      teleconsult.actif,
        teleconsult_plateforme: teleconsult.plateforme,
      }, { onConflict: 'profile_id' })
      toast.success('Paramètres téléconsultation mis à jour')
    } catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSavingTele(false) }
  }

  // ── Changer mot de passe ──────────────────────────────────────────────────
  async function changePassword() {
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (newPwd.length < 8)     { toast.error('Minimum 8 caractères'); return }
    setChangingPwd(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      toast.success('Mot de passe mis à jour')
      setChangePwdOpen(false); setNewPwd(''); setConfirmPwd('')
    } catch { toast.error('Erreur lors du changement de mot de passe') }
    finally { setChangingPwd(false) }
  }

  // ── Export RGPD ───────────────────────────────────────────────────────────
  async function exportData() {
    const data = { profile_id: profile?.id, full_name: profile?.full_name, exported_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `mes-donnees-${Date.now()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Export téléchargé')
  }

  if (loading) {
    return (
      <div className="flex gap-s-6 p-s-6">
        <Skeleton className="h-64 w-56 shrink-0 rounded-xl" />
        <Skeleton className="h-64 flex-1 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex gap-s-6 p-s-4 md:p-s-6">

      {/* ── Sidebar sections ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-s-1">
        {SECTIONS.map(s => (
          <button key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              'flex items-center gap-s-3 rounded-lg px-s-3 py-s-2 text-small transition-colors text-left',
              activeSection === s.id
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-ink-3 hover:text-ink hover:bg-surface-2',
            )}>
            {s.icon}
            {s.label}
          </button>
        ))}
      </aside>

      {/* ── Contenu section ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-s-4">

        {/* Mobile nav */}
        <div className="flex md:hidden overflow-x-auto gap-s-1 pb-s-1">
          {SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex-shrink-0 rounded-lg px-s-3 py-s-1.5 text-micro transition-colors',
                activeSection === s.id ? 'bg-primary text-white' : 'bg-surface-2 text-ink-3',
              )}>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── 9.1 Infos personnelles ─────────────────────────────────────── */}
        {activeSection === 'infos' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <User className="h-5 w-5 text-primary" /> Informations personnelles
            </h2>

            {/* Avatar */}
            <div className="flex items-center gap-s-4">
              <Avatar src={avatarUrl} fallback={profil.full_name} size="xl" />
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
                />
                <Button variant="secondary" size="sm"
                  loading={uploadingAvatar}
                  onClick={() => fileRef.current?.click()}>
                  Changer la photo
                </Button>
                <p className="mt-s-1 text-micro text-ink-3">JPG, PNG, WebP — max 2 Mo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-s-4 sm:grid-cols-2">
              <Input label="Nom complet *" value={profil.full_name}
                onChange={e => setProfil(p => ({ ...p, full_name: e.target.value }))} />
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Type de professionnel</label>
                <Select options={TYPE_PRO_OPTS} value={profil.type_pro}
                  onValueChange={v => setProfil(p => ({ ...p, type_pro: v }))} />
              </div>
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Spécialité</label>
                <Select options={SPECIALITES_OPTS} value={profil.specialite}
                  onValueChange={v => setProfil(p => ({ ...p, specialite: v }))} />
              </div>
              <Input label="N° d'ordre" value={profil.numero_ordre}
                placeholder="Ex: SN-0001234"
                onChange={e => setProfil(p => ({ ...p, numero_ordre: e.target.value }))} />
            </div>

            <div>
              <label className="mb-s-1 block text-small font-medium text-ink">Biographie</label>
              <textarea value={profil.biographie}
                onChange={e => setProfil(p => ({ ...p, biographie: e.target.value }))}
                rows={4} placeholder="Décrivez votre parcours, vos expertises…"
                className="w-full rounded-lg border border-line bg-surface p-s-3 text-small text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none resize-none" />
            </div>

            <div>
              <p className="mb-s-2 text-small font-medium text-ink">Langues parlées</p>
              <div className="flex flex-wrap gap-s-2">
                {LANGUES_OPTS.map(l => (
                  <label key={l} className={cn(
                    'flex cursor-pointer items-center gap-s-1.5 rounded-pill border px-s-3 py-s-1 text-small transition-colors',
                    profil.langues.includes(l)
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-line text-ink-3 hover:border-primary hover:text-primary',
                  )}>
                    <input type="checkbox" className="sr-only"
                      checked={profil.langues.includes(l)}
                      onChange={e => setProfil(p => ({
                        ...p,
                        langues: e.target.checked ? [...p.langues, l] : p.langues.filter(x => x !== l),
                      }))}
                    />
                    {profil.langues.includes(l) && <Check className="h-3 w-3" />}
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" loading={savingProfil} onClick={saveProfil}>
                Sauvegarder
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.2 Tarifs ─────────────────────────────────────────────────── */}
        {activeSection === 'tarifs' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <DollarSign className="h-5 w-5 text-primary" /> Tarifs de consultation
            </h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-s-3">
              <p className="text-micro text-amber-700">
                ⚠ Ces tarifs sont vos tarifs de base. Les taux de commission par établissement
                sont définis par l'établissement et peuvent différer.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-s-4 sm:grid-cols-3">
              <Input label="Consultation standard (FCFA)" type="number" value={tarifs.tarif_consultation}
                placeholder="Ex: 5000"
                onChange={e => setTarifs(t => ({ ...t, tarif_consultation: e.target.value }))} />
              <Input label="Acte technique (FCFA)" type="number" value={tarifs.tarif_acte}
                placeholder="Ex: 10000"
                onChange={e => setTarifs(t => ({ ...t, tarif_acte: e.target.value }))} />
              <Input label="Urgence (FCFA)" type="number" value={tarifs.tarif_urgence}
                placeholder="Ex: 15000"
                onChange={e => setTarifs(t => ({ ...t, tarif_urgence: e.target.value }))} />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" loading={savingTarifs} onClick={saveTarifs}>
                Mettre à jour tarifs
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.3 Comptes bancaires ───────────────────────────────────────── */}
        {activeSection === 'banque' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <CreditCard className="h-5 w-5 text-primary" /> Comptes bancaires (reversements)
            </h2>

            {/* Formulaire ajout */}
            <div className="rounded-lg border border-line p-s-4 flex flex-col gap-s-3">
              <p className="text-small font-semibold text-ink">Ajouter un compte</p>
              <Input label="Intitulé (optionnel)" value={newCompte.intitule}
                placeholder="Ex: Compte Wave principal"
                onChange={e => setNewCompte(c => ({ ...c, intitule: e.target.value }))} />
              <Input label="IBAN" value={newCompte.iban}
                placeholder="SN00 0000 0000 0000 0000 00"
                onChange={e => setNewCompte(c => ({ ...c, iban: e.target.value }))} />
              <Input label="Numéro de compte" value={newCompte.numero}
                placeholder="Wave, OM ou numéro bancaire"
                onChange={e => setNewCompte(c => ({ ...c, numero: e.target.value }))} />
              <Button variant="primary" size="sm" loading={addingCompte} onClick={addCompteBancaire}>
                Ajouter le compte
              </Button>
            </div>

            {/* Liste comptes */}
            {comptes.length > 0 && (
              <div className="flex flex-col gap-s-2">
                {comptes.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-s-3 rounded-lg border border-line p-s-3">
                    <CreditCard className="h-4 w-4 text-ink-3 shrink-0" />
                    <div className="flex-1 min-w-0">
                      {c.intitule && <p className="text-small font-medium text-ink">{c.intitule}</p>}
                      {c.iban && <p className="text-micro text-ink-3 font-mono truncate">{c.iban}</p>}
                      {c.numero_compte && <p className="text-micro text-ink-3">{c.numero_compte}</p>}
                    </div>
                    <button
                      onClick={() => removeCompte(c.id)}
                      className="rounded p-s-1 text-ink-3 hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {comptes.length === 0 && (
              <p className="text-small text-ink-3 text-center py-s-4">Aucun compte bancaire enregistré</p>
            )}
          </Card>
        )}

        {/* ── 9.4 Notifications ──────────────────────────────────────────── */}
        {activeSection === 'notifs' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <Bell className="h-5 w-5 text-primary" /> Préférences notifications
            </h2>

            {[
              { group: 'E-mail', items: [
                { key: 'email_rdv',        label: 'Nouvelle réservation' },
                { key: 'email_ordonnance', label: 'Nouvelle ordonnance' },
                { key: 'email_paiement',   label: 'Paiement reçu' },
              ]},
              { group: 'Push', items: [
                { key: 'push_rdv',        label: 'Nouvelle réservation' },
                { key: 'push_ordonnance', label: 'Nouvelle ordonnance' },
                { key: 'push_paiement',   label: 'Paiement reçu' },
              ]},
            ].map(({ group, items }) => (
              <div key={group}>
                <p className="mb-s-2 text-micro font-semibold text-ink-3 uppercase tracking-wide">{group}</p>
                <div className="flex flex-col gap-s-2">
                  {items.map(item => (
                    <label key={item.key} className="flex items-center gap-s-3 cursor-pointer">
                      <input type="checkbox"
                        checked={notifs[item.key as keyof NotifsForm] as boolean}
                        onChange={e => setNotifs(n => ({ ...n, [item.key]: e.target.checked }))}
                        className="h-4 w-4 accent-primary rounded"
                      />
                      <span className="text-small text-ink">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button variant="primary" loading={savingNotifs} onClick={saveNotifs}>
                Sauvegarder
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.5 Téléconsultation ───────────────────────────────────────── */}
        {activeSection === 'teleconsult' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <Video className="h-5 w-5 text-primary" /> Téléconsultation
            </h2>
            <label className="flex items-center gap-s-3 cursor-pointer">
              <input type="checkbox"
                checked={teleconsult.actif}
                onChange={e => setTeleconsult(t => ({ ...t, actif: e.target.checked }))}
                className="h-5 w-5 accent-primary rounded"
              />
              <div>
                <p className="text-small font-medium text-ink">Activer la téléconsultation</p>
                <p className="text-micro text-ink-3">
                  Les patients pourront choisir une consultation à distance dans votre agenda.
                </p>
              </div>
            </label>
            {teleconsult.actif && (
              <div>
                <label className="mb-s-1 block text-small font-medium text-ink">Plateforme par défaut</label>
                <Select options={PLATEFORME_OPTS} value={teleconsult.plateforme}
                  onValueChange={v => setTeleconsult(t => ({ ...t, plateforme: v }))} />
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="primary" loading={savingTele} onClick={saveTeleconsult}>
                Sauvegarder
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.6 Sécurité ───────────────────────────────────────────────── */}
        {activeSection === 'securite' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <Shield className="h-5 w-5 text-primary" /> Sécurité & authentification
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-line p-s-3">
              <div>
                <p className="text-small font-medium text-ink">Mot de passe</p>
                <p className="text-micro text-ink-3">Dernière modification : inconnue</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setChangePwdOpen(true)}>
                Changer
              </Button>
            </div>
            <div className="rounded-lg border border-line p-s-3">
              <div className="flex items-center justify-between mb-s-2">
                <p className="text-small font-medium text-ink">Authentification à deux facteurs (2FA)</p>
                <Badge variant="neutral">Non activé</Badge>
              </div>
              <p className="text-micro text-ink-3 mb-s-2">
                Activez le 2FA pour renforcer la sécurité de votre compte.
              </p>
              <Button variant="secondary" size="sm"
                onClick={() => toast.info('Configuration 2FA — disponible dans une prochaine mise à jour')}>
                Configurer le 2FA
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.7 Données ────────────────────────────────────────────────── */}
        {activeSection === 'donnees' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <Database className="h-5 w-5 text-primary" /> Données personnelles (RGPD)
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-line p-s-3">
              <div>
                <p className="text-small font-medium text-ink">Télécharger mes données</p>
                <p className="text-micro text-ink-3">Export JSON de vos données de profil</p>
              </div>
              <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={exportData}>
                Télécharger
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger/5 p-s-3">
              <div>
                <p className="text-small font-semibold text-danger">Supprimer mon compte</p>
                <p className="text-micro text-ink-3">Action irréversible — toutes vos données seront supprimées</p>
              </div>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setConfirmDeleteOpen(true)}>
                Demander suppression
              </Button>
            </div>
          </Card>
        )}

        {/* ── 9.8 Abonnement ─────────────────────────────────────────────── */}
        {activeSection === 'abonnement' && (
          <Card className="p-s-5 flex flex-col gap-s-5">
            <h2 className="text-base font-semibold text-ink flex items-center gap-s-2">
              <CreditCard className="h-5 w-5 text-primary" /> Abonnement
            </h2>
            <div className="rounded-lg bg-surface-2 p-s-4 flex flex-col gap-s-3">
              <div className="flex items-center justify-between">
                <p className="text-small font-semibold text-ink">Plan actuel</p>
                <Badge variant="success">Actif</Badge>
              </div>
              <p className="text-micro text-ink-3">
                Consultez la page abonnement pour les détails, les jauges d'usage et le changement de plan.
              </p>
            </div>
            <div className="flex flex-wrap gap-s-2">
              <Button variant="primary" leftIcon={<ChevronRight className="h-4 w-4" />}
                onClick={() => navigate('/pro/abonnement')}>
                Voir détails abonnement
              </Button>
              <Button variant="ghost" onClick={() => navigate('/tarifs')}>
                Changer de plan
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}

      {/* Changer mot de passe */}
      <Modal open={changePwdOpen} onOpenChange={open => { if (!open) { setChangePwdOpen(false); setNewPwd(''); setConfirmPwd('') } }}
        title="Changer le mot de passe">
        <div className="flex flex-col gap-s-4 p-s-4">
          <div className="relative">
            <Input label="Nouveau mot de passe" type={showPwd ? 'text' : 'password'}
              value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <button onClick={() => setShowPwd(v => !v)}
              className="absolute right-s-3 top-8 text-ink-3 hover:text-ink">
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input label="Confirmer le mot de passe" type="password"
            value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setChangePwdOpen(false)}>Annuler</Button>
            <Button variant="primary"
              leftIcon={changingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              disabled={changingPwd || !newPwd || !confirmPwd}
              onClick={changePassword}>
              {changingPwd ? 'Modification…' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmer suppression compte */}
      <Modal open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen} title="Supprimer mon compte">
        <div className="flex flex-col gap-s-4 p-s-4">
          <div className="flex items-start gap-s-3 rounded-lg bg-danger/10 border border-danger/30 p-s-3">
            <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
            <p className="text-small text-ink">
              Cette action est irréversible. Toutes vos données (dossiers, ordonnances, consultations)
              seront définitivement supprimées. Une demande sera transmise à l'équipe Séne Wérr.
            </p>
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>Annuler</Button>
            <Button variant="danger" onClick={() => {
              toast.info('Demande de suppression envoyée — l\'équipe vous contactera sous 48h')
              setConfirmDeleteOpen(false)
            }}>
              Confirmer la demande
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
