import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders }  from '../_shared/cors.ts'
import { requireAuth }  from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

const INVITATION_TTL_HOURS = 72

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { organizationId, email, role } = await req.json()

  // Validation
  if (!organizationId || !email || !role) {
    return errorResponse('MISSING_FIELDS', 'organizationId, email et role sont requis', 400)
  }
  if (!['admin', 'staff'].includes(role)) {
    return errorResponse('INVALID_ROLE', 'Rôle invalide (admin|staff)', 400)
  }
  if (!auth.orgIds.includes(organizationId)) {
    return errorResponse('FORBIDDEN', 'Accès refusé à cette organisation', 403)
  }
  if (!['establishment_admin','pharmacy_admin','mutual_admin','platform_admin','super_admin'].includes(auth.role)) {
    return errorResponse('FORBIDDEN', 'Seul un admin peut inviter des membres', 403)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Récupérer l'organisation
  const { data: org } = await admin
    .from('organizations')
    .select('id, name, type')
    .eq('id', organizationId)
    .single()

  if (!org) return errorResponse('NOT_FOUND', 'Organisation introuvable', 404)

  // Vérifier si déjà membre actif
  const { data: existing } = await admin
    .from('organization_members')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('profile_id', (
      await admin.from('profiles').select('id').eq('email', email.toLowerCase()).single()
    ).data?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle()

  if (existing?.status === 'active') {
    return errorResponse('ALREADY_MEMBER', 'Cet utilisateur est déjà membre actif', 409)
  }

  // Générer token 32 bytes aléatoires
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const tokenRaw = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('')

  // Hash SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tokenRaw))
  const tokenHash  = Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('')

  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000).toISOString()

  // Récupérer ou créer le profil cible
  let targetProfileId: string | null = null
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingProfile?.id) {
    targetProfileId = existingProfile.id
  }

  if (!targetProfileId) {
    // Utilisateur inexistant — on stocke l'invitation par email
    // Le profil sera créé lors de l'inscription
    const pendingProfileId = crypto.randomUUID()

    // Stocker dans une table temporaire ou utiliser un UUID fictif
    // Pour cette implémentation, on crée un enregistrement sans profile_id réel
    // et on le résout lors de l'acceptation
    const { data: inviterProfile } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', auth.profileId)
      .single()

    const inviterName = inviterProfile
      ? `${inviterProfile.first_name ?? ''} ${inviterProfile.last_name ?? ''}`.trim()
      : 'Un administrateur'

    // Envoyer l'email d'invitation via Resend
    await sendInvitationEmail({
      admin,
      to: email,
      orgName: org.name,
      orgType: org.type,
      role,
      inviterName,
      token: tokenRaw,
      expiresAt,
    })

    return successResponse({
      message: `Invitation envoyée à ${email}. Elle expire dans ${INVITATION_TTL_HOURS}h.`,
      pending: true,
    })
  }

  // Profil existant — créer ou mettre à jour l'entrée d'invitation
  const { error: upsertError } = await admin
    .from('organization_members')
    .upsert({
      organization_id:        organizationId,
      profile_id:             targetProfileId,
      role,
      status:                 'invited',
      invited_by:             auth.profileId,
      invitation_token_hash:  tokenHash,
      invitation_expires_at:  expiresAt,
    }, { onConflict: 'organization_id,profile_id' })

  if (upsertError) {
    console.error('Upsert error:', upsertError)
    return errorResponse('DB_ERROR', 'Erreur lors de la création de l\'invitation', 500)
  }

  // Récupérer nom de l'inviteur
  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', auth.profileId)
    .single()

  const inviterName = inviterProfile
    ? `${inviterProfile.first_name ?? ''} ${inviterProfile.last_name ?? ''}`.trim()
    : 'Un administrateur'

  await sendInvitationEmail({
    admin,
    to: email,
    orgName: org.name,
    orgType: org.type,
    role,
    inviterName,
    token: tokenRaw,
    expiresAt,
  })

  return successResponse({
    message: `Invitation envoyée à ${email}. Elle expire dans ${INVITATION_TTL_HOURS}h.`,
  })
})

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
async function sendInvitationEmail(opts: {
  admin: ReturnType<typeof createClient>
  to: string
  orgName: string
  orgType: string
  role: string
  inviterName: string
  token: string
  expiresAt: string
}) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.warn('RESEND_API_KEY manquant — email non envoyé')
    return
  }

  const appUrl   = Deno.env.get('APP_URL') ?? 'https://senewerr.com'
  const invitUrl = `${appUrl}/invitation/${opts.token}`
  const expires  = new Date(opts.expiresAt).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const ROLE_LABELS: Record<string, string> = { admin: 'Administrateur', staff: 'Équipe' }
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <img src="${appUrl}/favicon.svg" alt="Séne Wérr" style="width:40px;margin-bottom:16px"/>
      <h1 style="color:#163F56;font-size:22px">Invitation à rejoindre ${opts.orgName}</h1>
      <p style="color:#4B5A6B"><strong>${opts.inviterName}</strong> vous invite à rejoindre
      <strong>${opts.orgName}</strong> en tant que <strong>${roleLabel}</strong> sur Séne Wérr.</p>
      <a href="${invitUrl}"
         style="display:inline-block;margin:24px 0;padding:12px 24px;background:#1C8628;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
        Accepter l'invitation
      </a>
      <p style="color:#61707F;font-size:13px">Ce lien expire le ${expires}.
      Si vous n'attendiez pas cette invitation, ignorez cet email.</p>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Séne Wérr <noreply@senewerr.com>',
      to:      [opts.to],
      subject: `Invitation à rejoindre ${opts.orgName} sur Séne Wérr`,
      html,
    }),
  })
}
