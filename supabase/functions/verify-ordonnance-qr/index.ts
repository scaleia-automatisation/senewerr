import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body: { qr_token }
// Caller must be authenticated (pharmacist role: 'pharmacist' or 'professional')
// Returns: ordonnance + patient info + medicaments list if valid

async function verifyHmac(secret: string, data: string, sigB64url: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    // Convert base64url back to ArrayBuffer
    const sigB64 = sigB64url.replace(/-/g, '+').replace(/_/g, '/') + '=='
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  // Only professional or pharmacist can verify
  if (!['professional', 'pharmacist'].includes(auth.role)) {
    return errorResponse('FORBIDDEN', 'Accès refusé', 403)
  }

  const body = await req.json().catch(() => null)
  const { qr_token } = body ?? {}

  if (!qr_token || typeof qr_token !== 'string') {
    return errorResponse('INVALID_BODY', 'qr_token requis', 400)
  }

  const parts = qr_token.split('.')
  if (parts.length !== 3) return errorResponse('INVALID_TOKEN', 'Token malformé', 400)

  const [header, payload, sig] = parts

  // Verify HMAC signature
  const hmacSecret = Deno.env.get('ORDONNANCE_HMAC_SECRET')
  if (!hmacSecret) return errorResponse('CONFIG_ERROR', 'Configuration manquante', 500)

  const valid = await verifyHmac(hmacSecret, `${header}.${payload}`, sig)
  if (!valid) return errorResponse('INVALID_SIGNATURE', 'Signature invalide', 401)

  // Decode payload
  let claims: { oid: string; pid: string; pra: string; iat: number; exp: number }
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '=='
    claims = JSON.parse(atob(b64))
  } catch {
    return errorResponse('INVALID_TOKEN', 'Payload invalide', 400)
  }

  // Check expiration
  if (claims.exp < Math.floor(Date.now() / 1000)) {
    return errorResponse('TOKEN_EXPIRED', 'Ordonnance expirée', 410)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch ordonnance from DB
  const { data: ord } = await admin.from('ordonnances')
    .select(`
      id, statut, date_prescription, date_expiration, notes, qr_token, qr_invalidated_at,
      praticien:praticien_id ( full_name ),
      patient:patient_id ( full_name, phone ),
      ordonnance_medicaments ( nom_medicament, dosage, posologie, duree, quantite, instructions_speciales, ordre )
    `)
    .eq('id', claims.oid)
    .maybeSingle()

  if (!ord) return errorResponse('NOT_FOUND', 'Ordonnance introuvable', 404)

  // Verify token matches what's stored (prevents token reuse after regeneration)
  if (ord.qr_token !== qr_token) {
    return errorResponse('TOKEN_REVOKED', 'Token révoqué ou remplacé', 401)
  }

  // Check invalidation
  if (ord.qr_invalidated_at) {
    return errorResponse('TOKEN_REVOKED', 'Ordonnance annulée', 410)
  }

  if (ord.statut === 'annulee') {
    return errorResponse('ORDONNANCE_ANNULEE', 'Ordonnance annulée', 410)
  }

  // Record dispensation audit
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  claims.pid,
    action:     'ordonnance_scanned',
    table_name: 'ordonnances',
    metadata:   { ordonnance_id: claims.oid, scanner_role: auth.role },
  }).catch(() => {})

  const meds = (ord.ordonnance_medicaments ?? []).sort((a: any, b: any) => a.ordre - b.ordre)

  return successResponse({
    ordonnance_id:     ord.id,
    statut:            ord.statut,
    date_prescription: ord.date_prescription,
    date_expiration:   ord.date_expiration,
    notes:             ord.notes,
    praticien_nom:     (ord.praticien as any)?.full_name ?? '—',
    patient_nom:       (ord.patient as any)?.full_name ?? '—',
    patient_phone:     (ord.patient as any)?.phone ?? null,
    medicaments:       meds,
  })
})
