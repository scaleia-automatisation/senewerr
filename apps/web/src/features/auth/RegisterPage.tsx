import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, User, Phone, Building2, ShieldCheck, Cross } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }     from '@/components/ui/Button'
import { Input }      from '@/components/ui/Input'
import { Select }     from '@/components/ui/Select'
import { toast }      from 'sonner'
import { supabase }   from '@/lib/supabase'
import { cn }         from '@/lib/utils'

// ──────────────────────────────────────────────────────────
// Rôles disponibles à l'inscription
// ──────────────────────────────────────────────────────────
const ROLES = [
  {
    value: 'patient',
    label: 'Patient',
    description: 'Gérez vos rendez-vous, ordonnances et carnet de santé',
    icon: User,
    color: 'bg-accent-soft text-accent',
  },
  {
    value: 'professional',
    label: 'Professionnel de santé',
    description: 'Médecin, infirmier, pharmacien indépendant…',
    icon: Cross,
    color: 'bg-primary-soft text-primary',
  },
  {
    value: 'establishment_admin',
    label: 'Établissement de santé',
    description: 'Clinique, cabinet, hôpital, centre de santé',
    icon: Building2,
    color: 'bg-navy-soft text-navy',
  },
  {
    value: 'pharmacy_admin',
    label: 'Pharmacie',
    description: 'Gérez votre stock, réservations et ordonnances',
    icon: ShieldCheck,
    color: 'bg-accent-soft text-accent',
  },
  {
    value: 'mutual_admin',
    label: 'Mutuelle / Assurance',
    description: 'Gérez vos assurés et prises en charge',
    icon: ShieldCheck,
    color: 'bg-primary-soft text-primary',
  },
] as const

type RoleValue = typeof ROLES[number]['value']

// ──────────────────────────────────────────────────────────
// Schemas Zod
// ──────────────────────────────────────────────────────────
const passwordSchema = z.string()
  .min(10, 'Minimum 10 caractères')
  .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
  .regex(/[a-zA-Z]/, 'Doit contenir au moins une lettre')

const step2Schema = z.object({
  first_name:     z.string().min(2, 'Prénom requis'),
  last_name:      z.string().min(2, 'Nom requis'),
  phone:          z.string().min(7, 'Téléphone invalide'),
  email:          z.string().email('Email invalide'),
  password:       passwordSchema,
  password_confirm: z.string(),
  date_of_birth:  z.string().optional(),
  consent_cgu:    z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les CGU' }) }),
  consent_health: z.literal(true, { errorMap: () => ({ message: 'Consentement au traitement des données de santé requis' }) }),
  consent_marketing: z.boolean().optional(),
}).refine(d => d.password === d.password_confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirm'],
})

const step3ProfessionalSchema = z.object({
  professional_type: z.string().min(1, 'Requis'),
  specialty:         z.string().optional(),
  order_number:      z.string().optional(),
})

const step3OrgSchema = z.object({
  org_name:    z.string().min(2, 'Nom requis'),
  org_address: z.string().optional(),
  ninea:       z.string().optional(),
  reg_number:  z.string().optional(),
})

type Step2Form = z.infer<typeof step2Schema>
type Step3ProfForm = z.infer<typeof step3ProfessionalSchema>
type Step3OrgForm = z.infer<typeof step3OrgSchema>

const PROFESSIONAL_TYPES = [
  { value: 'doctor',        label: 'Médecin' },
  { value: 'nurse',         label: 'Infirmier(e)' },
  { value: 'pharmacist',    label: 'Pharmacien(ne)' },
  { value: 'dentist',       label: 'Dentiste' },
  { value: 'midwife',       label: 'Sage-femme' },
  { value: 'physiotherapist', label: 'Kinésithérapeute' },
  { value: 'other',         label: 'Autre' },
]

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (raw.trimStart().startsWith('+')) return raw.replace(/\s/g, '')
  if (digits.length === 9) return `+221${digits}`
  if (digits.length === 12 && digits.startsWith('221')) return `+${digits}`
  return raw.trim()
}

function isOrgRole(r: RoleValue) {
  return ['establishment_admin', 'pharmacy_admin', 'mutual_admin'].includes(r)
}

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep]     = useState<1 | 2 | 3>(1)
  const [role, setRole]     = useState<RoleValue | null>(null)
  const [showPwd, setShowPwd]    = useState(false)
  const [showConf, setShowConf]  = useState(false)
  const [step2Data, setStep2Data] = useState<Step2Form | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Step 2 form ──────────────────────────────────────────
  const { register: r2, handleSubmit: hs2, setValue: sv2, watch: w2, formState: { errors: e2 } } =
    useForm<Step2Form>({ resolver: zodResolver(step2Schema) })

  // ── Step 3 professional form ─────────────────────────────
  const { register: r3p, handleSubmit: hs3p, setValue: sv3p, watch: w3p, formState: { errors: e3p } } =
    useForm<Step3ProfForm>({ resolver: zodResolver(step3ProfessionalSchema) })

  // ── Step 3 org form ──────────────────────────────────────
  const { register: r3o, handleSubmit: hs3o, formState: { errors: e3o } } =
    useForm<Step3OrgForm>({ resolver: zodResolver(step3OrgSchema) })

  // ── Submit final ─────────────────────────────────────────
  const finalize = async (step3?: Step3ProfForm | Step3OrgForm) => {
    if (!role || !step2Data) return
    setSubmitting(true)

    const phone = normalizePhone(step2Data.phone)

    const { error } = await supabase.auth.signUp({
      email:    step2Data.email,
      password: step2Data.password,
      phone,
      options: {
        data: {
          role,
          first_name: step2Data.first_name,
          last_name:  step2Data.last_name,
          phone,
          date_of_birth: step2Data.date_of_birth ?? null,
          consent_cgu_at:    new Date().toISOString(),
          consent_health_at: new Date().toISOString(),
          consent_marketing: step2Data.consent_marketing ?? false,
          ...(step3 ?? {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setSubmitting(false)

    if (error) {
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already been registered')) {
        toast.error('Un compte existe déjà avec cet email.')
      } else {
        toast.error('Erreur lors de l\'inscription. Réessayez.')
      }
      return
    }

    toast.success('Un email de confirmation vous a été envoyé !')
    navigate('/auth/verification-email', { state: { email: step2Data.email } })
  }

  const onStep2 = (data: Step2Form) => {
    setStep2Data(data)
    if (role === 'patient') {
      finalize()
    } else {
      setStep(3)
    }
  }

  const onStep3Prof = (data: Step3ProfForm) => finalize(data)
  const onStep3Org  = (data: Step3OrgForm)  => finalize(data)

  // ── Stepper indicator ─────────────────────────────────────
  const totalSteps = role === 'patient' ? 2 : 3
  const steps = ['Profil', 'Informations', ...(totalSteps === 3 ? ['Activité'] : [])]

  return (
    <AuthLayout
      title={step === 1 ? 'Créer un compte' : step === 2 ? 'Vos informations' : 'Votre activité'}
      subtitle={step === 1 ? 'Rejoignez Séne Wérr gratuitement' : undefined}
      footer={
        step === 1 ? (
          <>
            Déjà un compte ?{' '}
            <Link to="/auth/connexion" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </>
        ) : undefined
      }
    >
      {/* Stepper */}
      {role && (
        <div className="mb-s-5 flex items-center gap-s-2" aria-label="Étapes d'inscription">
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-s-1">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-pill text-micro font-semibold',
                i + 1 < step  ? 'bg-primary text-primary-fg' :
                i + 1 === step ? 'border-2 border-primary text-primary' :
                                 'border border-line text-ink-3',
              )}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span className={cn('text-micro', i + 1 === step ? 'text-ink font-medium' : 'text-ink-3')}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 1 : choix du rôle ── */}
      {step === 1 && (
        <div className="flex flex-col gap-s-3" role="list" aria-label="Choisissez votre profil">
          {ROLES.map(r => {
            const Icon = r.icon
            return (
              <button
                key={r.value}
                type="button"
                role="listitem"
                onClick={() => { setRole(r.value); setStep(2) }}
                className="flex items-center gap-s-3 rounded-md border border-line bg-surface p-s-4 text-left transition hover:border-primary hover:shadow-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={r.label}
              >
                <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md', r.color)}>
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-body font-medium text-ink">{r.label}</p>
                  <p className="text-small text-ink-3">{r.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── STEP 2 : informations communes ── */}
      {step === 2 && role && (
        <form onSubmit={hs2(onStep2)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-s-3">
            <Input label="Prénom" type="text" autoComplete="given-name" placeholder="Aminata"
              leftIcon={<User className="w-4 h-4" />} error={e2.first_name?.message} required
              {...r2('first_name')} />
            <Input label="Nom" type="text" autoComplete="family-name" placeholder="Diallo"
              error={e2.last_name?.message} required {...r2('last_name')} />
          </div>

          <Input label="Téléphone" type="tel" autoComplete="tel" placeholder="77 123 45 67"
            leftIcon={<Phone className="w-4 h-4" />}
            hint="+221 si Sénégal (ex : 77 123 45 67)"
            error={e2.phone?.message} required {...r2('phone')} />

          <Input label="Email" type="email" autoComplete="email" placeholder="vous@exemple.com"
            leftIcon={<Mail className="w-4 h-4" />} error={e2.email?.message} required
            {...r2('email')} />

          {role === 'patient' && (
            <Input label="Date de naissance" type="date" autoComplete="bday"
              error={e2.date_of_birth?.message} {...r2('date_of_birth')} />
          )}

          <Input label="Mot de passe" type={showPwd ? 'text' : 'password'}
            autoComplete="new-password" placeholder="Minimum 10 caractères"
            hint="Au moins 10 caractères, 1 lettre et 1 chiffre"
            rightIcon={
              <button type="button" onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Masquer' : 'Afficher'}>
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={e2.password?.message} required {...r2('password')} />

          <Input label="Confirmer le mot de passe" type={showConf ? 'text' : 'password'}
            autoComplete="new-password" placeholder="••••••••"
            rightIcon={
              <button type="button" onClick={() => setShowConf(v => !v)}
                aria-label={showConf ? 'Masquer' : 'Afficher'}>
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={e2.password_confirm?.message} required {...r2('password_confirm')} />

          {/* Consentements */}
          <fieldset className="flex flex-col gap-s-3 rounded-md border border-line p-s-4">
            <legend className="px-s-1 text-small font-medium text-ink">Consentements</legend>

            <label className="flex items-start gap-s-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary"
                aria-describedby="cgu-desc"
                {...r2('consent_cgu')} />
              <span id="cgu-desc" className="text-small text-ink-2">
                J'accepte les{' '}
                <Link to="/legal/cgu" target="_blank" className="text-primary hover:underline">
                  Conditions Générales d'Utilisation
                </Link>{' '}
                <span className="text-status-danger">*</span>
              </span>
            </label>
            {e2.consent_cgu && (
              <p className="text-small text-status-danger ml-6" role="alert">{e2.consent_cgu.message}</p>
            )}

            <label className="flex items-start gap-s-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary"
                aria-describedby="health-desc"
                {...r2('consent_health')} />
              <span id="health-desc" className="text-small text-ink-2">
                J'autorise Séne Wérr à traiter mes données de santé pour la gestion de mon dossier médical{' '}
                <span className="text-status-danger">*</span>
              </span>
            </label>
            {e2.consent_health && (
              <p className="text-small text-status-danger ml-6" role="alert">{e2.consent_health.message}</p>
            )}

            <label className="flex items-start gap-s-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary"
                {...r2('consent_marketing')} />
              <span className="text-small text-ink-2">
                J'accepte de recevoir des communications marketing et des actualités santé (optionnel)
              </span>
            </label>
          </fieldset>

          <div className="flex gap-s-3 pt-s-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1">
              Retour
            </Button>
            <Button type="submit" loading={submitting} className="flex-1">
              {role === 'patient' ? 'Créer mon compte' : 'Continuer'}
            </Button>
          </div>
        </form>
      )}

      {/* ── STEP 3a : professionnel ── */}
      {step === 3 && role === 'professional' && (
        <form onSubmit={hs3p(onStep3Prof)} className="flex flex-col gap-4" noValidate>
          <Select
            label="Type de professionnel"
            options={PROFESSIONAL_TYPES}
            value={w3p('professional_type') ?? ''}
            onValueChange={v => sv3p('professional_type', v, { shouldValidate: true })}
            placeholder="Sélectionnez"
            error={e3p.professional_type?.message}
          />

          <Input label="Spécialité (optionnel)" type="text" placeholder="Pédiatrie, Cardiologie…"
            {...r3p('specialty')} />
          <Input label="N° Ordre / Licence" type="text" placeholder="N° d'enregistrement officiel"
            {...r3p('order_number')} />

          <div className="flex gap-s-3 pt-s-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1">Retour</Button>
            <Button type="submit" loading={submitting} className="flex-1">Créer mon compte</Button>
          </div>
        </form>
      )}

      {/* ── STEP 3b : organisation ── */}
      {step === 3 && isOrgRole(role!) && (
        <form onSubmit={hs3o(onStep3Org)} className="flex flex-col gap-4" noValidate>
          <Input label="Nom de l'organisation" type="text" placeholder="Clinique du Plateau"
            error={e3o.org_name?.message} required {...r3o('org_name')} />
          <Input label="Adresse" type="text" placeholder="123 Rue des Peintres, Dakar"
            {...r3o('org_address')} />
          <Input label="NINEA (Sénégal)" type="text" placeholder="7 chiffres"
            {...r3o('ninea')} />
          <Input label="N° Enregistrement / Licence" type="text"
            {...r3o('reg_number')} />

          <div className="flex gap-s-3 pt-s-2">
            <Button type="button" variant="ghost" onClick={() => setStep(2)} className="flex-1">Retour</Button>
            <Button type="submit" loading={submitting} className="flex-1">Créer mon compte</Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
