import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('actor_type')
    .eq('id', user.id)
    .single()

  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/tableau-de-bord')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900 border-b border-slate-700 px-4 h-14 flex items-center gap-3 sticky top-0 z-30">
        <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
          <span className="text-white font-bold text-xs">SA</span>
        </div>
        <span className="font-semibold">Super Admin — Séné Wérr</span>
      </header>
      <main>{children}</main>
    </div>
  )
}
