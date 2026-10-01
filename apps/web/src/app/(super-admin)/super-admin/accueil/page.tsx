import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, Database, Activity, Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Super Admin — Séné Wérr' }

export default async function SuperAdminAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [
    { count: usersTotal },
    { count: orgCount },
  ] = await Promise.all([
    supabase.from('profils').select('*', { count: 'exact', head: true }),
    supabase.from('organismes_couverture').select('*', { count: 'exact', head: true }),
  ])

  const sections = [
    { href: '/super-admin/comptes', label: 'Comptes', icon: Users },
    { href: '/super-admin/migrations', label: 'DB & Migrations', icon: Database },
    { href: '/super-admin/logs', label: 'Logs système', icon: Activity },
    { href: '/super-admin/securite', label: 'Sécurité', icon: Shield },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="text-slate-400 mt-1">Accès global à la plateforme Séné Wérr</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-1">
          <p className="text-3xl font-bold text-white">{usersTotal ?? 0}</p>
          <p className="text-sm text-slate-400">Utilisateurs totaux</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-1">
          <p className="text-3xl font-bold text-white">{orgCount ?? 0}</p>
          <p className="text-sm text-slate-400">Organismes couverture</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {sections.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col items-center gap-2 text-center hover:border-red-500 transition-colors">
            <Icon className="w-6 h-6 text-slate-300" />
            <span className="text-sm font-medium text-white">{label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
