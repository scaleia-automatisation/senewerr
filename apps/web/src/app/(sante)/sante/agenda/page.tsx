import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgendaView } from '@/components/sante/agenda-view'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon agenda' }

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profile } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const actorType = (profile as unknown as { actor_type: string } | null)?.actor_type
  if (!actorType || !['sante', 'professionnel'].includes(actorType)) redirect('/connexion')

  const { data: proData } = await supabase
    .from('professionals')
    .select('id, establishment_professionals(establishments(id, name))')
    .eq('profile_id', user.id)
    .maybeSingle()

  const pro = proData as unknown as {
    id: string
    establishment_professionals: { establishments: { id: string; name: string } | null }[]
  } | null

  if (!pro) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <div className="sw-card p-10 text-center">
          <p className="text-sm text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
        </div>
      </div>
    )
  }

  const establishments = (pro.establishment_professionals ?? [])
    .map(ep => ep.establishments)
    .filter(Boolean) as { id: string; name: string }[]

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <AgendaView professionalId={pro.id} establishments={establishments} />
    </div>
  )
}
