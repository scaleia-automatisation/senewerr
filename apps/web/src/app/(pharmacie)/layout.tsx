import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PharmacieNav, PharmacieBottomNav } from '@/components/layout/pharmacie-nav'

export default async function PharmacieLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/pharmacie/accueil')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).single()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'pharmacie') redirect('/tableau-de-bord')

  const { data: pharmacyData } = await supabase.from('pharmacies').select('name').eq('profile_id', user.id).maybeSingle()
  const pharmacyName = (pharmacyData as unknown as { name: string } | null)?.name

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex">
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-[var(--sw-surface)] border-r border-[var(--sw-line)] fixed h-full">
        <PharmacieNav pharmacyName={pharmacyName} />
      </aside>
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <PharmacieBottomNav />
        </div>
      </div>
    </div>
  )
}
