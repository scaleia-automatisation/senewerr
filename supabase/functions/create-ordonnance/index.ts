import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse, successResponse } from '../_shared/error.ts'

// Body:
// { patient_id, consultation_id?, medicaments: [{ nom, dosage?, posologie?, duree?, quantite?, instructions? }],
//   notes?, date_expiration? }

function b64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function signHmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let auth: Awaited<ReturnType<typeof requireAuth>>
  try { auth = await requireAuth(req) }
  catch { return errorResponse('UNAUTHORIZED', 'Non autorisé', 401) }

  if (auth.role !== 'professional') return errorResponse('FORBIDDEN', 'Accès refusé', 403)

  const body = await req.json().catch(() => null)
  const { patient_id, consultation_id, medicaments, notes, date_expiration } = body ?? {}

  if (!patient_id) return errorResponse('INVALID_BODY', 'patient_id requis', 400)
  if (!Array.isArray(medicaments) || medicaments.length === 0) {
    return errorResponse('INVALID_BODY', 'medicaments requis (non vide)', 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify active care relationship
  const { data: rel } = await admin
    .from('praticien_patients')
    .select('id')
    .eq('praticien_id', auth.profileId)
    .eq('patient_id', patient_id)
    .eq('actif', true)
    .maybeSingle()

  if (!rel) return errorResponse('FORBIDDEN', 'Pas de relation de soin active', 403)

  // Create ordonnance record
  const expiresAt = date_expiration
    ? new Date(date_expiration).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: ord, error: ordErr } = await admin.from('ordonnances').insert({
    praticien_id:      auth.profileId,
    patient_id,
    consultation_id:   consultation_id ?? null,
    statut:            'active',
    notes:             notes ?? null,
    date_prescription: new Date().toISOString(),
    date_expiration:   expiresAt,
  }).select('id').single()

  if (ordErr || !ord) {
    console.error('ordonnance insert error:', ordErr)
    return errorResponse('DB_ERROR', 'Erreur création ordonnance', 500)
  }

  // Insert medicaments
  const medsRows = (medicaments as any[]).map((m, i) => ({
    ordonnance_id:          ord.id,
    nom_medicament:         String(m.nom ?? '').trim(),
    dosage:                 m.dosage ?? null,
    posologie:              m.posologie ?? null,
    duree:                  m.duree ?? null,
    quantite:               m.quantite ?? null,
    instructions_speciales: m.instructions ?? null,
    ordre:                  i,
  }))
  await admin.from('ordonnance_medicaments').insert(medsRows)

  // Generate HMAC-signed QR token (JWT-like: header.payload.sig)
  const hmacSecret = Deno.env.get('ORDONNANCE_HMAC_SECRET')
  if (!hmacSecret) {
    console.error('ORDONNANCE_HMAC_SECRET not set')
    return errorResponse('CONFIG_ERROR', 'Configuration manquante', 500)
  }

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'ORD' }))
  const payload = b64url(JSON.stringify({
    oid: ord.id,
    pid: patient_id,
    pra: auth.profileId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
  }))
  const sigInput = `${header}.${payload}`
  const signature = await signHmac(hmacSecret, sigInput)
  const qrToken = `${sigInput}.${signature}`

  // Persist token
  await admin.from('ordonnances').update({ qr_token: qrToken }).eq('id', ord.id)

  // Generate QR Data URL server-side (client never generates the QR)
  let qrDataUrl: string | null = null
  try {
    // @ts-ignore esm.sh dynamic import in Deno
    const QRCode = (await import('https://esm.sh/qrcode@1.5.3')).default
    qrDataUrl = await QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
    })
  } catch (e) {
    console.warn('QR generation failed, returning token only:', e)
  }

  // Notify patient (push + in-app)
  const { data: praticien } = await admin.from('profiles')
    .select('full_name').eq('id', auth.profileId).single()
  const drNom = praticien?.full_name ? `Dr. ${praticien.full_name}` : 'Votre médecin'

  await admin.from('notifications').insert({
    user_id: patient_id,
    type:    'ordonnance_disponible',
    titre:   'Ordonnance disponible',
    corps:   `Une ordonnance a été rédigée par ${drNom}. Présentez le QR code à votre pharmacie.`,
    data:    { ordonnance_id: ord.id },
  }).catch(() => {})

  // Audit log
  await admin.from('audit_logs').insert({
    actor_id:   auth.profileId,
    target_id:  patient_id,
    action:     'ordonnance_created',
    table_name: 'ordonnances',
    metadata:   {
      ordonnance_id:   ord.id,
      consultation_id: consultation_id ?? null,
      nb_medicaments:  medicaments.length,
    },
  }).catch(() => {})

  return successResponse({
    ordonnance_id:   ord.id,
    qr_token:        qrToken,
    qr_data_url:     qrDataUrl,
    date_expiration: expiresAt,
  })
})
