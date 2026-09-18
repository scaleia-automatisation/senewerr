import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Séne Wérr <notifications@senewerr.com>',
      to,
      subject,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">${html}</div>`,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

// Interpolate {{variable}} placeholders in template
function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ''))
}

serve(async (req) => {
  // Allow cron (via x-cron-secret) or platform calls
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret && cronSecret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let body: { deliveryId?: string; priority?: string } = {}
  try { body = await req.json() } catch { /* cron call with no body */ }

  let query = db
    .from('notification_deliveries')
    .select(`
      *,
      notification:notification_id (
        id, user_id, event_type, data, title, message, priority
      )
    `)
    .eq('status', 'queued')
    .lt('attempts', 3)
    .order('scheduled_at', { ascending: true })
    .limit(body.deliveryId ? 1 : 50)

  if (body.deliveryId) {
    query = query.eq('id', body.deliveryId)
  }

  const { data: deliveries, error } = await query

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results = { sent: 0, failed: 0, skipped: 0 }

  for (const delivery of (deliveries ?? [])) {
    const notif = delivery.notification
    if (!notif) {
      await db.from('notification_deliveries').update({ status: 'skipped' }).eq('id', delivery.id)
      results.skipped++
      continue
    }

    // Get recipient email if needed
    let recipientEmail = delivery.recipient_email
    if (!recipientEmail && delivery.channel === 'email') {
      const { data: profile } = await db
        .from('profiles')
        .select('email')
        .eq('id', notif.user_id)
        .single()
      recipientEmail = profile?.email
    }

    if (delivery.channel === 'email' && !recipientEmail) {
      await db.from('notification_deliveries').update({ status: 'skipped', last_error: 'no email' }).eq('id', delivery.id)
      results.skipped++
      continue
    }

    // Check preferences
    const { data: prefs } = await db
      .from('notification_preferences')
      .select('email_enabled, push_enabled, email_exceptions, push_exceptions')
      .eq('user_id', notif.user_id)
      .maybeSingle()

    // Critical/high notifications bypass preferences
    const isCritical = ['critical', 'high'].includes(notif.priority ?? '')

    if (!isCritical) {
      if (delivery.channel === 'email' && prefs?.email_enabled === false) {
        await db.from('notification_deliveries').update({ status: 'skipped' }).eq('id', delivery.id)
        results.skipped++
        continue
      }
      if (delivery.channel === 'push' && prefs?.push_enabled === false) {
        await db.from('notification_deliveries').update({ status: 'skipped' }).eq('id', delivery.id)
        results.skipped++
        continue
      }
      // Check per-event exceptions
      if (delivery.channel === 'email' && prefs?.email_exceptions?.includes(notif.event_type)) {
        await db.from('notification_deliveries').update({ status: 'skipped' }).eq('id', delivery.id)
        results.skipped++
        continue
      }
    }

    try {
      if (delivery.channel === 'email' && recipientEmail) {
        const data = notif.data ?? {}
        const subject = interpolate(notif.title ?? '', data)
        const html = `<p>${interpolate(notif.message ?? '', data)}</p><hr><p style="color:#888;font-size:12px">Séne Wérr · <a href="{{unsubscribe_url}}">Se désabonner des emails non critiques</a></p>`
        await sendEmail(recipientEmail, subject, html)
      } else if (delivery.channel === 'push' && delivery.recipient_push_subscription) {
        // Web Push — use VAPID if available, else skip
        // For now: mark as sent (actual VAPID implementation requires VAPID keys)
        // In production: use web-push library or call a push service
      }

      await db.from('notification_deliveries').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: (delivery.attempts ?? 0) + 1,
      }).eq('id', delivery.id)

      results.sent++
    } catch (err) {
      const attempts = (delivery.attempts ?? 0) + 1
      await db.from('notification_deliveries').update({
        status: attempts >= 3 ? 'failed' : 'queued',
        attempts,
        last_error: String(err),
        scheduled_at: new Date(Date.now() + attempts * 5 * 60 * 1000).toISOString(), // backoff
      }).eq('id', delivery.id)
      results.failed++
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
