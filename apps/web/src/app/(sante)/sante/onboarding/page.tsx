'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Building2, Stethoscope, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'

type SanteType = 'professionnel' | 'etablissement'

const PROFESSIONAL_TYPES = [
  { value: 'medecin_generaliste',  label: 'Médecin généraliste' },
  { value: 'medecin_specialiste',  label: 'Médecin spécialiste' },
  { value: 'chirurgien_dentiste',  label: 'Chirurgien-dentiste' },
  { value: 'sage_femme',           label: 'Sage-femme' },
  { value: 'infirmier',            label: 'Infirmier(ère)' },
  { value: 'paramedicale',         label: 'Paramédical(e)' },
  { value: 'autre',                label: 'Autre professionnel' },
]

const ESTABLISHMENT_TYPES_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
  public: [
    { value: 'case_sante',        label: 'Case de santé' },
    { value: 'poste_sante',       label: 'Poste de santé' },
    { value: 'centre_sante_cs1',  label: 'Centre de santé CS1' },
    { value: 'centre_sante_cs2',  label: 'Centre de santé CS2' },
    { value: 'hopital_eps1',      label: 'Hôpital EPS1' },
    { value: 'hopital_eps2',      label: 'Hôpital EPS2' },
    { value: 'hopital_eps3',      label: 'Hôpital EPS3' },
  ],
  prive: [
    { value: 'clinique',             label: 'Clinique' },
    { value: 'cabinet_medical',      label: 'Cabinet médical' },
    { value: 'cabinet_paramedical',  label: 'Cabinet paramédical' },
    { value: 'poste_sante_prive',    label: 'Poste de santé privé' },
    { value: 'structure_entreprise', label: "Structure d'entreprise" },
    { value: 'dispensaire_prive',    label: 'Dispensaire privé' },
  ],
  specialise: [
    { value: 'laboratoire',            label: "Laboratoire d'analyses" },
    { value: 'centre_radiologie',      label: 'Centre de radiologie' },
    { value: 'centre_sante_mentale',   label: 'Centre de santé mentale' },
    { value: 'centre_reeducation',     label: 'Centre de rééducation' },
    { value: 'centre_transfusion',     label: 'Centre de transfusion sanguine' },
    { value: 'autre_specialise',       label: 'Autre structure spécialisée' },
  ],
}

const REGIONS = [
  'Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Matam',
  'Tambacounda', 'Kédougou', 'Kaolack', 'Kaffrine', 'Fatick',
  'Ziguinchor', 'Sédhiou', 'Kolda', 'Louga',
]

export default function SanteOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [santeType, setSanteType] = useState<SanteType>('professionnel')

  // Professionnel fields
  const [professionalType, setProfessionalType] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [title, setTitle] = useState('')
  const [consultationFee, setConsultationFee] = useState('')
  const [addressRegion, setAddressRegion] = useState('')

  // Établissement fields
  const [establishmentCategory, setEstablishmentCategory] = useState('prive')
  const [establishmentType, setEstablishmentType] = useState('')
  const [establishmentName, setEstablishmentName] = useState('')
  const [establishmentPhone, setEstablishmentPhone] = useState('')
  const [establishmentRegion, setEstablishmentRegion] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleCategoryChange(cat: string) {
    setEstablishmentCategory(cat)
    setEstablishmentType('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (santeType === 'professionnel' && !professionalType) {
      setError('Veuillez sélectionner votre type de profession.')
      return
    }
    if (santeType === 'etablissement') {
      if (!establishmentName.trim()) { setError('Le nom de l\'établissement est requis.'); return }
      if (!establishmentType) { setError('Veuillez sélectionner le type d\'établissement.'); return }
      if (!establishmentRegion) { setError('Veuillez sélectionner votre région.'); return }
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expirée. Reconnectez-vous.'); setLoading(false); return }

    if (santeType === 'professionnel') {
      const { error: err } = await (supabase.from('professionnels') as unknown as {
        insert: (v: unknown) => Promise<{ error: { message: string } | null }>
      }).insert({
        profile_id: user.id,
        professional_type: professionalType,
        specialty: specialty.trim() || null,
        title: title.trim() || null,
        consultation_fee_fcfa: consultationFee ? parseInt(consultationFee, 10) : null,
        address_region: addressRegion || null,
        plan: 'essentiel',
        teleconsultation_enabled: false,
        home_visit_enabled: false,
      })
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await (supabase.from('etablissements') as unknown as {
        insert: (v: unknown) => Promise<{ error: { message: string } | null }>
      }).insert({
        profile_id: user.id,
        name: establishmentName.trim(),
        category: establishmentCategory,
        establishment_type: establishmentType,
        phone: establishmentPhone.trim() || null,
        address_region: establishmentRegion,
        plan: 'cabinet',
        emergency_available: false,
      })
      if (err) { setError(err.message); setLoading(false); return }
    }

    router.push('/sante/accueil')
    router.refresh()
  }

  const estTypes = ESTABLISHMENT_TYPES_BY_CATEGORY[establishmentCategory] ?? []
  const isSpecialist = professionalType === 'medecin_specialiste' || professionalType === 'paramedicale'

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary)] flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Compléter mon profil</h1>
          <p className="text-sm text-[var(--sw-ink-2)]">Étape {step} / 2 — quelques informations pour démarrer</p>
        </div>

        {/* Étape 1 : choix du type */}
        {step === 1 && (
          <div className="sw-card p-6 space-y-5">
            <p className="text-sm font-medium text-[var(--sw-ink)]">Vous êtes :</p>
            <div className="grid gap-3">
              {([
                { value: 'professionnel', icon: Stethoscope, title: 'Professionnel de santé indépendant', desc: 'Médecin, infirmier, sage-femme, dentiste…' },
                { value: 'etablissement', icon: Building2, title: 'Établissement de santé', desc: 'Clinique, hôpital, cabinet, laboratoire…' },
              ] as const).map(({ value, icon: Icon, title: t, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSanteType(value)}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-colors ${
                    santeType === value
                      ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]'
                      : 'border-[var(--sw-line)] hover:border-[var(--sw-primary)]'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${santeType === value ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-surface-2)]'}`}>
                    <Icon className={`w-5 h-5 ${santeType === value ? 'text-white' : 'text-[var(--sw-ink-2)]'}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${santeType === value ? 'text-[var(--sw-primary)]' : 'text-[var(--sw-ink)]'}`}>{t}</p>
                    <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">{desc}</p>
                  </div>
                  {santeType === value && <CheckCircle2 className="w-5 h-5 text-[var(--sw-primary)] ml-auto shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continuer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Étape 2 : détails */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="sw-card p-6 space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] mb-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour
            </button>

            {santeType === 'professionnel' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Profession *</label>
                  <select
                    value={professionalType}
                    onChange={e => setProfessionalType(e.target.value)}
                    className="sw-input w-full"
                    required
                  >
                    <option value="">Sélectionner…</option>
                    {PROFESSIONAL_TYPES.map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>

                {isSpecialist && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--sw-ink-2)]">Spécialité</label>
                    <input
                      type="text"
                      value={specialty}
                      onChange={e => setSpecialty(e.target.value)}
                      placeholder="Ex : Cardiologie, Kinésithérapie…"
                      className="sw-input w-full"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Titre (optionnel)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Dr., Pr., Mme…"
                    className="sw-input w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Tarif consultation (FCFA, optionnel)</label>
                  <input
                    type="number"
                    value={consultationFee}
                    onChange={e => setConsultationFee(e.target.value)}
                    placeholder="Ex : 3000"
                    min={0}
                    className="sw-input w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Région (optionnel)</label>
                  <select value={addressRegion} onChange={e => setAddressRegion(e.target.value)} className="sw-input w-full">
                    <option value="">Sélectionner…</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Nom de l&apos;établissement *</label>
                  <input
                    type="text"
                    value={establishmentName}
                    onChange={e => setEstablishmentName(e.target.value)}
                    placeholder="Ex : Clinique du Plateau"
                    className="sw-input w-full"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Secteur *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'public',    label: 'Public' },
                      { value: 'prive',     label: 'Privé' },
                      { value: 'specialise', label: 'Spécialisé' },
                    ]).map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => handleCategoryChange(cat.value)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                          establishmentCategory === cat.value
                            ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                            : 'border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Type d&apos;établissement *</label>
                  <select
                    value={establishmentType}
                    onChange={e => setEstablishmentType(e.target.value)}
                    className="sw-input w-full"
                    required
                  >
                    <option value="">Sélectionner…</option>
                    {estTypes.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Région *</label>
                  <select value={establishmentRegion} onChange={e => setEstablishmentRegion(e.target.value)} className="sw-input w-full" required>
                    <option value="">Sélectionner…</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--sw-ink-2)]">Téléphone (optionnel)</label>
                  <input
                    type="tel"
                    value={establishmentPhone}
                    onChange={e => setEstablishmentPhone(e.target.value)}
                    placeholder="+221 7X XXX XX XX"
                    className="sw-input w-full"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enregistrement…' : 'Finaliser mon profil'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
