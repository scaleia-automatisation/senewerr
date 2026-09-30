import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Building2, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Administration — Séné Wérr' }

export default async function AdminAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [
    { count: usersCount },
    { count: pendingCount },
    { count: litiges },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
    supabase.from('litiges').select('*', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  const stats = [
    { label: 'Utilisateurs', value: usersCount ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'En attente validation', value: pendingCount ?? 0, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Litiges ouverts', value: litiges ?? 0, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Actif', value: '—', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  ]

  const sections = [
    { href: '/admin/utilisateurs', label: 'Gestion utilisateurs', icon: Users },
    { href: '/admin/pharmacies', label: 'Pharmacies', icon: Building2 },
    { href: '/admin/litiges', label: 'Litiges', icon: AlertTriangle },
    { href: '/admin/statistiques', label: 'Statistiques', icon: TrendingUp },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Tableau de bord — Administration</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="sw-card p-4 space-y-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-[var(--sw-ink)]">{value}</p>
            <p className="text-xs text-[var(--sw-ink-2)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {sections.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="sw-card p-4 flex flex-col items-center gap-2 text-center hover:border-slate-400 transition-colors">
            <Icon className="w-6 h-6 text-slate-600" />
            <span className="text-sm font-medium text-[var(--sw-ink)]">{label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
