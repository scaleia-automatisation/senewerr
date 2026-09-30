'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  password: z.string().min(8, 'Minimum 8 caractères'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

export default function ReinitialiserMotDePassePage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/connexion'), 2000)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Nouveau mot de passe</h1>
        <p className="text-sm text-[var(--sw-ink-2)]">Choisissez un nouveau mot de passe sécurisé</p>
      </div>

      {done ? (
        <div className="sw-card p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[var(--sw-success)]" />
            </div>
          </div>
          <p className="text-sm text-[var(--sw-ink-2)]">Mot de passe mis à jour. Redirection…</p>
        </div>
      ) : (
        <div className="sw-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Nouveau mot de passe"
              type={showPass ? 'text' : 'password'}
              placeholder="Minimum 8 caractères"
              error={errors.password?.message}
              required
              rightIcon={
                <button type="button" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />
            <Input
              label="Confirmer le mot de passe"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              error={errors.confirm?.message}
              required
              {...register('confirm')}
            />
            {error && (
              <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg)] px-3 py-2 rounded-lg">{error}</p>
            )}
            <Button type="submit" loading={isSubmitting} className="w-full">
              Enregistrer le mot de passe
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
