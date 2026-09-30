import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wrench, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Services — Établissement Séné Wérr' }

const DEFAULT_SERVICES = [
  'Médecine générale', 'Pédiatrie', 'Gynécologie-obstétrique',
  'Cardiologie', 'Dermatologie', 'Ophtalmologie',
  'ORL', 'Radiologie', 'Biologie médicale', 'Urgences',
]

export default async function ServicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase.from('establishments').select('id, name').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string; name: string }

  // Services actifs = spécialités des professionnels rattachés
  const { data: membersData } = await supabase
    .from('establishment_professionals')
    .select('professional:professionals(specialty, professional_type)')
    .eq('establishment_id', est.id).eq('status', 'accepted')
  const specialties = [...new Set(
    ((membersData ?? []) as unknown as { professional: { specialty: string | null; professional_type: string | null } | null }[])
      .map(m => m.professional?.specialty ?? m.professional?.professional_type)
      .filter(Boolean)
      .map(s => s!.replace(/_/g, ' '))
  )]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <Wrench className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">Services</h1>
            <p className="text-xs text-[var(--sw-ink-2)]">Spécialités et prestations proposées</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors opacity-50 cursor-not-allowed" disabled>
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Services actifs (déduits des pros rattachés) */}
      {specialties.length > 0 && (
        <div className="sw-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Spécialités disponibles</h2>
          <div className="flex flex-wrap gap-2">
            {specialties.map(s => (
              <span key={s} className="px-3 py-1.5 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-medium capitalize">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Catalogue par défaut */}
      <div className="sw-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Catalogue de services</h2>
          <span className="text-xs text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)] px-2 py-0.5 rounded-full">Bientôt</span>
        </div>
        <p className="text-xs text-[var(--sw-ink-2)]">
          La configuration détaillée des services (tarifs, durée, ressources) sera disponible prochainement.
        </p>
        <div className="flex flex-wrap gap-2 opacity-50">
          {DEFAULT_SERVICES.map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-xs">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
