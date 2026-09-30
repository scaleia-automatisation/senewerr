'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  email: z.string().email('Adresse e-mail invalide'),
})
type FormData = z.infer<typeof schema>

export default function MotDePasseOubliePage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${location.origin}/reinitialiser-mot-de-passe`,
    })

    if (error) {
      setError('Une erreur est survenue. Vérifiez votre adresse e-mail.')
      return
    }
    setSent(true)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">SW</span>
          </div>
          <span className="font-semibold text-[var(--sw-ink)]">Séné Wérr</span>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Mot de passe oublié</h1>
        <p className="text-sm text-[var(--sw-ink-2)]">
          Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation
        </p>
      </div>

      {sent ? (
        <div className="sw-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[var(--sw-success)]" />
            </div>
          </div>
          <p className="text-sm text-[var(--sw-ink-2)]">
            Si un compte existe avec cette adresse, un lien de réinitialisation vous a été envoyé.
          </p>
          <Link href="/connexion">
            <Button variant="outline" className="w-full">Retour à la connexion</Button>
          </Link>
        </div>
      ) : (
        <div className="sw-card p-6 space-y-5">
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
            {error && (
              <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg)] px-3 py-2 rounded-lg">{error}</p>
            )}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Envoyer le lien
            </Button>
          </form>
          <Link href="/connexion" className="flex items-center justify-center gap-1.5 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à la connexion
          </Link>
        </div>
      )}
    </div>
  )
}
