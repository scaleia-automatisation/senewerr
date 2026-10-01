import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PatientNav, PatientBottomNav } from '@/components/layout/patient-nav'

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion?redirect=/patient/accueil')

  const { data: profileData } = await supabase
    .from('profils')
    .select('actor_type')
    .eq('id', user.id)
    .single()

  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'patient') {
    redirect('/tableau-de-bord')
  }

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-[var(--sw-surface)] border-r border-[var(--sw-line)] fixed h-full">
        <PatientNav />
      </aside>

      {/* Contenu */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
        {/* Navigation mobile bas */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <PatientBottomNav />
        </div>
      </div>
    </div>
  )
}
