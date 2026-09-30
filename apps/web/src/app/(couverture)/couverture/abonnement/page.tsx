import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BadgeCheck } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Abonnement — Couverture' }

export default async function AbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <BadgeCheck className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Abonnement</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Votre plan Séné Wérr</p>
        </div>
      </div>
      <div className="sw-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <BadgeCheck className="w-6 h-6 text-[var(--sw-primary)]" />
          </div>
          <div>
            <p className="text-base font-bold text-[var(--sw-ink)]">Accès gratuit</p>
            <p className="text-sm text-[var(--sw-ink-2)]">Pendant la phase de lancement</p>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--sw-success-bg)] p-4">
          <p className="text-sm font-medium text-[var(--sw-success)]">Toutes les fonctionnalités incluses</p>
          <p className="text-xs text-[var(--sw-ink-2)] mt-1">Gestion des adhérents, demandes de prise en charge, paiements et remboursements — sans frais.</p>
        </div>
      </div>
    </div>
  )
}
