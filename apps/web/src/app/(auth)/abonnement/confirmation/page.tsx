import Link from 'next/link'
import { CheckCircle2, ArrowRight, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Abonnement activé — Séné Wérr' }

interface Props {
  searchParams: Promise<{
    plan?: string
    session_id?: string
  }>
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  decouverte: { label: 'Découverte', color: 'text-[var(--sw-ink-2)]' },
  start: { label: 'Start', color: 'text-[var(--sw-info)]' },
  pro: { label: 'Pro', color: 'text-[var(--sw-primary)]' },
  premium: { label: 'Premium', color: 'text-[var(--sw-warning)]' },
  essentiel: { label: 'Essentiel', color: 'text-[var(--sw-ink-2)]' },
  cabinet: { label: 'Cabinet', color: 'text-[var(--sw-info)]' },
  clinique: { label: 'Clinique', color: 'text-[var(--sw-primary)]' },
  hopital: { label: 'Hôpital', color: 'text-[var(--sw-warning)]' },
}

export default async function AbonnementConfirmationPage({ searchParams }: Props) {
  const { plan, session_id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const planInfo = plan ? PLAN_LABELS[plan] : null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('actor_type, first_name')
    .eq('id', user?.id ?? '')
    .single()
  const profile = profileData as unknown as { actor_type: string; first_name: string } | null

  const dashboardUrl = '/tableau-de-bord'

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-5">
        {/* Succès */}
        <div className="sw-card p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)]" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--sw-ink)]">
              Abonnement activé !
            </h1>
            <p className="text-[var(--sw-ink-2)]">
              {profile?.first_name ? `Bienvenue, ${profile.first_name} !` : 'Bienvenue !'}
              {planInfo && (
                <> Votre plan{' '}
                  <span className={`font-semibold ${planInfo.color}`}>{planInfo.label}</span>
                  {' '}est maintenant actif.
                </>
              )}
            </p>
          </div>

          {/* Avantages activés */}
          <div className="bg-[var(--sw-primary-subtle)] rounded-xl p-4 text-left space-y-3">
            <p className="text-sm font-semibold text-[var(--sw-primary)] flex items-center gap-2">
              <Star className="w-4 h-4" />
              Ce qui est maintenant disponible
            </p>
            <ul className="space-y-1.5">
              {[
                'Accès complet à votre espace',
                'Visibilité sur la plateforme',
                'Gestion des rendez-vous et réservations',
                'Support prioritaire',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--sw-ink-2)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Link href={dashboardUrl}>
              <Button className="w-full" size="lg">
                Accéder à mon espace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <p className="text-xs text-[var(--sw-ink-3)]">
              Une facture vous sera envoyée par email.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
