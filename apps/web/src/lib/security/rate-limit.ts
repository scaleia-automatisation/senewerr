// Spec 27.1 — Protection contre les tentatives de connexion abusives
// Implémentation légère via table Supabase (pas de Redis requis en phase initiale).

import { createClient } from '@/lib/supabase/server'

export type RateLimitResult = {
  allowed: boolean
  remaining: number       // tentatives restantes avant blocage
  reset_at: Date | null   // quand la fenêtre se réinitialise
  blocked_until: Date | null
}

const LIMITS: Record<string, { max: number; window_sec: number; block_sec: number }> = {
  login:          { max: 5,  window_sec: 300,  block_sec: 900  },  // 5 essais / 5 min → blocage 15 min
  otp_verify:     { max: 3,  window_sec: 120,  block_sec: 600  },  // 3 essais OTP / 2 min → 10 min
  password_reset: { max: 3,  window_sec: 3600, block_sec: 3600 },  // 3 demandes / heure
  api_sensitive:  { max: 20, window_sec: 60,   block_sec: 300  },  // 20 req / min
  admin_action:   { max: 50, window_sec: 60,   block_sec: 120  },  // 50 actions admin / min
}

type AttemptInsert = {
  insert: (v: unknown) => Promise<{ error: unknown }>
}
type AttemptQuery = {
  select: (q: string) => {
    eq: (c: string, v: string) => {
      gte: (c: string, v: string) => Promise<{ data: unknown[] | null }>
    }
  }
}

export async function checkRateLimit(
  identifier: string,  // IP, user_id, phone_hash…
  action: keyof typeof LIMITS
): Promise<RateLimitResult> {
  const limit = LIMITS[action] ?? LIMITS['api_sensitive']
  const windowStart = new Date(Date.now() - limit.window_sec * 1000)

  try {
    const supabase = await createClient()

    // Récupérer les tentatives récentes
    const { data } = await (supabase.from('login_attempts') as unknown as AttemptQuery)
      .select('id, created_at, blocked_until')
      .eq('identifier', identifier)
      .gte('created_at', windowStart.toISOString())

    const attempts = (data ?? []) as unknown as { id: string; created_at: string; blocked_until: string | null }[]

    // Vérifier un blocage actif
    const latestBlock = attempts
      .filter(a => a.blocked_until && new Date(a.blocked_until) > new Date())
      .sort((a, b) => new Date(b.blocked_until!).getTime() - new Date(a.blocked_until!).getTime())[0]

    if (latestBlock?.blocked_until) {
      return {
        allowed: false,
        remaining: 0,
        reset_at: null,
        blocked_until: new Date(latestBlock.blocked_until),
      }
    }

    const count = attempts.length
    const remaining = Math.max(0, limit.max - count - 1)
    const allowed = count < limit.max

    // Enregistrer la tentative
    const blockedUntil = !allowed
      ? new Date(Date.now() + limit.block_sec * 1000).toISOString()
      : null

    await (supabase.from('login_attempts') as unknown as AttemptInsert).insert({
      identifier,
      action,
      blocked_until: blockedUntil,
      created_at: new Date().toISOString(),
    })

    return {
      allowed,
      remaining,
      reset_at: new Date(Date.now() + limit.window_sec * 1000),
      blocked_until: blockedUntil ? new Date(blockedUntil) : null,
    }
  } catch {
    // Fail open : en cas d'erreur DB, laisser passer (préférer la disponibilité au blocage)
    return { allowed: true, remaining: 1, reset_at: null, blocked_until: null }
  }
}

export function formatBlockDuration(blockedUntil: Date): string {
  const ms = blockedUntil.getTime() - Date.now()
  if (ms <= 0) return 'quelques secondes'
  const min = Math.ceil(ms / 60000)
  if (min < 60) return `${min} minute${min > 1 ? 's' : ''}`
  return `${Math.ceil(min / 60)} heure${Math.ceil(min / 60) > 1 ? 's' : ''}`
}

// Nettoyage des tentatives expirées — à appeler depuis un cron (spec 27.1)
export async function purgeExpiredAttempts(): Promise<void> {
  try {
    const supabase = await createClient()
    type DeleteFn = {
      delete: () => { lt: (c: string, v: string) => Promise<{ error: unknown }> }
    }
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    await (supabase.from('login_attempts') as unknown as DeleteFn)
      .delete().lt('created_at', cutoff)
  } catch { /* silencieux */ }
}
