'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  User, Stethoscope, Building2, ShoppingBag, Shield,
  ChevronLeft, ChevronRight, Eye, EyeOff, CheckCircle2,
} from 'lucide-react'
import type { ActorType } from '@/types'
import { GoogleOAuthButton } from '@/components/auth/google-oauth-button'

/* ─── Constantes ─── */

const ACTOR_OPTIONS = [
  { value: 'patient',    icon: User,        label: 'Patient',                     desc: 'Gérer ma santé et mes proches' },
  { value: 'sante',      icon: Stethoscope, label: 'Professionnel / Établissement', desc: 'Médecin, infirmier, clinique…' },
  { value: 'pharmacie',  icon: ShoppingBag, label: 'Pharmacie',                   desc: 'Gérer mon stock et mes réservations' },
  { value: 'couverture', icon: Shield,      label: 'Mutuelle / Assurance / IPM',  desc: 'Gérer les prises en charge' },
] as const

const PROFESSIONAL_TYPES = [
  { value: 'medecin_generaliste', label: 'Médecin généraliste' },
  { value: 'medecin_specialiste', label: 'Médecin spécialiste' },
  { value: 'chirurgien_dentiste', label: 'Chirurgien-dentiste' },
  { value: 'sage_femme',          label: 'Sage-femme' },
  { value: 'infirmier',           label: 'Infirmier(ère)' },
  { value: 'paramedicale',        label: 'Paramédical(e)' },
  { value: 'autre',               label: 'Autre professionnel' },
]

const ESTABLISHMENT_TYPES_BY_CAT: Record<string, { value: string; label: string }[]> = {
  public: [
    { value: 'hopital_eps1', label: 'Hôpital EPS1' },
    { value: 'hopital_eps2', label: 'Hôpital EPS2' },
    { value: 'hopital_eps3', label: 'Hôpital EPS3' },
    { value: 'centre_sante_cs1', label: 'Centre de santé CS1' },
    { value: 'centre_sante_cs2', label: 'Centre de santé CS2' },
  ],
  prive: [
    { value: 'clinique', label: 'Clinique' },
    { value: 'cabinet_medical', label: 'Cabinet médical' },
    { value: 'laboratoire', label: "Laboratoire d'analyses" },
    { value: 'centre_radiologie', label: 'Centre de radiologie' },
    { value: 'cabinet_paramedical', label: 'Cabinet paramédical' },
  ],
  specialise: [
    { value: 'centre_dialyse', label: 'Centre de dialyse' },
    { value: 'centre_oncologie', label: "Centre d'oncologie" },
    { value: 'centre_cardiologie', label: 'Centre de cardiologie' },
    { value: 'maternite', label: 'Maternité' },
  ],
}

const COVERAGE_CATEGORIES = [
  { value: 'mutuelle_communautaire', label: 'Mutuelle communautaire' },
  { value: 'msae', label: 'MSAE' },
  { value: 'mutuelle_professionnelle', label: 'Mutuelle professionnelle' },
  { value: 'ipm', label: 'IPM' },
  { value: 'assurance_privee', label: 'Assurance privée' },
]

const REGIONS = ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Matam', 'Tambacounda', 'Kédougou', 'Kaolack', 'Kaffrine', 'Fatick', 'Ziguinchor', 'Sédhiou', 'Kolda', 'Louga']

/* ─── Composants utilitaires ─── */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[var(--sw-ink-2)] mb-1">{children}</label>
}

function PasswordField({ value, onChange, placeholder = 'Mot de passe' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="sw-input w-full pr-10"
        required
        minLength={6}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sw-ink-3)] hover:text-[var(--sw-ink-2)]"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <div className="flex items-center px-3 bg-[var(--sw-surface-2)] border border-[var(--sw-line)] rounded-lg text-sm font-medium text-[var(--sw-ink-2)] shrink-0">
        🇸🇳 +221
      </div>
      <input
        type="tel"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
        placeholder="7X XXX XX XX"
        className="sw-input flex-1"
        required
        pattern="[0-9]{9}"
      />
    </div>
  )
}

/* ─── Page principale ─── */

function InscriptionPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultProfil = (searchParams.get('profil') ?? '') as ActorType | ''

  const [step, setStep]           = useState<1 | 2>(defaultProfil ? 2 : 1)
  const [actorType, setActorType] = useState<ActorType | ''>(defaultProfil)
  const [santeType, setSanteType] = useState<'professionnel' | 'etablissement'>('professionnel')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  // Champs communs
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')  // obligatoire — identifiant Supabase Auth
  const [password,  setPassword]  = useState('')

  // Patient spécifique
  const [dateNaissance, setDateNaissance] = useState('')

  // Sante professionnel
  const [professionalType, setProfessionalType] = useState('')
  const [specialty,        setSpecialty]        = useState('')
  const [licenseNumber,    setLicenseNumber]    = useState('')
  const [consultationFee,  setConsultationFee]  = useState('')
  const [region,           setRegion]           = useState('')
  const [commune,          setCommune]          = useState('')

  // Sante établissement
  const [estName,     setEstName]     = useState('')
  const [estCategory, setEstCategory] = useState('prive')
  const [estType,     setEstType]     = useState('')
  const [estPhone,    setEstPhone]    = useState('')
  const [estEmail,    setEstEmail]    = useState('')
  const [estRegion,   setEstRegion]   = useState('')
  const [respNom,     setRespNom]     = useState('')

  // Pharmacie
  const [pharmName,  setPharmName]  = useState('')
  const [pharmPharm, setPharmPharm] = useState('')
  const [pharmPhone, setPharmPhone] = useState('')
  const [pharmEmail, setPharmEmail] = useState('')
  const [pharmRegion, setPharmRegion] = useState('')
  const [pharmAdresse, setPharmAdresse] = useState('')

  // Couverture
  const [covCategory, setCovCategory] = useState('')
  const [covName,     setCovName]     = useState('')
  const [covPhone,    setCovPhone]    = useState('')
  const [covEmail,    setCovEmail]    = useState('')
  const [covRegion,   setCovRegion]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    try {
      if (actorType === 'patient') {
        if (!email) { setError('Adresse e-mail obligatoire.'); return }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName, actor_type: 'patient', phone: phone ? `+221${phone.replace(/\D/g, '')}` : null } },
        })
        if (signUpErr || !data.user) { setError(signUpErr?.message ?? 'Erreur inscription.'); return }
        if (dateNaissance) {
          await (supabase.from('patients') as unknown as { insert: (v: unknown) => Promise<unknown> }).insert({
            profile_id: data.user.id, first_name: firstName, last_name: lastName, date_of_birth: dateNaissance, status: 'verifie',
          })
        }
        router.push('/patient/accueil')

      } else if (actorType === 'sante') {
        if (santeType === 'professionnel') {
          if (!email) { setError('Adresse e-mail obligatoire.'); return }
          const { data, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { first_name: firstName, last_name: lastName, actor_type: 'sante', sante_type: 'professionnel', phone: phone ? `+221${phone.replace(/\D/g, '')}` : null } },
          })
          if (signUpErr || !data.user) { setError(signUpErr?.message ?? 'Erreur inscription.'); return }
          await (supabase.from('professionals') as unknown as { insert: (v: unknown) => Promise<unknown> }).insert({
            profile_id: data.user.id, professional_type: professionalType, specialty: specialty || null,
            license_number: licenseNumber || null, consultation_fee_fcfa: consultationFee ? parseInt(consultationFee) : null,
            address_region: region || null, address_commune: commune || null, status: 'pending',
            plan: 'essentiel', teleconsultation_enabled: false, home_visit_enabled: false,
          })
          router.push('/sante/accueil')
        } else {
          if (!estEmail) { setError('Adresse e-mail obligatoire.'); return }
          const { data, error: signUpErr } = await supabase.auth.signUp({
            email: estEmail,
            password,
            options: { data: { first_name: respNom, last_name: '', actor_type: 'sante', sante_type: 'etablissement' } },
          })
          if (signUpErr || !data.user) { setError(signUpErr?.message ?? 'Erreur inscription.'); return }
          await (supabase.from('establishments') as unknown as { insert: (v: unknown) => Promise<unknown> }).insert({
            profile_id: data.user.id, name: estName, category: estCategory, establishment_type: estType,
            address_region: estRegion || null, phone: estPhone || null, email: estEmail || null,
            responsible_name: respNom || null, status: 'pending',
          })
          router.push('/sante/accueil')
        }

      } else if (actorType === 'pharmacie') {
        if (!pharmEmail) { setError('Adresse e-mail obligatoire.'); return }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: pharmEmail, password,
          options: { data: { first_name: pharmPharm, last_name: '', actor_type: 'pharmacie' } },
        })
        if (signUpErr || !data.user) { setError(signUpErr?.message ?? 'Erreur inscription.'); return }
        await (supabase.from('pharmacies') as unknown as { insert: (v: unknown) => Promise<unknown> }).insert({
          profile_id: data.user.id, name: pharmName, pharmacist_name: pharmPharm,
          phone: pharmPhone || null, email: pharmEmail || null,
          address_region: pharmRegion || null, address_text: pharmAdresse || null, status: 'pending',
        })
        router.push('/pharmacie/accueil')

      } else if (actorType === 'couverture') {
        if (!covEmail) { setError('Adresse e-mail obligatoire.'); return }
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: covEmail, password,
          options: { data: { first_name: covName, last_name: '', actor_type: 'couverture' } },
        })
        if (signUpErr || !data.user) { setError(signUpErr?.message ?? 'Erreur inscription.'); return }
        await (supabase.from('coverage_orgs') as unknown as { insert: (v: unknown) => Promise<unknown> }).insert({
          profile_id: data.user.id, name: covName, category: covCategory,
          phone: covPhone || null, email: covEmail || null,
          address_region: covRegion || null, status: 'pending',
        })
        router.push('/couverture/accueil')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="sw-card p-8 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[var(--sw-success)] mx-auto" />
          <h2 className="text-lg font-bold text-[var(--sw-ink)]">Compte créé !</h2>
          <p className="text-sm text-[var(--sw-ink-2)]">Votre dossier est en attente de validation.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Logo */}
      <div className="text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary)] flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-sm">SW</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Créer un compte</h1>
        <p className="text-sm text-[var(--sw-ink-2)]">Séné Wérr — votre santé connectée</p>
      </div>

      {/* Step 1: Choisir le type de compte */}
      {step === 1 && (
        <div className="sw-card p-6 space-y-4">
          <GoogleOAuthButton label="S'inscrire avec Google" />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--sw-line)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-[var(--sw-surface)] px-2 text-[var(--sw-ink-3)]">ou créer avec e-mail</span>
            </div>
          </div>

          <p className="text-sm font-medium text-[var(--sw-ink)]">Vous êtes…</p>
          <div className="grid grid-cols-2 gap-3">
            {ACTOR_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setActorType(value as ActorType); setStep(2) }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--sw-line)] hover:border-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)] transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[var(--sw-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{label}</p>
                  <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--sw-ink-2)]">
            Déjà un compte ?{' '}
            <Link href="/connexion" className="text-[var(--sw-primary)] font-medium hover:underline">Se connecter</Link>
          </p>
        </div>
      )}

      {/* Step 2: Formulaire selon le type */}
      {step === 2 && actorType && (
        <form onSubmit={handleSubmit} className="sw-card p-6 space-y-4">
          {/* Back + titre */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="p-1.5 rounded-lg hover:bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-[var(--sw-ink)]">
                {actorType === 'patient' && 'Compte patient'}
                {actorType === 'sante' && (santeType === 'professionnel' ? 'Professionnel de santé' : 'Établissement de santé')}
                {actorType === 'pharmacie' && 'Pharmacie'}
                {actorType === 'couverture' && 'Organisme de couverture'}
              </h2>
              <p className="text-xs text-[var(--sw-ink-3)]">Renseignez vos informations</p>
            </div>
          </div>

          {/* ── SANTE : sous-type selector ── */}
          {actorType === 'sante' && (
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'professionnel', icon: Stethoscope, label: 'Professionnel' },
                { value: 'etablissement', icon: Building2,   label: 'Établissement' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSanteType(value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    santeType === value
                      ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                      : 'border-[var(--sw-line)] text-[var(--sw-ink-2)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* ── PATIENT ── */}
          {actorType === 'patient' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prénom *</Label>
                  <input className="sw-input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Fatou" required />
                </div>
                <div>
                  <Label>Nom *</Label>
                  <input className="sw-input w-full" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Diallo" required />
                </div>
              </div>
              <div>
                <Label>Adresse e-mail *</Label>
                <input type="email" className="sw-input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="fatou@email.com" required />
              </div>
              <div>
                <Label>Téléphone (facultatif)</Label>
                <PhoneField value={phone} onChange={setPhone} />
              </div>
              <div>
                <Label>Date de naissance *</Label>
                <input type="date" className="sw-input w-full" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} required max={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <PasswordField value={password} onChange={setPassword} />
              </div>
            </>
          )}

          {/* ── SANTE PROFESSIONNEL ── */}
          {actorType === 'sante' && santeType === 'professionnel' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prénom *</Label>
                  <input className="sw-input w-full" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Moussa" required />
                </div>
                <div>
                  <Label>Nom *</Label>
                  <input className="sw-input w-full" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Fall" required />
                </div>
              </div>
              <div>
                <Label>Adresse e-mail *</Label>
                <input type="email" className="sw-input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="dr.fall@cabinet.sn" required />
              </div>
              <div>
                <Label>Téléphone (facultatif)</Label>
                <PhoneField value={phone} onChange={setPhone} />
              </div>
              <div>
                <Label>Profession *</Label>
                <select className="sw-input w-full" value={professionalType} onChange={e => setProfessionalType(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {PROFESSIONAL_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </select>
              </div>
              {(professionalType === 'medecin_specialiste' || professionalType === 'paramedicale') && (
                <div>
                  <Label>Spécialité</Label>
                  <input className="sw-input w-full" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Cardiologie, Kinésithérapie…" />
                </div>
              )}
              <div>
                <Label>Numéro d&apos;identification professionnelle</Label>
                <input className="sw-input w-full" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="N° Ordre des médecins…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Région d&apos;exercice</Label>
                  <select className="sw-input w-full" value={region} onChange={e => setRegion(e.target.value)}>
                    <option value="">— Région —</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Commune</Label>
                  <input className="sw-input w-full" value={commune} onChange={e => setCommune(e.target.value)} placeholder="Plateau, Almadies…" />
                </div>
              </div>
              <div>
                <Label>Tarif de consultation (FCFA)</Label>
                <input type="number" className="sw-input w-full" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} placeholder="5000" min={0} />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <PasswordField value={password} onChange={setPassword} />
              </div>
              <div className="px-3 py-2.5 bg-[var(--sw-warning-bg)] rounded-lg text-xs text-[var(--sw-warning)]">
                Votre compte sera en <strong>attente de vérification</strong> jusqu&apos;à la validation par notre équipe.
              </div>
            </>
          )}

          {/* ── SANTE ÉTABLISSEMENT ── */}
          {actorType === 'sante' && santeType === 'etablissement' && (
            <>
              <div>
                <Label>Nom de l&apos;établissement *</Label>
                <input className="sw-input w-full" value={estName} onChange={e => setEstName(e.target.value)} placeholder="Clinique Pasteur" required />
              </div>
              <div>
                <Label>Catégorie *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['public', 'prive', 'specialise'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setEstCategory(cat); setEstType('') }}
                      className={`py-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        estCategory === cat
                          ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                          : 'border-[var(--sw-line)] text-[var(--sw-ink-2)]'
                      }`}
                    >
                      {cat === 'prive' ? 'Privé' : cat === 'specialise' ? 'Spécialisé' : 'Public'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Type d&apos;établissement *</Label>
                <select className="sw-input w-full" value={estType} onChange={e => setEstType(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {(ESTABLISHMENT_TYPES_BY_CAT[estCategory] ?? []).map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail *</Label>
                  <input type="email" className="sw-input w-full" value={estEmail} onChange={e => setEstEmail(e.target.value)} placeholder="contact@etab.sn" required />
                </div>
                <div>
                  <Label>Téléphone (facultatif)</Label>
                  <input type="tel" className="sw-input w-full" value={estPhone} onChange={e => setEstPhone(e.target.value)} placeholder="338 XX XX XX" />
                </div>
              </div>
              <div>
                <Label>Région *</Label>
                <select className="sw-input w-full" value={estRegion} onChange={e => setEstRegion(e.target.value)} required>
                  <option value="">— Région —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label>Nom du responsable *</Label>
                <input className="sw-input w-full" value={respNom} onChange={e => setRespNom(e.target.value)} placeholder="Dr. Aminata Ndiaye" required />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <PasswordField value={password} onChange={setPassword} />
              </div>
              <div className="px-3 py-2.5 bg-[var(--sw-warning-bg)] rounded-lg text-xs text-[var(--sw-warning)]">
                Votre dossier sera examiné par notre équipe avant activation.
              </div>
            </>
          )}

          {/* ── PHARMACIE ── */}
          {actorType === 'pharmacie' && (
            <>
              <div>
                <Label>Nom de la pharmacie *</Label>
                <input className="sw-input w-full" value={pharmName} onChange={e => setPharmName(e.target.value)} placeholder="Pharmacie du Plateau" required />
              </div>
              <div>
                <Label>Pharmacien(ne) responsable *</Label>
                <input className="sw-input w-full" value={pharmPharm} onChange={e => setPharmPharm(e.target.value)} placeholder="Nom complet" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail *</Label>
                  <input type="email" className="sw-input w-full" value={pharmEmail} onChange={e => setPharmEmail(e.target.value)} placeholder="contact@pharmacie.sn" required />
                </div>
                <div>
                  <Label>Téléphone (facultatif)</Label>
                  <input type="tel" className="sw-input w-full" value={pharmPhone} onChange={e => setPharmPhone(e.target.value)} placeholder="338 XX XX XX" />
                </div>
              </div>
              <div>
                <Label>Région *</Label>
                <select className="sw-input w-full" value={pharmRegion} onChange={e => setPharmRegion(e.target.value)} required>
                  <option value="">— Région —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label>Adresse complète</Label>
                <input className="sw-input w-full" value={pharmAdresse} onChange={e => setPharmAdresse(e.target.value)} placeholder="Rue de Thiong, Plateau…" />
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <PasswordField value={password} onChange={setPassword} />
              </div>
              <div className="px-3 py-2.5 bg-[var(--sw-warning-bg)] rounded-lg text-xs text-[var(--sw-warning)]">
                Le catalogue et les réservations seront activés après validation de votre compte.
              </div>
            </>
          )}

          {/* ── COUVERTURE ── */}
          {actorType === 'couverture' && (
            <>
              <div>
                <Label>Catégorie *</Label>
                <select className="sw-input w-full" value={covCategory} onChange={e => setCovCategory(e.target.value)} required>
                  <option value="">— Choisir —</option>
                  {COVERAGE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Nom de l&apos;organisme *</Label>
                <input className="sw-input w-full" value={covName} onChange={e => setCovName(e.target.value)} placeholder="Mutuelle de Santé des Enseignants" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail *</Label>
                  <input type="email" className="sw-input w-full" value={covEmail} onChange={e => setCovEmail(e.target.value)} placeholder="contact@mutuelle.sn" required />
                </div>
                <div>
                  <Label>Téléphone (facultatif)</Label>
                  <input type="tel" className="sw-input w-full" value={covPhone} onChange={e => setCovPhone(e.target.value)} placeholder="338 XX XX XX" />
                </div>
              </div>
              <div>
                <Label>Région *</Label>
                <select className="sw-input w-full" value={covRegion} onChange={e => setCovRegion(e.target.value)} required>
                  <option value="">— Région —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label>Mot de passe *</Label>
                <PasswordField value={password} onChange={setPassword} />
              </div>
              <div className="px-3 py-2.5 bg-[var(--sw-warning-bg)] rounded-lg text-xs text-[var(--sw-warning)]">
                Votre dossier sera examiné par notre équipe avant activation.
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Créer mon compte <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-xs text-[var(--sw-ink-3)]">
            En créant un compte, vous acceptez nos{' '}
            <Link href="/cgu" className="text-[var(--sw-primary)] hover:underline">CGU</Link>
            {' '}et notre{' '}
            <Link href="/confidentialite" className="text-[var(--sw-primary)] hover:underline">politique de confidentialité</Link>.
          </p>
        </form>
      )}

      {step === 2 && (
        <p className="text-center text-sm text-[var(--sw-ink-2)]">
          Déjà un compte ?{' '}
          <Link href="/connexion" className="text-[var(--sw-primary)] font-medium hover:underline">Se connecter</Link>
        </p>
      )}
    </div>
  )
}

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionPageInner />
    </Suspense>
  )
}
