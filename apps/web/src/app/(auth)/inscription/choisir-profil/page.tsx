'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Stethoscope, Building2, ShoppingBag, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACTOR_OPTIONS = [
  { value: 'patient',    icon: User,        label: 'Patient',                     desc: 'Gérer ma santé et mes proches' },
  { value: 'sante',      icon: Stethoscope, label: 'Professionnel / Établissement', desc: 'Médecin, infirmier, clinique…' },
  { value: 'pharmacie',  icon: ShoppingBag, label: 'Pharmacie',                   desc: 'Gérer mon stock et mes réservations' },
  { value: 'couverture', icon: Shield,      label: 'Mutuelle / Assurance / IPM',  desc: 'Gérer les prises en charge' },
] as const

export default function ChoisirProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleSelect(actorType: string) {
    setLoading(actorType)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/connexion'); return }

    // Vérifier que l'utilisateur n'a pas déjà un actor_type (protection contre double-visite)
    const { data: profile } = await supabase
      .from('profiles')
      .select('actor_type, full_name')
      .eq('id', user.id)
      .single()

    const profileData = profile as unknown as { actor_type: string | null; full_name: string | null } | null
    if (profileData?.actor_type) {
      // Déjà configuré → rediriger directement
      router.push('/tableau-de-bord')
      return
    }

    const { error: updateErr } = await (supabase.from('profiles') as unknown as {
      update: (v: unknown) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> }
    }).update({ actor_type: actorType }).eq('id', user.id)

    if (updateErr) {
      setError('Erreur lors de la mise à jour du profil.')
      setLoading(null)
      return
    }

    // Créer la ligne dans la sous-table correspondante (obligatoire pour les dashboards)
    const displayName = profileData?.full_name ?? user.email ?? 'Utilisateur'
    type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
    if (actorType === 'patient') {
      await (supabase.from('patients') as unknown as InsertFn).insert({ profile_id: user.id, status: 'verifie' })
    } else if (actorType === 'sante') {
      await (supabase.from('professionals') as unknown as InsertFn).insert({ profile_id: user.id, status: 'pending', plan: 'essentiel' })
    } else if (actorType === 'pharmacie') {
      await (supabase.from('pharmacies') as unknown as InsertFn).insert({ profile_id: user.id, name: displayName, status: 'pending' })
    } else if (actorType === 'couverture') {
      await (supabase.from('coverage_orgs') as unknown as InsertFn).insert({ profile_id: user.id, name: displayName, status: 'pending' })
    }

    const routes: Record<string, string> = {
      patient:    '/patient/accueil',
      sante:      '/sante/accueil',
      pharmacie:  '/pharmacie/accueil',
      couverture: '/couverture/accueil',
    }
    router.push(routes[actorType] ?? '/tableau-de-bord')
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary)] flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-sm">SW</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Choisir votre profil</h1>
        <p className="text-sm text-[var(--sw-ink-2)]">Votre compte Google est créé — quelle est votre activité ?</p>
      </div>

      <div className="sw-card p-6 space-y-4">
        {error && (
          <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg)] px-3 py-2 rounded-lg">{error}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {ACTOR_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              type="button"
              disabled={loading !== null}
              onClick={() => handleSelect(value)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--sw-line)] hover:border-[var(--sw-primary)] hover:bg-[var(--sw-primary-subtle)] transition-colors text-center disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center">
                {loading === value
                  ? <span className="w-5 h-5 border-2 border-[var(--sw-primary)] border-t-transparent rounded-full animate-spin" />
                  : <Icon className="w-5 h-5 text-[var(--sw-primary)]" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--sw-ink)]">{label}</p>
                <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
