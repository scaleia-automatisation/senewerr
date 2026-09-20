import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore — npm specifier résolu par Deno
import webpush from 'npm:web-push@3'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@senewer.sn'

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, url = '/', icon = '/icons/icon-192.png' } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body, icon, url })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    )

    // Supprime les souscriptions expirées (410 Gone)
    const expired = subs.filter((_, i) => {
      const r = results[i]
      return r.status === 'rejected' && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404)
    })
    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired.map(s => s.endpoint))
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-push-notification]', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
