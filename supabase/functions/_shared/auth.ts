import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthContext {
  userId: string
  profileId: string
  role: string
  orgIds: string[]
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('UNAUTHORIZED')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('UNAUTHORIZED')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  if (profileErr || !profile) throw new Error('PROFILE_NOT_FOUND')

  const { data: memberships } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('profile_id', profile.id)
    .eq('status', 'active')

  const orgIds = (memberships ?? []).map((m: any) => m.organization_id)

  return { userId: user.id, profileId: profile.id, role: profile.role, orgIds }
}
