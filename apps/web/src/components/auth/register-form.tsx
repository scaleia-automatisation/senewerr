'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, User, Mail, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActorType } from '@/types'

// ─── Profile selection step ───────────────────────────────────────────────
const PROFILES = [
  {
    id: 'patient' as ActorType,
    label: 'Je suis patient',
    desc: 'Accès gratuit à tous vos services de santé',
    badge: 'Gratuit',
    badgeClass: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]',
    emoji: '🏥',
  },
  {
    id: 'sante' as ActorType,
    label: 'Professionnel ou établissement de santé',
    desc: 'Médecins, cliniques, hôpitaux, cabinets…',
    badge: 'Abonnement',
    badgeClass: 'text-[var(--sw-info)] bg-[var(--sw-info-bg)]',
    emoji: '⚕️',
  },
  {
    id: 'pharmacie' as ActorType,
    label: 'Pharmacie',
    desc: 'Gérez votre catalogue et vos réservations',
    badge: 'Abonnement',
    badgeClass: 'text-[var(--sw-info)] bg-[var(--sw-info-bg)]',
    emoji: '💊',
  },
  {
    id: 'couverture' as ActorType,
    label: 'Mutuelle, IPM ou assurance',
    desc: 'Gérez vos adhérents et prises en charge',
    badge: 'Abonnement',
    badgeClass: 'text-[var(--sw-info)] bg-[var(--sw-info-bg)]',
    emoji: '🛡️',
  },
]

const schema = z.object({
  first_name: z.string().min(2, 'Prénom requis'),
  last_name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  date_of_birth: z.string().optional(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirm_password: z.string(),
  accept_terms: z.boolean().refine(v => v === true, 'Vous devez accepter les conditions'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm_password'],
})
type FormData = z.infer<typeof schema>

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialProfile = (searchParams.get('profil') as ActorType | null) ?? null

  const [step, setStep] = useState<'profile' | 'details'>(initialProfile ? 'details' : 'profile')
  const [actorType, setActorType] = useState<ActorType | null>(initialProfile)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function selectProfile(id: ActorType) {
    setActorType(id)
    setStep('details')
  }

  async function onSubmit(data: FormData) {
    if (!actorType) return
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          actor_type: actorType,
          date_of_birth: data.date_of_birth ?? null,
        },
      },
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setServerError('Cette adresse email est déjà utilisée.')
      } else {
        setServerError(signUpError.message)
      }
      return
    }

    // Redirect to confirmation or dashboard
    router.push('/inscription/confirmation')
  }

  // ── Step 1: Profile selection ──────────────────────────────────────
  if (step === 'profile') {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-[var(--sw-ink)] text-center">
          Quel est votre profil ?
        </p>
        <div className="space-y-3">
          {PROFILES.map(({ id, label, desc, badge, badgeClass, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectProfile(id)}
              className="w-full text-left p-4 rounded-xl border border-[var(--sw-line)] hover:border-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)] transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[var(--sw-ink)] group-hover:text-[var(--sw-primary)]">{label}</span>
                    <span className={`sw-badge ${badgeClass}`}>{badge}</span>
                  </div>
                  <p className="text-xs text-[var(--sw-ink-2)]">{desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Details form ───────────────────────────────────────────
  const selected = PROFILES.find(p => p.id === actorType)!
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-[var(--sw-primary-subtle)] rounded-xl">
        <span className="text-xl">{selected.emoji}</span>
        <div>
          <p className="text-xs text-[var(--sw-ink-3)]">Profil sélectionné</p>
          <p className="text-sm font-medium text-[var(--sw-primary)]">{selected.label}</p>
        </div>
        <button
          type="button"
          onClick={() => setStep('profile')}
          className="ml-auto text-xs text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)] underline"
        >
          Changer
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Prénom"
          placeholder="Awa"
          leftIcon={<User className="w-4 h-4" />}
          error={errors.first_name?.message}
          required
          {...register('first_name')}
        />
        <Input
          label="Nom"
          placeholder="Diop"
          error={errors.last_name?.message}
          required
          {...register('last_name')}
        />
      </div>

      <Input
        label="Adresse e-mail"
        type="email"
        placeholder="awa@exemple.com"
        leftIcon={<Mail className="w-4 h-4" />}
        error={errors.email?.message}
        required
        {...register('email')}
      />

      {(actorType === 'patient' || actorType === 'sante') && (
        <Input
          label="Date de naissance"
          type="date"
          leftIcon={<Calendar className="w-4 h-4" />}
          {...register('date_of_birth')}
        />
      )}

      <Input
        label="Mot de passe"
        type={showPassword ? 'text' : 'password'}
        placeholder="Minimum 8 caractères"
        error={errors.password?.message}
        required
        rightIcon={
          <button type="button" onClick={() => setShowPassword(v => !v)}>
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        {...register('password')}
      />

      <Input
        label="Confirmer le mot de passe"
        type={showConfirm ? 'text' : 'password'}
        placeholder="••••••••"
        error={errors.confirm_password?.message}
        required
        rightIcon={
          <button type="button" onClick={() => setShowConfirm(v => !v)}>
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        {...register('confirm_password')}
      />

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-[var(--sw-line)] accent-[var(--sw-primary)]"
          {...register('accept_terms')}
        />
        <span className="text-xs text-[var(--sw-ink-2)]">
          J'accepte les{' '}
          <a href="/cgu" target="_blank" className="text-[var(--sw-primary)] hover:underline">conditions d'utilisation</a>
          {' '}et la{' '}
          <a href="/politique-confidentialite" target="_blank" className="text-[var(--sw-primary)] hover:underline">politique de confidentialité</a>
        </span>
      </label>
      {errors.accept_terms && (
        <p className="text-xs text-[var(--sw-danger)]">{errors.accept_terms.message}</p>
      )}

      {serverError && (
        <div className="bg-[var(--sw-danger-bg)] text-[var(--sw-danger)] text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        Créer mon compte
      </Button>
    </form>
  )
}
