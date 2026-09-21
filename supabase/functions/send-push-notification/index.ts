import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Génération du JWT Google Service Account ────────────────────────────────

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payload = btoa(JSON.stringify({
    iss:   serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${header}.${payload}`

  // Importe la clé privée RSA du service account
  const pemBody = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  const { access_token } = await tokenRes.json()
  return access_token as string
}

// ── Envoi d'un message FCM v1 ───────────────────────────────────────────────

async function sendFcmMessage(
  token: string,
  notification: { title: string; body: string },
  data: Record<string, string>,
  projectId: string,
  accessToken: string,
): Promise<{ success: boolean; expired: boolean }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification,
          data,
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
            },
          },
        },
      }),
    },
  )

  const expired = res.status === 404 || res.status === 410
  return { success: res.ok, expired }
}

// ── Handler principal ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_id, title, body = '', url = '/', icon = '/icons/icon-192.png', notification_type } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY')!)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Vérifier les préférences de l'utilisateur si notification_type est fourni
    const URGENCES = ['sla_depasse', 'alerte_tresorerie', 'erreur_paiement']
    const isUrgent = URGENCES.includes(notification_type ?? '')

    if (notification_type) {
      const { data: prefRow } = await supabase
        .from('notification_preferences')
        .select('preferences')
        .eq('user_id', user_id)
        .maybeSingle()
      const prefs = (prefRow as any)?.preferences ?? {}

      // Toggle par type (false = désactivé)
      if (prefs[notification_type] === false) {
        return new Response(JSON.stringify({ sent: 0, skipped: 'user_preference' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Plages de silence (ex. 22h-7h) — sauf urgences
      if (!isUrgent && prefs.silence_heures) {
        const { debut, fin } = prefs.silence_heures as { debut: number; fin: number }
        const nowHour = new Date().getUTCHours()
        // Gestion du cas "croise minuit" (ex. debut=22, fin=7)
        const isSilent = debut > fin
          ? (nowHour >= debut || nowHour < fin)
          : (nowHour >= debut && nowHour < fin)
        if (isSilent) {
          return new Response(JSON.stringify({ sent: 0, skipped: 'silence_hours' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .eq('user_id', user_id)

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getAccessToken(serviceAccount)

    const results = await Promise.allSettled(
      subs.map(s => sendFcmMessage(
        s.fcm_token,
        { title, body },
        { url, icon },
        serviceAccount.project_id,
        accessToken,
      )),
    )

    // Supprime les tokens expirés
    const expiredTokens = subs
      .filter((_, i) => {
        const r = results[i]
        return r.status === 'fulfilled' && r.value.expired
      })
      .map(s => s.fcm_token)

    if (expiredTokens.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('fcm_token', expiredTokens)
    }

    const sent = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-push-notification]', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
