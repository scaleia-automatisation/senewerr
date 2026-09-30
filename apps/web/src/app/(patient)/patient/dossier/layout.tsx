import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DossierTabsNav } from '@/components/patient/dossier-tabs-nav'
import { FolderHeart } from 'lucide-react'

export default async function DossierLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('first_name, last_name, actor_type')
    .eq('id', user.id)
    .single()

  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; actor_type: string } | null
  if (!profile || profile.actor_type !== 'patient') redirect('/tableau-de-bord')

  const patientName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Mon dossier'

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-[var(--sw-surface)] border-b border-[var(--sw-line)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--sw-line)]">
          <div className="w-8 h-8 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <FolderHeart className="w-4 h-4 text-[var(--sw-primary)]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--sw-ink)]">Dossier de santé</h1>
            <p className="text-xs text-[var(--sw-ink-2)]">{patientName}</p>
          </div>
        </div>
        <DossierTabsNav />
      </div>
      <div>{children}</div>
    </div>
  )
}
