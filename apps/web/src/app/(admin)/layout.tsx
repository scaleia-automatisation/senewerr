import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, Users, CheckCircle2, CreditCard, AlertTriangle, Calendar } from 'lucide-react'

const NAV = [
  { href: '/admin/accueil',       icon: Home,          label: 'Accueil' },
  { href: '/admin/utilisateurs',  icon: Users,         label: 'Utilisateurs' },
  { href: '/admin/validation',    icon: CheckCircle2,  label: 'Validation' },
  { href: '/admin/abonnements',   icon: CreditCard,    label: 'Abonnements' },
  { href: '/admin/litiges',       icon: AlertTriangle, label: 'Litiges' },
  { href: '/admin/evenements',    icon: Calendar,      label: 'Événements' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profils')
    .select('actor_type')
    .eq('id', user.id)
    .single()

  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || !['admin', 'super_admin'].includes(profile.actor_type)) redirect('/tableau-de-bord')

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex flex-col">
      <header className="bg-slate-800 text-white px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-xs">SW</span>
        </div>
        <span className="font-semibold">Administration</span>
        <nav className="ml-8 flex gap-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
