'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

const COUNTDOWN = 5

export default function PaiementConfirmationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [seconds, setSeconds] = useState(COUNTDOWN)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Destination optionnelle via ?next=/chemin ou fallback vers tableau-de-bord
  const next = searchParams.get('next') ?? '/tableau-de-bord'

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          router.replace(next)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [next, router])

  const progress = ((COUNTDOWN - seconds) / COUNTDOWN) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--sw-surface-2)] px-4">
      {/* Logo */}
      <div className="mb-10">
        <Logo size="md" />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm sw-card p-8 flex flex-col items-center gap-6 text-center">

        {/* Icône succès animée */}
        <div className="relative flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)]" strokeWidth={1.8} />
          </div>
          {/* Halo pulsant */}
          <span
            className="absolute inset-0 rounded-full bg-[var(--sw-success-bg)] animate-ping opacity-40"
            aria-hidden="true"
          />
        </div>

        {/* Texte */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paiement confirmé</h1>
          <p className="text-sm text-[var(--sw-ink-2)]">
            Votre paiement a bien été reçu.<br />
            Vous allez être redirigé vers votre tableau de bord dans{' '}
            <span className="font-semibold text-[var(--sw-ink)]">{seconds} seconde{seconds > 1 ? 's' : ''}</span>.
          </p>
        </div>

        {/* Barre de progression */}
        <div className="w-full h-1.5 rounded-full bg-[var(--sw-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--sw-success)] transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Bouton accès immédiat */}
        <button
          onClick={() => {
            if (intervalRef.current) clearInterval(intervalRef.current)
            router.replace(next)
          }}
          className="inline-flex items-center gap-2 w-full justify-center py-3 px-5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:bg-[var(--sw-primary-dark)] active:scale-[0.98] transition-all"
        >
          Accéder maintenant
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Note de bas de page */}
      <p className="mt-6 text-xs text-[var(--sw-ink-3)] text-center max-w-xs">
        Un email de confirmation vous a été envoyé.
        En cas de problème, contactez{' '}
        <a href="mailto:support@senewerr.sn" className="text-[var(--sw-primary)] hover:underline">
          support@senewerr.sn
        </a>
      </p>
    </div>
  )
}
