import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EtablissementNav, EtablissementBottomNav } from '@/components/layout/etablissement-nav'

export default async function EtablissementLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/etablissement/accueil')

  const { data: profileData } = await supabase
    .from('profils')
    .select('actor_type')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'sante') redirect('/tableau-de-bord')

  const { data: estData } = await supabase
    .from('etablissements')
    .select('id, name')
    .eq('profile_id', user.id)
    .maybeSingle()
  const est = estData as unknown as { id: string; name: string } | null
  // Si c'est un professionnel indépendant sans établissement propre, renvoyer vers /sante
  if (!est) redirect('/sante/accueil')

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[var(--sw-surface)] border-r border-[var(--sw-line)] fixed h-full">
        <EtablissementNav estName={est.name} />
      </aside>
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
          <EtablissementBottomNav />
        </div>
      </div>
    </div>
  )
}
