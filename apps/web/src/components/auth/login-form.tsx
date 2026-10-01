'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleOAuthButton } from '@/components/auth/google-oauth-button'

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/tableau-de-bord'
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const supabase = createClient()
    const { data: auth, error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (error || !auth.user) {
      setServerError('Email ou mot de passe incorrect.')
      return
    }

    // Redirection explicite demandée (ex: retour depuis une page protégée)
    if (redirect.startsWith('/') && redirect !== '/') {
      router.push(redirect)
      router.refresh()
      return
    }

    // Sinon, tableau de bord selon le type d'acteur
    const { data: profile } = await supabase
      .from('profils')
      .select('actor_type')
      .eq('id', auth.user.id)
      .single()

    const destination = (() => {
      switch (profile?.actor_type) {
        case 'patient':    return '/patient/accueil'
        case 'sante':      return '/sante/accueil'
        case 'pharmacie':  return '/pharmacie/accueil'
        case 'couverture': return '/couverture/accueil'
        case 'admin':
        case 'super_admin': return '/admin/accueil'
        default:           return '/patient/accueil'
      }
    })()

    router.push(destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Adresse e-mail"
        type="email"
        placeholder="vous@exemple.com"
        leftIcon={<Mail className="w-4 h-4" />}
        error={errors.email?.message}
        required
        {...register('email')}
      />
      <div className="space-y-1.5">
        <Input
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          error={errors.password?.message}
          rightIcon={
            <button type="button" onClick={() => setShowPassword(v => !v)} className="hover:text-[var(--sw-ink)]">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          required
          {...register('password')}
        />
        <div className="text-right">
          <Link href="/mot-de-passe-oublie" className="text-xs text-[var(--sw-primary)] hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      {serverError && (
        <div className="bg-[var(--sw-danger-bg)] text-[var(--sw-danger)] text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        Se connecter
      </Button>

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--sw-line)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-[var(--sw-surface)] px-2 text-[var(--sw-ink-3)]">ou</span>
        </div>
      </div>

      <GoogleOAuthButton />
    </form>
  )
}
