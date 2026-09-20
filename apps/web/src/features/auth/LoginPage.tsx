import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Phone } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }    from '@/components/ui/Button'
import { Input }     from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import { Banner }    from '@/components/ui/Banner'
import { toast }     from 'sonner'
import { supabase }  from '@/lib/supabase'

const ROLE_DESTINATIONS: Record<string, string> = {
  patient:              '/patient',
  professional:         '/pro',
  establishment_admin:  '/etablissement',
  establishment_staff:  '/etablissement',
  pharmacy_admin:       '/pharmacie',
  pharmacy_staff:       '/pharmacie',
  mutual_admin:         '/mutuelle',
  mutual_staff:         '/mutuelle',
  platform_admin:       '/admin',
  super_admin:          '/admin',
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function normalizeE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (raw.trimStart().startsWith('+')) return raw.replace(/\s/g, '')
  if (digits.length === 9) return `+221${digits}`
  if (digits.length === 12 && digits.startsWith('221')) return `+${digits}`
  return raw.trim()
}

function isPhone(v: string): boolean {
  const t = v.trim()
  return t.startsWith('+') || /^\d{7,}$/.test(t.replace(/[\s\-]/g, ''))
}

// ──────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────
const schema = z.object({
  identifier: z.string().min(1, 'Email ou téléphone requis'),
  password:   z.string().min(1, 'Mot de passe requis'),
})
type Form = z.infer<typeof schema>

const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const [showPwd,     setShowPwd]     = useState(false)
  const [attempts,    setAttempts]    = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [magicLoading, setMagicLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const identifier = watch('identifier', '')
  const inputIsPhone = isPhone(identifier)

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil
  const lockedMins = lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 60_000) : 0

  const onSubmit = async (data: Form) => {
    if (isLocked) return

    const id = data.identifier.trim()
    const phone = inputIsPhone ? normalizeE164(id) : null

    const { error } = phone
      ? await supabase.auth.signInWithPassword({ phone, password: data.password })
      : await supabase.auth.signInWithPassword({ email: id, password: data.password })

    if (error) {
      const next = attempts + 1
      setAttempts(next)
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS)
        toast.error('Compte temporairement verrouillé pendant 15 minutes suite à plusieurs tentatives.')
      } else {
        toast.error('Identifiant ou mot de passe incorrect')
      }
      return
    }

    setAttempts(0)

    // Vérifier si une 2FA est requise
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      navigate('/auth/2fa', { replace: true, state: { from } })
      return
    }

    // Si from est une vraie page (pas la racine), on l'utilise directement
    if (from && from !== '/') {
      navigate(from, { replace: true })
      return
    }

    // Sinon on dispatche selon le rôle
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) { navigate('/', { replace: true }); return }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    const dest = (profileData?.role && ROLE_DESTINATIONS[profileData.role]) ?? '/'
    navigate(dest, { replace: true })
  }

  const sendMagicLink = async () => {
    const id = identifier.trim()
    if (!id || !id.includes('@')) {
      toast.error('Saisissez d\'abord votre adresse email pour recevoir un lien magique.')
      return
    }
    setMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: id,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setMagicLoading(false)
    if (error) {
      toast.error('Impossible d\'envoyer le lien. Réessayez.')
    } else {
      toast.success('Lien magique envoyé ! Vérifiez votre boîte mail.')
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Content de vous revoir !"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/auth/inscription" className="font-medium text-primary hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {isLocked && (
        <Banner kind="warning" className="mb-s-4">
          {`Compte verrouillé — réessayez dans ${lockedMins} min suite à plusieurs tentatives.`}
        </Banner>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email ou téléphone"
          type="text"
          autoComplete="username"
          inputMode={inputIsPhone ? 'tel' : 'email'}
          placeholder="vous@exemple.com ou 77 123 45 67"
          leftIcon={inputIsPhone
            ? <Phone className="w-4 h-4" />
            : <Mail  className="w-4 h-4" />}
          error={errors.identifier?.message}
          required
          aria-describedby={errors.identifier ? 'identifier-error' : undefined}
          {...register('identifier')}
        />

        <Input
          label="Mot de passe"
          type={showPwd ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          error={errors.password?.message}
          required
          {...register('password')}
        />

        <div className="flex items-center justify-between gap-s-4">
          <Link
            to="/auth/mot-de-passe-oublie"
            className="text-small text-ink-3 hover:text-primary hover:underline"
          >
            Mot de passe oublié ?
          </Link>
          {!inputIsPhone && (
            <button
              type="button"
              className="text-small text-ink-3 hover:text-primary hover:underline disabled:opacity-50"
              onClick={sendMagicLink}
              disabled={magicLoading}
            >
              {magicLoading ? 'Envoi…' : 'Lien magique'}
            </button>
          )}
        </div>

        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isLocked}
          className="w-full mt-2"
        >
          Se connecter
        </Button>

        <Separator label="ou" />

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            })
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuer avec Google
        </Button>
      </form>
    </AuthLayout>
  )
}
