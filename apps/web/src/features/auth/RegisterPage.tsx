import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, User, Phone, Building2, ShieldCheck, Cross } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import { toast }  from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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
    label: 'Établissement de santé / Laboratoire',
    description: 'Hôpital, clinique, centre médical, laboratoire d\'analyses',
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

const infoSchema = z.object({
  first_name:      z.string().min(2, 'Prénom requis'),
  last_name:       z.string().min(2, 'Nom requis'),
  email:           z.string().email('Email invalide'),
  email_confirm:   z.string().email('Email invalide'),
  phone:           z.string().min(7, 'Numéro invalide'),
  password:        z.string()
    .min(10, 'Minimum 10 caractères')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
    .regex(/[a-zA-Z]/, 'Doit contenir au moins une lettre'),
  password_confirm: z.string(),
  consent_cgu: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les CGU' }) }),
}).refine(d => d.email === d.email_confirm, {
  message: 'Les emails ne correspondent pas',
  path: ['email_confirm'],
}).refine(d => d.password === d.password_confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirm'],
})

type InfoForm = z.infer<typeof infoSchema>

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (raw.trimStart().startsWith('+')) return raw.replace(/\s/g, '')
  if (digits.length === 9) return `+221${digits}`
  if (digits.length === 12 && digits.startsWith('221')) return `+${digits}`
  return raw.trim()
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep]   = useState<1 | 2>(1)
  const [role, setRole]   = useState<RoleValue | null>(null)
  const [showPwd, setShowPwd]   = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } =
    useForm<InfoForm>({ resolver: zodResolver(infoSchema) })

  const onSubmit = async (data: InfoForm) => {
    if (!role) return
    setSubmitting(true)
    const phone = normalizePhone(data.phone)

    const { error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options: {
        data: { role, first_name: data.first_name, last_name: data.last_name, phone },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setSubmitting(false)

    if (error) {
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already been registered')) {
        toast.error('Un compte existe déjà avec cet email.')
      } else {
        toast.error("Erreur lors de l'inscription. Réessayez.")
      }
      return
    }

    toast.success('Un email de confirmation vous a été envoyé !')
    navigate('/auth/verification-email', { state: { email: data.email } })
  }

  return (
    <AuthLayout
      title={step === 1 ? 'Créer un compte' : 'Vos informations'}
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
      <div className="mb-s-5 flex items-center gap-s-2">
        {['Profil', 'Informations'].map((label, i) => (
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

      {/* ── STEP 1 : choix du profil ── */}
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
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', r.color)}>
                  <Icon className="h-5 w-5" />
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

      {/* ── STEP 2 : informations de base ── */}
      {step === 2 && role && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-s-4" noValidate>
          <div className="grid grid-cols-2 gap-s-3">
            <Input label="Prénom" type="text" autoComplete="given-name" placeholder="Aminata"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.first_name?.message} required
              {...register('first_name')} />
            <Input label="Nom" type="text" autoComplete="family-name" placeholder="Diallo"
              error={errors.last_name?.message} required
              {...register('last_name')} />
          </div>

          <Input label="Email" type="email" autoComplete="email" placeholder="vous@exemple.com"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message} required
            {...register('email')} />

          <Input label="Confirmer l'email" type="email" autoComplete="off" placeholder="vous@exemple.com"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email_confirm?.message} required
            {...register('email_confirm')} />

          <Input label="Téléphone" type="tel" autoComplete="tel" placeholder="77 123 45 67"
            leftIcon={<Phone className="h-4 w-4" />}
            hint="+221 pour le Sénégal (ex : 77 123 45 67)"
            error={errors.phone?.message} required
            {...register('phone')} />

          <Input label="Mot de passe" type={showPwd ? 'text' : 'password'}
            autoComplete="new-password" placeholder="Minimum 10 caractères"
            hint="Au moins 10 caractères, 1 lettre et 1 chiffre"
            rightIcon={
              <button type="button" onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Masquer' : 'Afficher'}>
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            error={errors.password?.message} required
            {...register('password')} />

          <Input label="Confirmer le mot de passe" type={showConf ? 'text' : 'password'}
            autoComplete="new-password" placeholder="••••••••"
            rightIcon={
              <button type="button" onClick={() => setShowConf(v => !v)}
                aria-label={showConf ? 'Masquer' : 'Afficher'}>
                {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            error={errors.password_confirm?.message} required
            {...register('password_confirm')} />

          {/* CGU */}
          <label className="flex items-start gap-s-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-primary"
              {...register('consent_cgu')} />
            <span className="text-small text-ink-2">
              J'accepte les{' '}
              <Link to="/cgu" target="_blank" className="text-primary hover:underline">
                Conditions Générales d'Utilisation
              </Link>{' '}
              <span className="text-status-danger">*</span>
            </span>
          </label>
          {errors.consent_cgu && (
            <p className="text-small text-status-danger" role="alert">{errors.consent_cgu.message}</p>
          )}

          <div className="flex gap-s-3 pt-s-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} className="flex-1">
              Retour
            </Button>
            <Button type="submit" loading={submitting} className="flex-1 !text-primary-fg">
              Créer mon compte
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
