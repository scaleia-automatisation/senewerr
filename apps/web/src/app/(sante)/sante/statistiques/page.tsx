import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BarChart3, Users, Calendar, FileText, TrendingUp } from 'lucide-react'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Statistiques — Espace Santé' }

export default async function SanteStatistiquesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: professionalData } = await supabase
    .from('professionals')
    .select('id, consultation_fee_fcfa')
    .eq('profile_id', user.id)
    .single()
  const professional = professionalData as unknown as { id: string; consultation_fee_fcfa: number | null } | null

  if (!professional) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
      </div>
    )
  }

  const [
    { count: totalRdv },
    { count: rdvConfirmes },
    { count: rdvCompletes },
    { count: rdvAnnules },
    { count: rdvNoshows },
    { count: totalOrdonnances },
    { count: ordonActives },
  ] = await Promise.all([
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id).eq('status', 'confirmed'),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id).eq('status', 'completed'),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id).eq('status', 'cancelled'),
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id).eq('status', 'no_show'),
    supabase.from('prescriptions').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id),
    supabase.from('prescriptions').select('*', { count: 'exact', head: true })
      .eq('professional_id', professional.id).in('status', ['issued', 'shared', 'validated']),
  ])

  const completed = rdvCompletes ?? 0
  const total = totalRdv ?? 0
  const estimatedRevenue = completed * (professional.consultation_fee_fcfa ?? 0)

  const STATS = [
    {
      label: 'Total rendez-vous',
      value: total,
      icon: Calendar,
      color: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
    },
    {
      label: 'Consultations effectuées',
      value: completed,
      icon: Users,
      color: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
    },
    {
      label: 'Ordonnances émises',
      value: totalOrdonnances ?? 0,
      icon: FileText,
      color: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    },
    {
      label: 'Revenus estimés',
      value: formatCFA(estimatedRevenue),
      icon: TrendingUp,
      color: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
      isText: true,
    },
  ]

  const statuses = [
    { label: 'Confirmés', count: rdvConfirmes ?? 0, color: 'bg-[var(--sw-success)]' },
    { label: 'Complétés', count: completed, color: 'bg-[var(--sw-primary)]' },
    { label: 'Annulés', count: rdvAnnules ?? 0, color: 'bg-[var(--sw-danger)]' },
    { label: 'Absences', count: rdvNoshows ?? 0, color: 'bg-[var(--sw-warning)]' },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Statistiques</h1>
          <p className="text-sm text-[var(--sw-ink-2)]">Vue d&apos;ensemble de votre activité</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(({ label, value, icon: Icon, color, isText }) => (
          <div key={label} className="sw-card p-5 space-y-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className={`font-bold ${isText ? 'text-lg' : 'text-3xl'} text-[var(--sw-ink)]`}>
                {value}
              </p>
              <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Répartition des RDV */}
      {total > 0 && (
        <div className="sw-card p-5 space-y-4">
          <h2 className="font-semibold text-[var(--sw-ink)]">Répartition des rendez-vous</h2>
          <div className="space-y-3">
            {statuses.map(({ label, count, color }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--sw-ink-2)]">{label}</span>
                    <span className="font-medium text-[var(--sw-ink)]">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-[var(--sw-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Ordonnances */}
      <div className="sw-card p-5 space-y-3">
        <h2 className="font-semibold text-[var(--sw-ink)]">Ordonnances</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-bold text-[var(--sw-ink)]">{totalOrdonnances ?? 0}</p>
            <p className="text-sm text-[var(--sw-ink-2)]">Total émises</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--sw-info)]">{ordonActives ?? 0}</p>
            <p className="text-sm text-[var(--sw-ink-2)]">Actives</p>
          </div>
        </div>
      </div>
    </div>
  )
}
