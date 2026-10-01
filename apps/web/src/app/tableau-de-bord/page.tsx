import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TableauDeBordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profils')
    .select('actor_type, account_status')
    .eq('id', user.id)
    .single()

  // Pas de profil → nouvel utilisateur OAuth (trigger pas encore exécuté ou échoué)
  if (!profileData) redirect('/inscription/choisir-profil')

  const profile = profileData as unknown as { actor_type: string | null; account_status: string }
  const actorType = profile.actor_type

  // Utilisateur existant → son tableau de bord
  if (actorType === 'patient')    redirect('/patient/accueil')
  if (actorType === 'sante')      redirect('/sante/accueil')
  if (actorType === 'pharmacie')  redirect('/pharmacie/accueil')
  if (actorType === 'couverture') redirect('/couverture/accueil')
  if (actorType === 'admin')      redirect('/admin/accueil')
  if (actorType === 'super_admin') redirect('/super-admin/accueil')

  // Nouvel utilisateur Google → choisir son profil
  redirect('/inscription/choisir-profil')
}
