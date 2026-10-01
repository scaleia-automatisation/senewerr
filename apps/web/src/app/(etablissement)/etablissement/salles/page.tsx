import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DoorOpen, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Salles — Établissement Séné Wérr' }

export default async function SallesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const { data: estRaw } = await supabase.from('etablissements').select('id').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">Salles & ressources</h1>
            <p className="text-xs text-[var(--sw-ink-2)]">Cabinets, salles d'examen, équipements</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] opacity-50 cursor-not-allowed" disabled>
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="sw-card p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center">
          <DoorOpen className="w-7 h-7 text-[var(--sw-ink-3)]" />
        </div>
        <div>
          <p className="font-medium text-[var(--sw-ink)]">Gestion des salles</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1 max-w-xs">
            Définissez vos cabinets et ressources physiques pour les associer aux plannings et rendez-vous.
          </p>
        </div>
        <span className="text-xs text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)] px-3 py-1 rounded-full">Bientôt disponible</span>
      </div>
    </div>
  )
}
