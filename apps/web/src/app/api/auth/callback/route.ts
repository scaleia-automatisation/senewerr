import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function dashboardFor(actorType: string | null): string {
  switch (actorType) {
    case 'patient':    return '/patient/accueil'
    case 'sante':      return '/sante/accueil'
    case 'pharmacie':  return '/pharmacie/accueil'
    case 'couverture': return '/couverture/accueil'
    case 'admin':
    case 'super_admin': return '/admin/accueil'
    default:           return '/patient/accueil'
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? ''

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      let destination = next.startsWith('/') ? next : ''

      if (!destination && user) {
        const { data: profile } = await supabase
          .from('profils')
          .select('actor_type')
          .eq('id', user.id)
          .single()
        destination = dashboardFor(profile?.actor_type ?? null)
      }

      if (!destination) destination = '/patient/accueil'

      const forwardedHost = request.headers.get('x-forwarded-host')
      const base = process.env.NODE_ENV === 'development' || !forwardedHost
        ? origin
        : `https://${forwardedHost}`
      return NextResponse.redirect(`${base}${destination}`)
    }
  }

  return NextResponse.redirect(`${origin}/connexion?error=auth_callback_failed`)
}
