import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO, differenceInDays, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, MapPin, Clock, Users, CreditCard, ShieldAlert,
  Lock, Edit, Check, X, Plus, Trash2, Upload, AlertTriangle,
  Eye, EyeOff, Smartphone, LogOut, ChevronDown, ChevronUp,
  Copy, Bell,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { usePharmacy } from './PharmacyContext'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PharmacieData {
  id: string
  nom: string
  adresse: string
  telephone: string
  email: string
  logo_url: string | null
  en_service: boolean
  geolocalisation: string | null // "POINT(lon lat)" or "({lon},{lat})"
  horaires: HorairesJsonb | null
  pharmacien_responsable_id: string | null
  numero_autorisation: string | null
  date_autorisation: string | null
  date_renouvellement_autorisation: string | null
  stripe_account_id: string | null
  commission_taux: number | null
  zone_livraison_km: number | null
  modes_paiement: string[] | null
  message_fermeture: string | null
  fermeture_programmee_debut: string | null
  fermeture_programmee_fin: string | null
}

interface HorairesJsonb {
  [jour: string]: { matin_ouverture: string; matin_fermeture: string; matin_ferme: boolean; apmidi_ouverture: string; apmidi_fermeture: string; apmidi_ferme: boolean }
}

interface TeamMember {
  id: string
  pharmacie_id: string
  pharmacien_id: string
  role: 'responsable' | 'adjoint' | 'preparateur'
  actif: boolean
  profile?: { full_name: string; avatar_url: string | null; email?: string }
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const JOURS_LABELS: Record<string, string> = {
  lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu',
  vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
}

const MODES_PAIEMENT_ALL = ['Wave', 'Orange Money', 'Carte bancaire', 'Espèces']

const JOURS_FERIES_SN = [
  '01-01', '04-04', '05-01', '06-01', '08-15', '11-01', '11-02', '12-25',
]

function parseGeo(geo: string | null): [number, number] | null {
  if (!geo) return null
  const m = geo.match(/POINT\(([^ ]+) ([^ )]+)\)/)
  if (m) return [parseFloat(m[2]), parseFloat(m[1])]
  const m2 = geo.match(/\(([^,]+),([^)]+)\)/)
  if (m2) return [parseFloat(m2[2]), parseFloat(m2[1])]
  return null
}

// ─── Section collapse wrapper ──────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-s-3 px-s-5 py-s-4 text-left">
        <span className="text-primary">{icon}</span>
        <span className="flex-1 font-semibold text-ink">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-ink-3" /> : <ChevronDown className="h-4 w-4 text-ink-3" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden border-t border-line">
            <div className="px-s-5 py-s-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Map click handler ─────────────────────────────────────────────────────────

function MapClickHandler({ onLocationSet }: { onLocationSet: (lat: number, lon: number) => void }) {
  useMapEvents({ click: e => onLocationSet(e.latlng.lat, e.latlng.lng) })
  return null
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PharmacyProfilePage() {
  const { profile } = useAuth()
  const { pharmacie } = usePharmacy()
  const db = supabase as any

  const [pharmaData, setPharmaData] = useState<PharmacieData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editing state
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [zoneLivraison, setZoneLivraison] = useState('')
  const [lat, setLat] = useState<number>(14.7167)
  const [lon, setLon] = useState<number>(-17.4677)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Horaires
  const [horaires, setHoraires] = useState<HorairesJsonb>({})
  const [savingHoraires, setSavingHoraires] = useState(false)
  const [fermeJoursFeries, setFermeJoursFeries] = useState(false)

  // Service status
  const [enService, setEnService] = useState(true)
  const [messageFermeture, setMessageFermeture] = useState('')
  const [fermeDebut, setFermeDebut] = useState('')
  const [fermeFin, setFermeFin] = useState('')
  const [savingService, setSavingService] = useState(false)

  // Team
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('adjoint')
  const [inviting, setInviting] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  // Modes paiement
  const [modes, setModes] = useState<string[]>([])
  const [savingModes, setSavingModes] = useState(false)

  // Auth change (numéro autorisation → demande admin)
  const [showAutorisationModal, setShowAutorisationModal] = useState(false)
  const [newNumeroAuto, setNewNumeroAuto] = useState('')
  const [sendingAutoRequest, setSendingAutoRequest] = useState(false)

  // Security
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwd, setPwd] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [showMfa, setShowMfa] = useState(false)
  const [mfaQr, setMfaQr] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [enrollingMfa, setEnrollingMfa] = useState(false)

  // ─── Load ────────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoading(true)
    const { data, error } = await db.from('pharmacies')
      .select('*')
      .eq('id', pharmacie.id)
      .single()
    if (error) { toast.error('Erreur de chargement.'); setLoading(false); return }
    const d = data as PharmacieData
    setPharmaData(d)
    setNom(d.nom)
    setAdresse(d.adresse)
    setTelephone(d.telephone ?? '')
    setEmail(d.email ?? '')
    setZoneLivraison(String(d.zone_livraison_km ?? ''))
    setEnService(d.en_service)
    setMessageFermeture(d.message_fermeture ?? '')
    setFermeDebut(d.fermeture_programmee_debut ?? '')
    setFermeFin(d.fermeture_programmee_fin ?? '')
    setModes(d.modes_paiement ?? [])
    const geo = parseGeo(d.geolocalisation)
    if (geo) { setLat(geo[0]); setLon(geo[1]) }
    setHoraires(d.horaires ?? initHoraires())
    setLoading(false)
  }, [pharmacie?.id])

  useEffect(() => { loadData() }, [loadData])

  // ─── Load team ───────────────────────────────────────────────────────────────
  const loadTeam = useCallback(async () => {
    if (!pharmacie?.id) return
    setLoadingTeam(true)
    const { data } = await db.from('pharmaciens_pharmacie')
      .select('id, pharmacie_id, pharmacien_id, role, actif')
      .eq('pharmacie_id', pharmacie.id)
    const members: TeamMember[] = data ?? []
    if (members.length) {
      const ids = members.map(m => m.pharmacien_id)
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
      const profMap = new Map<string, { full_name: string; avatar_url: string | null }>((profiles ?? []).map((p: any) => [p.id, p]))
      members.forEach(m => { m.profile = profMap.get(m.pharmacien_id) as any })
    }
    setTeam(members)
    setLoadingTeam(false)
  }, [pharmacie?.id])

  useEffect(() => { loadTeam() }, [loadTeam])

  // ─── Load MFA factors ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaFactors(data?.totp ?? [])
    })
  }, [])

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function initHoraires(): HorairesJsonb {
    const h: HorairesJsonb = {}
    JOURS.forEach(j => {
      h[j] = {
        matin_ouverture: '08:00', matin_fermeture: '12:30', matin_ferme: j === 'dimanche',
        apmidi_ouverture: '15:00', apmidi_fermeture: '19:00', apmidi_ferme: j === 'dimanche',
      }
    })
    return h
  }

  function copyToAll() {
    const lundi = horaires.lundi
    if (!lundi) return
    const updated = { ...horaires }
    JOURS.slice(0, 5).forEach(j => { updated[j] = { ...lundi } })
    setHoraires(updated)
    toast.success('Horaires copiés vers les jours ouvrables.')
  }

  function renouvellementAlert(): number | null {
    if (!pharmaData?.date_renouvellement_autorisation) return null
    return differenceInDays(parseISO(pharmaData.date_renouvellement_autorisation), new Date())
  }

  // ─── Save info générale ───────────────────────────────────────────────────────
  async function saveInfo() {
    if (!pharmacie?.id) return
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('update-pharmacie-profile', {
      body: {
        pharmacie_id: pharmacie.id,
        nom, adresse, telephone, email,
        zone_livraison_km: zoneLivraison ? parseInt(zoneLivraison) : null,
        geolocalisation: `POINT(${lon} ${lat})`,
      },
    })
    if (error) { toast.error('Erreur de sauvegarde.'); setSaving(false); return }
    toast.success('Informations enregistrées.')
    setSaving(false); setEditMode(false); loadData()
  }

  // ─── Upload logo ──────────────────────────────────────────────────────────────
  async function uploadLogo(file: File) {
    if (!pharmacie?.id) return
    if (!file.type.startsWith('image/')) { toast.error('Fichier image uniquement.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop grande (5 Mo max).'); return }
    setLogoUploading(true)
    const path = `${pharmacie.id}/logo_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('logos-pharmacies').upload(path, file, { contentType: file.type, upsert: true })
    if (error) { toast.error('Erreur upload.'); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('logos-pharmacies').getPublicUrl(path)
    await db.from('pharmacies').update({ logo_url: publicUrl }).eq('id', pharmacie.id)
    toast.success('Logo mis à jour.')
    setLogoUploading(false); loadData()
  }

  // ─── Save horaires ────────────────────────────────────────────────────────────
  async function saveHoraires() {
    if (!pharmacie?.id) return
    setSavingHoraires(true)
    const { error } = await db.from('pharmacies').update({ horaires }).eq('id', pharmacie.id)
    if (error) { toast.error('Erreur.'); setSavingHoraires(false); return }
    toast.success('Horaires enregistrés.')
    setSavingHoraires(false)
  }

  // ─── Save service status ──────────────────────────────────────────────────────
  async function saveService() {
    if (!pharmacie?.id) return
    setSavingService(true)
    const updates: any = {
      en_service: enService,
      message_fermeture: messageFermeture || null,
      fermeture_programmee_debut: fermeDebut || null,
      fermeture_programmee_fin: fermeFin || null,
    }
    const { error } = await db.from('pharmacies').update(updates).eq('id', pharmacie.id)
    if (error) { toast.error('Erreur.'); setSavingService(false); return }
    toast.success('Statut mis à jour.')
    setSavingService(false)
  }

  // ─── Invite team member ───────────────────────────────────────────────────────
  async function inviteMember() {
    if (!pharmacie?.id || !inviteEmail.trim()) return
    setInviting(true)
    const { error } = await supabase.functions.invoke('invite-pharmacien', {
      body: { pharmacie_id: pharmacie.id, email: inviteEmail.trim(), role: inviteRole },
    })
    if (error) { toast.error('Erreur lors de l\'invitation.'); setInviting(false); return }
    toast.success(`Invitation envoyée à ${inviteEmail}.`)
    setInviting(false); setShowInvite(false); setInviteEmail(''); loadTeam()
  }

  async function disableMember(id: string) {
    await db.from('pharmaciens_pharmacie').update({ actif: false }).eq('id', id)
    setTeam(prev => prev.map(m => m.id === id ? { ...m, actif: false } : m))
    toast.success('Accès révoqué.')
  }

  // ─── Modes paiement ───────────────────────────────────────────────────────────
  async function saveModes() {
    if (!pharmacie?.id) return
    setSavingModes(true)
    await db.from('pharmacies').update({ modes_paiement: modes }).eq('id', pharmacie.id)
    toast.success('Modes de paiement enregistrés.')
    setSavingModes(false)
  }

  // ─── Autorisation change request ──────────────────────────────────────────────
  async function sendAutorisationRequest() {
    if (!pharmacie?.id || !newNumeroAuto.trim()) return
    setSendingAutoRequest(true)
    await supabase.functions.invoke('request-autorisation-change', {
      body: { pharmacie_id: pharmacie.id, nouveau_numero: newNumeroAuto.trim() },
    })
    toast.success('Demande de modification envoyée à l\'admin.')
    setSendingAutoRequest(false); setShowAutorisationModal(false); setNewNumeroAuto('')
  }

  // ─── Change password ──────────────────────────────────────────────────────────
  async function changePassword() {
    if (pwd !== pwdConfirm) { toast.error('Les mots de passe ne correspondent pas.'); return }
    if (pwd.length < 8) { toast.error('Minimum 8 caractères.'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) { toast.error('Erreur.'); setSavingPwd(false); return }
    toast.success('Mot de passe modifié.')
    setSavingPwd(false); setShowPwdModal(false); setPwd(''); setPwdConfirm('')
  }

  // ─── MFA enroll ───────────────────────────────────────────────────────────────
  async function startMfaEnroll() {
    setEnrollingMfa(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Pharmacien TOTP' })
    if (error || !data) { toast.error('Erreur MFA.'); setEnrollingMfa(false); return }
    setMfaQr(data.totp.qr_code)
    setMfaFactorId(data.id)
    setShowMfa(true)
    setEnrollingMfa(false)
  }

  async function verifyMfa() {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: mfaFactorId, code: mfaCode,
    })
    if (error) { toast.error('Code invalide.'); return }
    toast.success('Double authentification activée.')
    setShowMfa(false); setMfaCode('')
    supabase.auth.mfa.listFactors().then(({ data }) => setMfaFactors(data?.totp ?? []))
  }

  async function unenrollMfa(id: string) {
    await supabase.auth.mfa.unenroll({ factorId: id })
    setMfaFactors(prev => prev.filter(f => f.id !== id))
    toast.success('2FA désactivée.')
  }

  // ─── Days until renouvellement ────────────────────────────────────────────────
  const joursRenouvellement = renouvellementAlert()

  if (loading) return (
    <div className="flex flex-col gap-s-4 pb-s-8">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-s-4 pb-s-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 font-semibold text-ink">Ma pharmacie</h1>
        {joursRenouvellement !== null && joursRenouvellement < 60 && (
          <div className="flex items-center gap-s-2 rounded-lg border border-amber-300 bg-amber-50 px-s-3 py-s-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-small text-amber-800 font-medium">
              Renouvellement autorisation dans <strong>{joursRenouvellement} j</strong>
            </p>
          </div>
        )}
      </div>

      {/* 1 ─ Informations générales ─────────────────────────────────────────── */}
      <Section title="Informations générales" icon={<Building2 className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-5">
          {/* Logo */}
          <div className="flex items-center gap-s-4">
            <div className="relative h-20 w-20 shrink-0">
              <img src={pharmaData?.logo_url ?? '/default-pharmacy.png'} alt="Logo"
                className="h-20 w-20 rounded-xl object-cover border border-line" />
              {editMode && (
                <button onClick={() => logoInputRef.current?.click()}
                  className="absolute -right-1 -bottom-1 rounded-full bg-primary p-s-1.5 text-white shadow">
                  {logoUploading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Upload className="h-3 w-3" />}
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            </div>
            <div>
              <p className="font-semibold text-ink">{pharmaData?.nom}</p>
              <p className="text-small text-ink-3">{pharmaData?.adresse}</p>
            </div>
          </div>

          {editMode ? (
            <div className="grid grid-cols-1 gap-s-3 sm:grid-cols-2">
              {[
                { label: 'Nom', value: nom, set: setNom },
                { label: 'Adresse', value: adresse, set: setAdresse },
                { label: 'Téléphone', value: telephone, set: setTelephone, type: 'tel' },
                { label: 'Email', value: email, set: setEmail, type: 'email' },
                { label: 'Zone livraison (km)', value: zoneLivraison, set: setZoneLivraison, type: 'number' },
              ].map(f => (
                <div key={f.label} className="flex flex-col gap-s-1">
                  <label className="text-micro font-semibold text-ink">{f.label}</label>
                  <input type={f.type ?? 'text'} value={f.value} onChange={e => f.set(e.target.value)}
                    className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-s-3">
              {[
                ['Téléphone', pharmaData?.telephone],
                ['Email', pharmaData?.email],
                ['Zone livraison', pharmaData?.zone_livraison_km ? `${pharmaData.zone_livraison_km} km` : '—'],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-micro text-ink-3">{label}</p>
                  <p className="text-small font-medium text-ink">{val ?? '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Carte géolocalisation */}
          {editMode && (
            <div className="flex flex-col gap-s-2">
              <label className="text-micro font-semibold text-ink">Géolocalisation (cliquez sur la carte)</label>
              <div className="h-48 rounded-lg overflow-hidden border border-line z-0">
                <MapContainer center={[lat, lon]} zoom={13} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[lat, lon]} />
                  <MapClickHandler onLocationSet={(la, lo) => { setLat(la); setLon(lo) }} />
                </MapContainer>
              </div>
              <div className="flex gap-s-3">
                <div className="flex flex-col gap-s-1">
                  <label className="text-micro text-ink-3">Latitude</label>
                  <input type="number" step="0.0001" value={lat}
                    onChange={e => setLat(parseFloat(e.target.value))}
                    className="rounded border border-line bg-surface px-s-2 py-s-1 text-small w-32 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-s-1">
                  <label className="text-micro text-ink-3">Longitude</label>
                  <input type="number" step="0.0001" value={lon}
                    onChange={e => setLon(parseFloat(e.target.value))}
                    className="rounded border border-line bg-surface px-s-2 py-s-1 text-small w-32 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-s-2">
            {editMode ? (
              <>
                <Button variant="ghost" leftIcon={<X className="h-4 w-4" />} onClick={() => setEditMode(false)}>Annuler</Button>
                <Button variant="primary" leftIcon={<Check className="h-4 w-4" />} onClick={saveInfo} loading={saving}>Enregistrer</Button>
              </>
            ) : (
              <Button variant="secondary" leftIcon={<Edit className="h-4 w-4" />} onClick={() => setEditMode(true)}>Modifier</Button>
            )}
          </div>
        </div>
      </Section>

      {/* 2 ─ Horaires d'ouverture ───────────────────────────────────────────── */}
      <Section title="Horaires d'ouverture" icon={<Clock className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-small border-separate border-spacing-y-s-1">
              <thead>
                <tr>
                  <th className="px-s-2 py-s-1 text-left text-micro font-semibold text-ink-3">Jour</th>
                  <th colSpan={3} className="px-s-2 py-s-1 text-center text-micro font-semibold text-ink-3">Matin</th>
                  <th colSpan={3} className="px-s-2 py-s-1 text-center text-micro font-semibold text-ink-3">Après-midi</th>
                </tr>
              </thead>
              <tbody>
                {JOURS.map(jour => {
                  const h = horaires[jour] ?? { matin_ouverture: '08:00', matin_fermeture: '12:30', matin_ferme: false, apmidi_ouverture: '15:00', apmidi_fermeture: '19:00', apmidi_ferme: false }
                  const update = (field: string, val: any) => setHoraires(prev => ({ ...prev, [jour]: { ...prev[jour], [field]: val } }))
                  return (
                    <tr key={jour} className="bg-surface-2/50 rounded">
                      <td className="px-s-2 py-s-1.5 font-medium text-ink">{JOURS_LABELS[jour]}</td>
                      <td className="px-s-1 py-s-1.5">
                        <input type="time" value={h.matin_ouverture} disabled={h.matin_ferme}
                          onChange={e => update('matin_ouverture', e.target.value)}
                          className="rounded border border-line bg-surface px-s-1.5 py-s-0.5 text-micro disabled:opacity-40 focus:outline-none w-20" />
                      </td>
                      <td className="px-s-1 py-s-1.5 text-micro text-ink-3">→</td>
                      <td className="px-s-1 py-s-1.5">
                        <input type="time" value={h.matin_fermeture} disabled={h.matin_ferme}
                          onChange={e => update('matin_fermeture', e.target.value)}
                          className="rounded border border-line bg-surface px-s-1.5 py-s-0.5 text-micro disabled:opacity-40 focus:outline-none w-20" />
                      </td>
                      <td className="px-s-1 py-s-1.5">
                        <input type="time" value={h.apmidi_ouverture} disabled={h.apmidi_ferme}
                          onChange={e => update('apmidi_ouverture', e.target.value)}
                          className="rounded border border-line bg-surface px-s-1.5 py-s-0.5 text-micro disabled:opacity-40 focus:outline-none w-20" />
                      </td>
                      <td className="px-s-1 py-s-1.5 text-micro text-ink-3">→</td>
                      <td className="px-s-1 py-s-1.5">
                        <input type="time" value={h.apmidi_fermeture} disabled={h.apmidi_ferme}
                          onChange={e => update('apmidi_fermeture', e.target.value)}
                          className="rounded border border-line bg-surface px-s-1.5 py-s-0.5 text-micro disabled:opacity-40 focus:outline-none w-20" />
                      </td>
                      <td className="px-s-2 py-s-1.5">
                        <label className="flex items-center gap-s-1 text-micro text-ink-3 cursor-pointer">
                          <input type="checkbox" checked={h.matin_ferme && h.apmidi_ferme}
                            onChange={e => { update('matin_ferme', e.target.checked); update('apmidi_ferme', e.target.checked) }}
                            className="h-3.5 w-3.5 rounded accent-primary" />
                          Fermé
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-s-3">
            <Button size="sm" variant="ghost" leftIcon={<Copy className="h-4 w-4" />} onClick={copyToAll}>
              Copier vers jours ouvrables
            </Button>
            <label className="flex items-center gap-s-2 text-small text-ink-2 cursor-pointer">
              <input type="checkbox" checked={fermeJoursFeries} onChange={e => setFermeJoursFeries(e.target.checked)}
                className="h-4 w-4 rounded accent-primary" />
              Fermé les jours fériés sénégalais
            </label>
            <div className="flex-1" />
            <Button size="sm" variant="primary" leftIcon={<Check className="h-4 w-4" />}
              onClick={saveHoraires} loading={savingHoraires}>
              Enregistrer les horaires
            </Button>
          </div>
        </div>
      </Section>

      {/* 3 ─ Statut de service ──────────────────────────────────────────────── */}
      <Section title="Statut de service" icon={<Bell className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 p-s-4">
            <div>
              <p className="font-semibold text-ink">Pharmacie {enService ? 'en service' : 'hors service'}</p>
              <p className="text-micro text-ink-3">Visible par les patients dans l'application</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={enService} onChange={e => setEnService(e.target.checked)} className="sr-only peer" />
              <div className="h-6 w-11 rounded-full bg-ink-3 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          {!enService && (
            <div className="flex flex-col gap-s-2">
              <label className="text-small font-semibold text-ink">Message de fermeture (affiché aux patients)</label>
              <input type="text" value={messageFermeture} onChange={e => setMessageFermeture(e.target.value)}
                placeholder="Ex : Fermeture pour rénovation jusqu'au 15 janvier"
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-s-3">
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Fermeture programmée — début</label>
              <input type="datetime-local" value={fermeDebut} onChange={e => setFermeDebut(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">Fin</label>
              <input type="datetime-local" value={fermeFin} onChange={e => setFermeFin(e.target.value)}
                className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          {fermeDebut && fermeFin && (
            <p className="text-micro text-ink-3">
              La pharmacie passera automatiquement hors service le {format(parseISO(fermeDebut), 'dd/MM/yyyy HH:mm', { locale: fr })} et reprendra le {format(parseISO(fermeFin), 'dd/MM/yyyy HH:mm', { locale: fr })}.
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" leftIcon={<Check className="h-4 w-4" />} onClick={saveService} loading={savingService}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Section>

      {/* 4 ─ Mon équipe ─────────────────────────────────────────────────────── */}
      <Section title="Mon équipe" icon={<Users className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-4">
          {loadingTeam ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : (
            <div className="flex flex-col gap-s-2">
              {team.map(m => (
                <div key={m.id} className={`flex items-center gap-s-3 rounded-lg border border-line p-s-3 ${!m.actif ? 'opacity-50' : ''}`}>
                  <div className="h-9 w-9 rounded-full bg-surface-2 overflow-hidden flex items-center justify-center">
                    {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" /> :
                      <span className="text-small font-semibold text-ink-3">{m.profile?.full_name?.[0] ?? '?'}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-small font-semibold text-ink">{m.profile?.full_name ?? m.pharmacien_id}</p>
                    <p className="text-micro text-ink-3 capitalize">{m.role} {!m.actif && '· Désactivé'}</p>
                  </div>
                  {m.actif && m.role !== 'responsable' && profile?.id !== m.pharmacien_id && (
                    <button onClick={() => disableMember(m.id)}
                      className="text-micro text-red-500 hover:text-red-700 rounded px-s-2 py-s-1 hover:bg-red-50">
                      Désactiver
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button size="sm" variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowInvite(true)}>
            Ajouter un membre
          </Button>
        </div>
      </Section>

      {/* 5 ─ Paramètres financiers ──────────────────────────────────────────── */}
      <Section title="Paramètres financiers" icon={<CreditCard className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-5">
          {/* Commission (read-only) */}
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2/50 p-s-3">
            <div>
              <p className="text-small font-semibold text-ink">Taux de commission plateforme</p>
              <p className="text-micro text-ink-3">Défini par l'administration — non modifiable</p>
            </div>
            <span className="rounded-full bg-primary/10 px-s-3 py-s-1 text-small font-bold text-primary">
              {pharmaData?.commission_taux ?? '—'} %
            </span>
          </div>

          {/* Modes paiement */}
          <div>
            <p className="mb-s-2 text-small font-semibold text-ink">Modes de paiement acceptés</p>
            <div className="flex flex-wrap gap-s-2">
              {MODES_PAIEMENT_ALL.map(m => (
                <label key={m} className="flex items-center gap-s-2 cursor-pointer rounded-lg border border-line bg-surface px-s-3 py-s-2 text-small hover:bg-surface-2">
                  <input type="checkbox" checked={modes.includes(m)} onChange={() => setModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                    className="h-4 w-4 rounded accent-primary" />
                  {m}
                </label>
              ))}
            </div>
            <div className="mt-s-3 flex justify-end">
              <Button size="sm" variant="primary" onClick={saveModes} loading={savingModes} leftIcon={<Check className="h-4 w-4" />}>
                Enregistrer
              </Button>
            </div>
          </div>

          {/* Stripe */}
          <div className="flex items-center justify-between rounded-lg border border-line p-s-3">
            <div>
              <p className="text-small font-semibold text-ink">Stripe Connect</p>
              <p className="text-micro text-ink-3">
                {pharmaData?.stripe_account_id ? `Connecté — ${pharmaData.stripe_account_id}` : 'Non connecté'}
              </p>
            </div>
            {!pharmaData?.stripe_account_id ? (
              <Button size="sm" variant="primary" leftIcon={<CreditCard className="h-4 w-4" />}
                onClick={async () => {
                  const { data } = await supabase.functions.invoke('stripe-connect-oauth', { body: { pharmacie_id: pharmacie?.id } })
                  if (data?.url) window.open(data.url, '_blank')
                }}>
                Connecter Stripe
              </Button>
            ) : (
              <span className="flex items-center gap-s-1 text-small text-green-600 font-medium">
                <Check className="h-4 w-4" /> Connecté
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* 6 ─ Autorisation & conformité ──────────────────────────────────────── */}
      <Section title="Autorisation & conformité" icon={<ShieldAlert className="h-5 w-5" />}>
        <div className="flex flex-col gap-s-4">
          {joursRenouvellement !== null && joursRenouvellement < 60 && (
            <div className="flex items-start gap-s-3 rounded-lg border border-amber-300 bg-amber-50 p-s-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-small text-amber-800">
                Votre autorisation expire dans <strong>{joursRenouvellement} jour(s)</strong>. Contactez le MSAS pour le renouvellement.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-s-4">
            {[
              ['N° autorisation MSAS', pharmaData?.numero_autorisation],
              ['Date d\'autorisation', pharmaData?.date_autorisation ? format(parseISO(pharmaData.date_autorisation), 'dd/MM/yyyy', { locale: fr }) : '—'],
              ['Date de renouvellement', pharmaData?.date_renouvellement_autorisation ? format(parseISO(pharmaData.date_renouvellement_autorisation), 'dd/MM/yyyy', { locale: fr }) : '—'],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-micro text-ink-3">{label}</p>
                <p className="text-small font-medium text-ink">{val ?? '—'}</p>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" leftIcon={<Edit className="h-4 w-4" />}
            onClick={() => { setNewNumeroAuto(pharmaData?.numero_autorisation ?? ''); setShowAutorisationModal(true) }}>
            Demander une modification du n° autorisation
          </Button>
        </div>
      </Section>

      {/* 7 ─ Sécurité du compte ─────────────────────────────────────────────── */}
      <Section title="Sécurité du compte" icon={<Lock className="h-5 w-5" />} defaultOpen={false}>
        <div className="flex flex-col gap-s-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink text-small">Mot de passe</p>
              <p className="text-micro text-ink-3">Modifiez votre mot de passe de connexion</p>
            </div>
            <Button size="sm" variant="secondary" leftIcon={<Lock className="h-4 w-4" />} onClick={() => setShowPwdModal(true)}>
              Changer
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink text-small">Double authentification (TOTP)</p>
              <p className="text-micro text-ink-3">
                {mfaFactors.length > 0 ? `Activée — ${mfaFactors.length} facteur(s)` : 'Désactivée'}
              </p>
            </div>
            {mfaFactors.length === 0 ? (
              <Button size="sm" variant="secondary" leftIcon={<Smartphone className="h-4 w-4" />}
                onClick={startMfaEnroll} loading={enrollingMfa}>
                Activer 2FA
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => unenrollMfa(mfaFactors[0].id)}>
                Désactiver 2FA
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Inviter membre */}
      <Modal open={showInvite} onOpenChange={open => { if (!open) setShowInvite(false) }} title="Inviter un membre" size="sm">
        <div className="flex flex-col gap-s-4">
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} autoFocus
              placeholder="pharmacien@exemple.com"
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Rôle</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as TeamMember['role'])}
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="adjoint">Adjoint</option>
              <option value="preparateur">Préparateur</option>
            </select>
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Annuler</Button>
            <Button variant="primary" onClick={inviteMember} loading={inviting} leftIcon={<Plus className="h-4 w-4" />}>
              Envoyer l'invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Autorisation change request */}
      <Modal open={showAutorisationModal} onOpenChange={open => { if (!open) setShowAutorisationModal(false) }}
        title="Demande de modification" size="sm">
        <div className="flex flex-col gap-s-4">
          <div className="flex items-start gap-s-2 rounded-lg border border-amber-200 bg-amber-50 p-s-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-micro text-amber-800">Cette demande sera soumise à validation par l'administration.</p>
          </div>
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Nouveau numéro d'autorisation</label>
            <input type="text" value={newNumeroAuto} onChange={e => setNewNumeroAuto(e.target.value)} autoFocus
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowAutorisationModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={sendAutorisationRequest} loading={sendingAutoRequest}>Envoyer la demande</Button>
          </div>
        </div>
      </Modal>

      {/* Mot de passe */}
      <Modal open={showPwdModal} onOpenChange={open => { if (!open) setShowPwdModal(false) }} title="Changer le mot de passe" size="sm">
        <div className="flex flex-col gap-s-4">
          {[
            { label: 'Nouveau mot de passe', value: pwd, set: setPwd },
            { label: 'Confirmer le mot de passe', value: pwdConfirm, set: setPwdConfirm },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-s-1">
              <label className="text-small font-semibold text-ink">{f.label}</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={f.value} onChange={e => f.set(e.target.value)}
                  className="w-full rounded border border-line bg-surface px-s-3 py-s-2 pr-s-10 text-small text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={() => setShowPwd(v => !v)}
                  className="absolute right-s-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowPwdModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={changePassword} loading={savingPwd} leftIcon={<Check className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>

      {/* MFA */}
      <Modal open={showMfa} onOpenChange={open => { if (!open) setShowMfa(false) }} title="Activer la double authentification" size="sm">
        <div className="flex flex-col gap-s-4">
          <p className="text-small text-ink-2">Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy…).</p>
          {mfaQr && <img src={mfaQr} alt="QR Code 2FA" className="mx-auto h-40 w-40 rounded border border-line" />}
          <div className="flex flex-col gap-s-1">
            <label className="text-small font-semibold text-ink">Code de vérification</label>
            <input type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value)}
              placeholder="123456" autoFocus
              className="rounded border border-line bg-surface px-s-3 py-s-2 text-center text-body font-mono tracking-widest text-ink focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex justify-end gap-s-2">
            <Button variant="ghost" onClick={() => setShowMfa(false)}>Annuler</Button>
            <Button variant="primary" onClick={verifyMfa} disabled={mfaCode.length < 6} leftIcon={<Check className="h-4 w-4" />}>
              Vérifier et activer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
