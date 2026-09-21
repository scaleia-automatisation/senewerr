import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Invite un nouveau gestionnaire à rejoindre la mutuelle.
// Envoie un email d'invitation Supabase Auth.
// L'activation (création du profil + liaison mutuelle) se fait
// via un trigger DB ou au premier login.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'gestionnaire_mutuelle') {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { email, nom } = body ?? {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return errorResponse('INVALID_BODY', 'email valide requis', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: prof } = await admin.from('profiles').select('mutuelle_id').eq('id', auth.profileId).single()
  let mutuelleId = prof?.mutuelle_id
  if (!mutuelleId) {
    const { data: mg } = await admin.from('mutuelles_gestionnaires')
      .select('mutuelle_id').eq('gestionnaire_id', auth.profileId).eq('actif', true).limit(1).single()
    mutuelleId = mg?.mutuelle_id
  }
  if (!mutuelleId) return errorResponse('NOT_FOUND', 'Mutuelle introuvable', 404)

  const { data: mutuelle } = await admin.from('mutuelles').select('nom').eq('id', mutuelleId).single()

  // Vérifier que cet email n'est pas déjà gestionnaire actif
  const { data: existingProfile } = await admin.from('profiles')
    .select('id, role').ilike('email', email.trim()).maybeSingle()

  if (existingProfile) {
    // Vérifier si déjà lié à cette mutuelle
    const { data: existingLink } = await admin.from('mutuelles_gestionnaires')
      .select('id, actif').eq('gestionnaire_id', existingProfile.id).eq('mutuelle_id', mutuelleId).maybeSingle()
    if (existingLink?.actif) {
      return errorResponse('ALREADY_EXISTS', 'Ce gestionnaire est déjà actif sur cette mutuelle', 409)
    }
    // Ré-activer si existant mais inactif
    if (existingLink && !existingLink.actif) {
      await admin.from('mutuelles_gestionnaires')
        .update({ actif: true, invited_by: auth.profileId, updated_at: new Date().toISOString() })
        .eq('id', existingLink.id)
      return successResponse({ reactivated: true, message: 'Accès réactivé' })
    }
  }

  // Envoyer l'invitation Supabase Auth
  const { data: invited, error: inviteError } = await (admin.auth.admin as any).inviteUserByEmail(
    email.trim(),
    {
      data: {
        mutuelle_id: mutuelleId,
        invited_role: 'gestionnaire_mutuelle',
        invited_nom: nom?.trim() ?? '',
        invited_by: auth.profileId,
      },
      redirectTo: `${Deno.env.get('APP_URL') ?? 'https://app.senewerr.com'}/auth/accept-invitation`,
    }
  )

  if (inviteError) return errorResponse('INVITE_ERROR', inviteError.message, 500)

  // Pré-insérer la liaison (actif: false jusqu'à acceptation)
  // Si le profil existe déjà, l'insérer maintenant ; sinon un trigger le créera
  if (existingProfile) {
    await admin.from('mutuelles_gestionnaires').upsert({
      gestionnaire_id: existingProfile.id,
      mutuelle_id: mutuelleId,
      actif: false,
      invited_by: auth.profileId,
    }, { onConflict: 'gestionnaire_id,mutuelle_id' })
  } else {
    // Stocker l'invitation en attente pour que le trigger post-inscription puisse l'activer
    await admin.from('pending_invitations').insert({
      email: email.trim().toLowerCase(),
      mutuelle_id: mutuelleId,
      role: 'gestionnaire_mutuelle',
      invited_by: auth.profileId,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    }).select()
  }

  // Notifier le gestionnaire invitant
  await admin.from('notifications').insert({
    profile_id: auth.profileId,
    type: 'invitation_envoyee',
    titre: 'Invitation envoyée',
    message: `Invitation envoyée à ${email.trim()} pour rejoindre ${mutuelle?.nom ?? 'la mutuelle'}.`,
    urgence: 'info',
    mutuelle_id: mutuelleId,
  })

  return successResponse({ invited: true, email: email.trim() })
})
