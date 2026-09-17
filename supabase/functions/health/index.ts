// supabase/functions/health/index.ts
// Endpoint public qui vérifie toutes les dépendances critiques
// GET /health → { status: 'ok'|'degraded'|'down', dependencies: {...}, timestamp }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY')
const RESEND_KEY = Deno.env.get('RESEND_API_KEY')

type DepStatus = { ok: boolean; latency_ms: number; error?: string }

async function checkDb(): Promise<DepStatus> {
  const t0 = Date.now()
  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error } = await db.from('platform_settings').select('key').limit(1)
    if (error) throw error
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: 'DB connexion échouée' }
  }
}

async function checkStripe(): Promise<DepStatus> {
  if (!STRIPE_KEY) return { ok: false, latency_ms: 0, error: 'STRIPE_SECRET_KEY absent' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` }
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: 'Stripe inaccessible' }
  }
}

async function checkOpenAI(): Promise<DepStatus> {
  if (!OPENAI_KEY) return { ok: false, latency_ms: 0, error: 'OPENAI_API_KEY absent' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${OPENAI_KEY}` }
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: 'OpenAI inaccessible' }
  }
}

async function checkResend(): Promise<DepStatus> {
  if (!RESEND_KEY) return { ok: false, latency_ms: 0, error: 'RESEND_API_KEY absent' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${RESEND_KEY}` }
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return { ok: true, latency_ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, error: 'Resend inaccessible' }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const [db, stripe, openai, resend] = await Promise.all([
    checkDb(),
    checkStripe(),
    checkOpenAI(),
    checkResend(),
  ])

  const dependencies = { db, stripe, openai, resend }
  const allOk = Object.values(dependencies).every(d => d.ok)
  const anyDown = Object.values(dependencies).some(d => !d.ok)
  const status = allOk ? 'ok' : anyDown ? 'degraded' : 'down'

  const body = {
    status,
    dependencies,
    timestamp: new Date().toISOString(),
    version: Deno.env.get('APP_VERSION') ?? 'dev',
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: allOk ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Health-Check': '1',
    },
  })
})
