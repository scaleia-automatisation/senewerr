import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { errorResponse } from '../_shared/error.ts'

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val).replace(/"/g, '""')
  // Wrap in quotes if contains semicolon, quote, or newline
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`
  }
  return str
}

function generateCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [headers.map(csvEscape).join(';')]
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(';'))
  }
  return '﻿' + lines.join('\r\n') // UTF-8 BOM + CRLF for Excel compatibility
}

// ---------------------------------------------------------------------------
// Audit log (best-effort)
// ---------------------------------------------------------------------------
async function writeAudit(
  db: ReturnType<typeof createClient>,
  actorId: string,
  action: string,
  result: 'success' | 'failure',
  cause?: string,
) {
  try {
    await (db as any).from('audit_logs').insert({
      action,
      actor_id: actorId,
      result,
      cause: cause ?? null,
    })
  } catch (e) {
    console.error('[audit_logs] write failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Report generators
// ---------------------------------------------------------------------------
async function generateAnalytics(
  db: ReturnType<typeof createClient>,
  filters: { start_date?: string; end_date?: string },
): Promise<string> {
  const { start_date, end_date } = filters

  // Aggregate MRR/ARR per month from active subscriptions + plan prices
  let query = db
    .from('subscriptions')
    .select(`
      id,
      created_at,
      status,
      subscription_plans!inner(monthly_price, yearly_price, name, code)
    `)
    .eq('status', 'active')

  if (start_date) query = query.gte('created_at', start_date)
  if (end_date)   query = query.lte('created_at', end_date)

  const { data: subs, error } = await query
  if (error) throw error

  // Group by month
  const byMonth: Record<string, { count: number; mrr: number }> = {}
  for (const sub of subs ?? []) {
    const month = sub.created_at?.slice(0, 7) ?? 'unknown'
    const plan  = (sub as any).subscription_plans
    const price = plan?.monthly_price ?? 0
    if (!byMonth[month]) byMonth[month] = { count: 0, mrr: 0 }
    byMonth[month].count += 1
    byMonth[month].mrr   += price
  }

  const headers = ['mois', 'abonnements_actifs', 'mrr_fcfa', 'arr_fcfa', 'arpu_fcfa']
  const rows = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { count, mrr }]) => ({
      mois:               month,
      abonnements_actifs: count,
      mrr_fcfa:           mrr,
      arr_fcfa:           mrr * 12,
      arpu_fcfa:          count > 0 ? Math.round(mrr / count) : 0,
    }))

  return generateCSV(headers, rows)
}

async function generatePayments(
  db: ReturnType<typeof createClient>,
  filters: { start_date?: string; end_date?: string },
): Promise<string> {
  let query = db
    .from('payments')
    .select(`
      id,
      payment_number,
      reservation_id,
      subscriber_id,
      amount,
      currency,
      provider,
      status,
      created_at,
      paid_at
    `)
    .order('created_at', { ascending: false })

  if (filters.start_date) query = query.gte('created_at', filters.start_date)
  if (filters.end_date)   query = query.lte('created_at', filters.end_date)

  const { data: payments, error } = await query
  if (error) throw error

  const headers = ['id', 'numero_paiement', 'commande_id', 'patient_id', 'montant', 'devise', 'psp', 'statut', 'date_creation', 'date_paiement']
  const rows = (payments ?? []).map(p => ({
    id:             p.id,
    numero_paiement: (p as any).payment_number ?? '',
    commande_id:    (p as any).reservation_id  ?? '',
    patient_id:     (p as any).subscriber_id   ?? '',
    montant:        (p as any).amount           ?? 0,
    devise:         (p as any).currency         ?? 'XOF',
    psp:            (p as any).provider         ?? '',
    statut:         (p as any).status           ?? '',
    date_creation:  (p as any).created_at       ?? '',
    date_paiement:  (p as any).paid_at          ?? '',
  }))

  return generateCSV(headers, rows)
}

async function generateOrders(
  db: ReturnType<typeof createClient>,
  filters: { start_date?: string; end_date?: string },
): Promise<string> {
  let query = (db as any)
    .from('pharmacy_reservations')
    .select(`
      id,
      reservation_number,
      patient_id,
      pharmacy_id,
      total_amount,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (filters.start_date) query = query.gte('created_at', filters.start_date)
  if (filters.end_date)   query = query.lte('created_at', filters.end_date)

  const { data: orders, error } = await query
  if (error) throw error

  const headers = ['id', 'numero_commande', 'patient_id', 'pharmacie_id', 'montant_total', 'statut', 'date_creation']
  const rows = (orders ?? []).map((o: any) => ({
    id:              o.id,
    numero_commande: o.reservation_number ?? '',
    patient_id:      o.patient_id         ?? '',
    pharmacie_id:    o.pharmacy_id        ?? '',
    montant_total:   o.total_amount       ?? 0,
    statut:          o.status             ?? '',
    date_creation:   o.created_at         ?? '',
  }))

  return generateCSV(headers, rows)
}

async function generateAudit(
  db: ReturnType<typeof createClient>,
  filters: { start_date?: string; end_date?: string },
): Promise<string> {
  let query = (db as any)
    .from('audit_logs')
    .select('id, created_at, actor_id, action, target_entity_type, target_entity_id, result, cause')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (filters.start_date) query = query.gte('created_at', filters.start_date)
  if (filters.end_date)   query = query.lte('created_at', filters.end_date)

  const { data: logs, error } = await query
  if (error) throw error

  const headers = ['date', 'acteur_id', 'action', 'entity_type', 'entity_id', 'resultat', 'cause']
  const rows = (logs ?? []).map((l: any) => ({
    date:        l.created_at             ?? '',
    acteur_id:   l.actor_id               ?? '',
    action:      l.action                 ?? '',
    entity_type: l.target_entity_type     ?? '',
    entity_id:   l.target_entity_id       ?? '',
    resultat:    l.result                 ?? '',
    cause:       l.cause                  ?? '',
  }))

  return generateCSV(headers, rows)
}

async function generateAiCost(
  db: ReturnType<typeof createClient>,
  filters: { start_date?: string; end_date?: string },
): Promise<string> {
  let query = (db as any)
    .from('ai_generations')
    .select('profile_id, cost_usd, created_at')
    .order('created_at', { ascending: false })

  if (filters.start_date) query = query.gte('created_at', filters.start_date)
  if (filters.end_date)   query = query.lte('created_at', filters.end_date)

  const { data: gens, error } = await query
  if (error) throw error

  // Aggregate per profile
  const byProfile: Record<string, { count: number; cost_usd: number }> = {}
  for (const g of gens ?? []) {
    const pid = g.profile_id ?? 'unknown'
    if (!byProfile[pid]) byProfile[pid] = { count: 0, cost_usd: 0 }
    byProfile[pid].count    += 1
    byProfile[pid].cost_usd += (g.cost_usd ?? 0)
  }

  // Exchange rate XOF ≈ 655.957 per USD (EUR/XOF fixed rate)
  const USD_TO_FCFA = 655.957

  const headers = ['profile_id', 'generations', 'cout_usd', 'cout_fcfa']
  const rows = Object.entries(byProfile)
    .sort(([, a], [, b]) => b.cost_usd - a.cost_usd)
    .map(([profileId, { count, cost_usd }]) => ({
      profile_id:  profileId,
      generations: count,
      cout_usd:    cost_usd.toFixed(4),
      cout_fcfa:   Math.round(cost_usd * USD_TO_FCFA),
    }))

  return generateCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Report type → generator map
// ---------------------------------------------------------------------------
type ReportType = 'analytics' | 'payments' | 'orders' | 'audit' | 'ai_cost'

const GENERATORS: Record<
  ReportType,
  (db: ReturnType<typeof createClient>, filters: any) => Promise<string>
> = {
  analytics: generateAnalytics,
  payments:  generatePayments,
  orders:    generateOrders,
  audit:     generateAudit,
  ai_cost:   generateAiCost,
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db          = createClient(supabaseUrl, serviceKey)

  let actorProfileId: string | undefined
  let reportType: string | undefined

  try {
    // Auth + role check
    const profile = await requireAuth(req)
    if (!['platform_admin', 'super_admin'].includes(profile.role)) {
      return errorResponse('FORBIDDEN', 'Accès réservé aux administrateurs de la plateforme', 403)
    }
    actorProfileId = profile.profileId

    const body = await req.json()
    reportType = body.type as ReportType
    const filters: { start_date?: string; end_date?: string; format?: string } = body.filters ?? {}

    if (!reportType || !GENERATORS[reportType as ReportType]) {
      return errorResponse('INVALID_REPORT_TYPE', `Type de rapport invalide: ${reportType}. Types disponibles: analytics, payments, orders, audit, ai_cost`)
    }

    const isPdf = filters.format === 'pdf'

    // Generate CSV content
    const csvContent = await GENERATORS[reportType as ReportType](db, filters)

    // Upload to Supabase Storage
    const timestamp  = Date.now()
    const extension  = isPdf ? 'pdf' : 'csv'
    const storagePath = `${reportType}/${timestamp}.${extension}`

    const csvBytes = new TextEncoder().encode(csvContent)

    const { data: uploaded, error: uploadErr } = await db.storage
      .from('exports')
      .upload(storagePath, csvBytes, {
        contentType: isPdf ? 'application/pdf' : 'text/csv; charset=utf-8',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[export-admin-report] storage upload error:', uploadErr)
      throw new Error('STORAGE_UPLOAD_FAILED')
    }

    // Generate signed URL (15 minutes = 900 seconds)
    const { data: signed, error: signErr } = await db.storage
      .from('exports')
      .createSignedUrl(uploaded.path, 900)

    if (signErr || !signed?.signedUrl) {
      console.error('[export-admin-report] signed URL error:', signErr)
      throw new Error('SIGNED_URL_FAILED')
    }

    // Audit success
    await writeAudit(db, actorProfileId, `admin.export.${reportType}`, 'success')

    const responseData = {
      ok:          true,
      url:         signed.signedUrl,
      path:        uploaded.path,
      format:      isPdf ? 'pdf' : 'csv',
      type:        reportType,
      expires_in:  900,
      generated_at: new Date().toISOString(),
    }

    return new Response(JSON.stringify({ data: responseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    const msg = err?.message ?? ''
    console.error('[export-admin-report] error:', msg, err)

    // Audit failure
    if (actorProfileId) {
      await writeAudit(db, actorProfileId, `admin.export.${reportType ?? 'unknown'}`, 'failure', msg)
    }

    if (msg === 'UNAUTHORIZED')          return errorResponse('UNAUTHORIZED',       'Authentification requise', 401)
    if (msg === 'PROFILE_NOT_FOUND')     return errorResponse('PROFILE_NOT_FOUND', 'Profil introuvable', 404)
    if (msg === 'STORAGE_UPLOAD_FAILED') return errorResponse('EXPORT_FAILED',     'Erreur lors de la génération du rapport', 500)
    if (msg === 'SIGNED_URL_FAILED')     return errorResponse('EXPORT_FAILED',     'Erreur lors de la génération du rapport', 500)

    return errorResponse('INTERNAL_ERROR', 'Erreur interne du serveur', 500)
  }
})
