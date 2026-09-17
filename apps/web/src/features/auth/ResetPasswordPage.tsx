import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }     from '@/components/ui/Button'
import { Input }      from '@/components/ui/Input'
import { toast }      from 'sonner'
import { supabase }   from '@/lib/supabase'

const schema = z.object({
  password:        z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path:    ['confirmPassword'],
})

type ResetForm = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate   = useNavigate()
  const [showPwd, setShowPwd] = useState(false)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: ResetForm) => {
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      toast.error('Impossible de réinitialiser le mot de passe.')
      return
    }
    toast.success('Mot de passe mis à jour !')
    navigate('/auth/connexion')
  }

  if (!validSession) {
    return (
      <AuthLayout title="Lien expiré">
        <p className="text-center text-small text-ink-2">
          Ce lien de réinitialisation est invalide ou a expiré.
        </p>
        <Button variant="secondary" fullWidth className="mt-s-4" onClick={() => navigate('/auth/mot-de-passe-oublie')}>
          Demander un nouveau lien
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe sécurisé."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nouveau mot de passe"
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Minimum 8 caractères"
          rightIcon={
            <button type="button" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          error={errors.password?.message}
          required
          {...register('password')}
        />
        <Input
          label="Confirmer le mot de passe"
          type={showPwd ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Répétez le mot de passe"
          error={errors.confirmPassword?.message}
          required
          {...register('confirmPassword')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthLayout>
  )
}
