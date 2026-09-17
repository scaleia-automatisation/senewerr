import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse } from './error.ts'

export type AuthContext = {
  userId: string
  profileId: string
  role: string
  orgIds: string[]
}

export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return errorResponse('UNAUTHORIZED', 'Token manquant', 401)

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !user) return errorResponse('UNAUTHORIZED', 'Token invalide ou expiré', 401)

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) return errorResponse('UNAUTHORIZED', 'Profil introuvable', 401)
  if (profile.status === 'suspended') return errorResponse('FORBIDDEN', 'Compte suspendu', 403)
  if (profile.status === 'deleted') return errorResponse('UNAUTHORIZED', 'Compte supprimé', 401)

  const { data: memberships } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('profile_id', profile.id)
    .eq('status', 'active')

  return {
    userId: user.id,
    profileId: profile.id,
    role: profile.role,
    orgIds: memberships?.map((m: { organization_id: string }) => m.organization_id) ?? []
  }
}

export function isAdmin(role: string): boolean {
  return role === 'platform_admin' || role === 'super_admin'
}
