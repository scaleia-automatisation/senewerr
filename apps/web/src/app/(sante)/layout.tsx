import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SanteNav, SanteBottomNav } from '@/components/layout/sante-nav'
import { OnboardingGuard } from '@/components/sante/onboarding-guard'

export default async function SanteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/accueil')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('actor_type')
    .eq('id', user.id)
    .single()

  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'sante') redirect('/tableau-de-bord')

  const [{ data: professionalData }, { data: establishmentData }] = await Promise.all([
    supabase.from('professionals').select('id').eq('profile_id', user.id).maybeSingle(),
    supabase.from('establishments').select('id').eq('profile_id', user.id).maybeSingle(),
  ])
  const hasProfile = !!(professionalData || establishmentData)

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex">
      <OnboardingGuard hasProfile={hasProfile} />
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-[var(--sw-surface)] border-r border-[var(--sw-line)] fixed h-full">
        <SanteNav />
      </aside>
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <SanteBottomNav />
        </div>
      </div>
    </div>
  )
}
