import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders }  from '../_shared/cors.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { token, action } = await req.json()

  if (!token || !action) {
    return errorResponse('MISSING_FIELDS', 'token et action sont requis', 400)
  }
  if (!['preview', 'accept', 'refuse'].includes(action)) {
    return errorResponse('INVALID_ACTION', 'action doit être preview|accept|refuse', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Hash SHA-256 du token
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const tokenHash  = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')

  // Trouver l'invitation
  const { data: invitation, error: findError } = await admin
    .from('organization_members')
    .select(`
      id, organization_id, profile_id, role, status,
      invitation_expires_at, invited_by,
      organizations ( name, type ),
      profiles!organization_members_profile_id_fkey ( first_name, last_name, email )
    `)
    .eq('invitation_token_hash', tokenHash)
    .eq('status', 'invited')
    .maybeSingle()

  if (findError) {
    console.error('Find invitation error:', findError)
    return errorResponse('DB_ERROR', 'Erreur base de données', 500)
  }

  if (!invitation) {
    return errorResponse('NOT_FOUND', 'Invitation invalide ou déjà utilisée', 404, 'INVALID')
  }

  // Vérifier expiration
  if (new Date(invitation.invitation_expires_at) < new Date()) {
    return errorResponse('EXPIRED', 'Cette invitation a expiré (validité 72h)', 410, 'EXPIRED')
  }

  const org  = invitation.organizations as { name: string; type: string }
  const prof = invitation.profiles as { first_name?: string; last_name?: string; email?: string }

  // Récupérer nom de l'inviteur
  const { data: inviter } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', invitation.invited_by)
    .single()

  const inviterName = inviter
    ? `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim()
    : 'Un administrateur'

  if (action === 'preview') {
    return successResponse({
      invitation: {
        organization_name: org.name,
        organization_type: org.type,
        role:              invitation.role,
        invited_by_name:   inviterName,
        expires_at:        invitation.invitation_expires_at,
      },
    })
  }

  if (action === 'refuse') {
    await admin
      .from('organization_members')
      .update({
        status:               'refused',
        invitation_token_hash: null,
      })
      .eq('id', invitation.id)

    // Notifier l'inviteur
    await admin.from('notifications').insert({
      user_id: invitation.invited_by,
      type:    'system',
      title:   'Invitation refusée',
      body:    `${prof.first_name ?? prof.email ?? 'L\'invité'} a refusé de rejoindre ${org.name}.`,
    })

    return successResponse({ message: 'Invitation refusée.' })
  }

  // action === 'accept'
  // Vérifier si l'utilisateur courant est authentifié (Authorization header)
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  let acceptingUserId: string | null = null
  let acceptingProfileId: string | null = null

  if (jwt) {
    const { data: { user } } = await admin.auth.getUser(jwt)
    if (user) {
      acceptingUserId = user.id
      const { data: p } = await admin
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .single()
      acceptingProfileId = p?.id ?? null

      // Si l'invitation est pour un profil différent → erreur
      if (acceptingProfileId && invitation.profile_id &&
          acceptingProfileId !== invitation.profile_id) {
        return errorResponse(
          'WRONG_USER',
          'Cette invitation est destinée à un autre compte.',
          403,
        )
      }
    }
  }

  // Mettre à jour l'entrée
  const now = new Date().toISOString()
  const { error: acceptError } = await admin
    .from('organization_members')
    .update({
      status:                'active',
      joined_at:             now,
      invitation_token_hash: null,
      invitation_expires_at: null,
      ...(acceptingProfileId ? { profile_id: acceptingProfileId } : {}),
    })
    .eq('id', invitation.id)

  if (acceptError) {
    console.error('Accept error:', acceptError)
    return errorResponse('DB_ERROR', 'Erreur lors de l\'activation du membre', 500)
  }

  // Mettre à jour le rôle du profil si nécessaire
  if (acceptingProfileId) {
    const targetRole = roleForOrgMembership(org.type, invitation.role)
    if (targetRole) {
      await admin
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', acceptingProfileId)
    }
  }

  // Notifier l'inviteur
  await admin.from('notifications').insert({
    user_id: invitation.invited_by,
    type:    'system',
    title:   'Invitation acceptée',
    body:    `${prof.first_name ?? 'Le nouveau membre'} a rejoint ${org.name}.`,
  })

  return successResponse({ message: 'Bienvenue dans l\'organisation !' })
})

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function roleForOrgMembership(orgType: string, memberRole: string): string | null {
  const matrix: Record<string, Record<string, string>> = {
    establishment:      { admin: 'establishment_admin', staff: 'establishment_staff' },
    pharmacy:           { admin: 'pharmacy_admin',      staff: 'pharmacy_staff' },
    insurance_provider: { admin: 'mutual_admin',        staff: 'mutual_staff' },
  }
  return matrix[orgType]?.[memberRole] ?? null
}
