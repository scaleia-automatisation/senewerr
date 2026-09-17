import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { Button }     from '@/components/ui/Button'
import { Input }      from '@/components/ui/Input'
import { toast }      from 'sonner'
import { supabase }   from '@/lib/supabase'

const schema = z.object({
  email: z.string().email('Email invalide'),
})

type ForgotForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: ForgotForm) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/nouveau-mot-de-passe`,
    })
    if (error) {
      toast.error('Erreur lors de l\'envoi. Réessayez.')
      return
    }
    setSentEmail(data.email)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="Email envoyé !">
        <div className="flex flex-col items-center gap-s-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)]">
            <CheckCircle2 className="h-8 w-8 text-status-success" />
          </div>
          <div>
            <p className="text-small text-ink-2">Un lien de réinitialisation a été envoyé à</p>
            <p className="mt-s-1 font-semibold text-ink">{sentEmail}</p>
          </div>
          <p className="text-micro text-ink-3">
            Vérifiez vos spams si vous ne le recevez pas dans 5 minutes.
          </p>
          <Button variant="secondary" fullWidth className="mt-s-2" asChild>
            <Link to="/auth/connexion">
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Mot de passe oublié ?"
      subtitle="Entrez votre email, nous vous enverrons un lien de réinitialisation."
      footer={
        <Link to="/auth/connexion" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          leftIcon={<Mail className="w-4 h-4" />}
          error={errors.email?.message}
          required
          {...register('email')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">
          Envoyer le lien
        </Button>
      </form>
    </AuthLayout>
  )
}
