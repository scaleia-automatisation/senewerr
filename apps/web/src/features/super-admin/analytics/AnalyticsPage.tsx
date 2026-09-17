import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { KpiTile } from '@/components/ui/KpiTile'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

// ── Types ─────────────────────────────────────────────────────
type Period = '7j' | '30j' | '90j' | '12m'

interface MonthRevenue {
  month: string // "YYYY-MM"
  subscriptions: number
  commissions: number
  packs: number
}

interface ActorShare {
  label: string
  amount: number
}

interface JourneyPoint {
  date: string
  appointments: number
  reservations: number
  withdrawals: number
}

interface PspRow {
  psp: string
  paid: number
  failed: number
}

interface AiDay {
  date: string
  cost: number
  billed: number
}

interface KpiData {
  mrr: number
  arr: number
  churnPct: number
  arpu: number
  convPct: number
}

// ── Helpers ───────────────────────────────────────────────────
function periodToDays(p: Period) {
  return p === '7j' ? 7 : p === '30j' ? 30 : p === '90j' ? 90 : 365
}

function since(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
}

function monthKey(iso: string) {
  return iso.substring(0, 7)
}

// ── SVG Charts ────────────────────────────────────────────────
function BarChart({ data, keys, colors, labels }: {
  data: { label: string; [k: string]: number | string }[]
  keys: string[]
  colors: string[]
  labels: string[]
}) {
  if (!data.length) return <EmptyChart />
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => Number(d[k]) || 0)), 1)
  const W = 600
  const H = 200
  const PAD = { top: 10, right: 10, bottom: 36, left: 50 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const groupW = chartW / data.length
  const barW = Math.min((groupW / keys.length) - 2, 24)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Revenus par source">
      {/* Y-axis labels */}
      {[0, 0.5, 1].map(t => {
        const y = PAD.top + chartH * (1 - t)
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y} stroke="var(--line)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)">
              {fmt(maxVal * t / 1000)}k
            </text>
          </g>
        )
      })}
      {/* Bars */}
      {data.map((d, gi) => {
        const gx = PAD.left + gi * groupW
        return (
          <g key={gi}>
            {keys.map((k, ki) => {
              const val = Number(d[k]) || 0
              const bh = (val / maxVal) * chartH
              const bx = gx + ki * (barW + 2) + (groupW - keys.length * (barW + 2)) / 2
              const by = PAD.top + chartH - bh
              return (
                <rect key={k} x={bx} y={by} width={barW} height={Math.max(bh, 1)} fill={colors[ki]} rx={2}>
                  <title>{labels[ki]}: {fmt(val)} XOF</title>
                </rect>
              )
            })}
            <text x={gx + groupW / 2} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
              {String(d.label)}
            </text>
          </g>
        )
      })}
      {/* Legend */}
      {keys.map((k, i) => (
        <g key={k} transform={`translate(${PAD.left + i * 110}, ${H - 8})`}>
          <rect width={8} height={8} fill={colors[i]} rx={2} />
          <text x={12} y={8} fontSize={9} fill="var(--ink-2)">{labels[i]}</text>
        </g>
      ))}
    </svg>
  )
}

function LineSparklines({ data, keys, colors, labels }: {
  data: { date: string; [k: string]: number | string }[]
  keys: string[]
  colors: string[]
  labels: string[]
}) {
  if (!data.length) return <EmptyChart />
  const W = 600
  const H = 120
  const PAD = { top: 8, right: 8, bottom: 24, left: 8 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom
  const n = data.length

  return (
    <div className="space-y-s-3">
      {keys.map((k, ki) => {
        const vals = data.map(d => Number(d[k]) || 0)
        const max = Math.max(...vals, 1)
        const pts = vals.map((v, i) => `${PAD.left + (i / (n - 1)) * chartW},${PAD.top + (1 - v / max) * chartH}`).join(' ')
        return (
          <div key={k}>
            <div className="flex justify-between mb-s-1">
              <span className="text-small text-ink-2">{labels[ki]}</span>
              <span className="text-small font-semibold text-ink">{fmt(vals[vals.length - 1])}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={labels[ki]}>
              <polyline
                points={pts}
                fill="none"
                stroke={colors[ki]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0 || i === n - 1).map((d, i, arr) => {
                const origIdx = data.indexOf(d)
                const x = PAD.left + (origIdx / (n - 1)) * chartW
                return (
                  <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--ink-3)">
                    {String(d.date).substring(5)}
                  </text>
                )
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ shares }: { shares: ActorShare[] }) {
  const total = shares.reduce((s, a) => s + a.amount, 0)
  if (!total) return <EmptyChart />
  const COLORS = ['var(--primary)', 'var(--accent)', 'var(--status-success)', 'var(--status-pending)']
  const R = 70, CX = 80, CY = 80, inner = 40
  let startAngle = -Math.PI / 2

  const arcs = shares.map((s, i) => {
    const angle = (s.amount / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const ix1 = CX + inner * Math.cos(startAngle)
    const iy1 = CY + inner * Math.sin(startAngle)
    const ix2 = CX + inner * Math.cos(endAngle)
    const iy2 = CY + inner * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M${ix1},${iy1} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${inner},${inner} 0 ${large},0 ${ix1},${iy1}`
    startAngle = endAngle
    return { d, color: COLORS[i % COLORS.length], pct: Math.round((s.amount / total) * 100), label: s.label }
  })

  return (
    <div className="flex items-center gap-s-4">
      <svg viewBox="0 0 160 160" className="w-32 shrink-0" aria-label="Répartition revenus">
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color}><title>{a.label}: {a.pct}%</title></path>)}
      </svg>
      <div className="space-y-s-2">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-s-2">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: a.color }} />
            <span className="text-small text-ink-2">{a.label}</span>
            <span className="text-small font-semibold text-ink ml-auto">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg bg-surface-2">
      <p className="text-small text-ink-3">Données insuffisantes</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  useAdminAudit('super-admin-analytics')
  useSuperAdminContext()

  const [period, setPeriod] = useState<Period>('30j')
  const [actorFilter, setActorFilter] = useState('all')
  const [segmentFilter, setSegmentFilter] = useState('all')
  const [plans, setPlans] = useState<{ code: string; name: string }[]>([])

  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [monthRevenue, setMonthRevenue] = useState<MonthRevenue[]>([])
  const [actorShares, setActorShares] = useState<ActorShare[]>([])
  const [journey, setJourney] = useState<JourneyPoint[]>([])
  const [pspStats, setPspStats] = useState<PspRow[]>([])
  const [aiData, setAiData] = useState<AiDay[]>([])
  const [netHealth, setNetHealth] = useState({ pros: 0, pharmacies: 0, mutuelles: 0 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(supabase as any).from('subscription_plans').select('code, name').order('name')
      .then(({ data }: { data: { code: string; name: string }[] | null }) => setPlans(data ?? []))
  }, [])

  useEffect(() => { loadAll() }, [period, actorFilter, segmentFilter])

  async function loadAll() {
    setLoading(true)
    setError(null)
    const days = periodToDays(period)
    const sinceDate = since(days)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    try {
      const [
        { data: subs },
        { data: invoices },
        { data: commissions },
        { data: creditPurchases },
        { data: appts },
        { data: reservations },
        { data: withdrawals },
        { data: payments },
        { data: aiLogs },
        { data: cancelledSubs },
      ] = await Promise.all([
        // Active subscriptions for MRR
        (supabase as any)
          .from('subscriptions')
          .select('billing_interval, status, subscription_plans(price_monthly, price_yearly)')
          .in('status', ['active', 'past_due']),
        // Invoices by month for revenue chart
        (supabase as any)
          .from('invoices')
          .select('amount, paid_at, type, status')
          .eq('status', 'paid')
          .gte('paid_at', sinceDate),
        // Commission entries
        (supabase as any)
          .from('commission_entries')
          .select('commission_amount, created_at, acteur_role')
          .gte('created_at', sinceDate),
        // Credit pack purchases
        (supabase as any)
          .from('credit_pack_purchases')
          .select('amount_paid, purchased_at')
          .gte('purchased_at', sinceDate),
        // Appointments for journey
        (supabase as any)
          .from('appointments')
          .select('created_at')
          .gte('created_at', sinceDate)
          .limit(5000),
        // Reservations
        (supabase as any)
          .from('reservations')
          .select('created_at')
          .gte('created_at', sinceDate)
          .limit(5000),
        // Withdrawals
        (supabase as any)
          .from('withdrawal_requests')
          .select('created_at')
          .gte('created_at', sinceDate)
          .limit(5000),
        // Payments by PSP
        (supabase as any)
          .from('payments')
          .select('provider, status, amount')
          .gte('created_at', sinceDate),
        // AI logs for cost vs billed
        (supabase as any)
          .from('ai_usage_logs')
          .select('created_at, cost_usd, credits_used')
          .gte('created_at', sinceDate)
          .limit(2000),
        // Cancelled subs this month
        (supabase as any)
          .from('subscriptions')
          .select('id')
          .eq('status', 'cancelled')
          .gte('cancelled_at', monthStart),
      ])

      // ── KPI: MRR ──────────────────────────────────────────────
      let mrr = 0
      for (const s of subs ?? []) {
        const plan = (s as any).subscription_plans
        if (!plan) continue
        if (s.billing_interval === 'year') mrr += (plan.price_yearly ?? 0) / 12
        else mrr += plan.price_monthly ?? 0
      }
      const arr = mrr * 12

      // ── KPI: Churn ──────────────────────────────────────────────
      const activeLast = (subs ?? []).length + (cancelledSubs ?? []).length
      const churnPct = activeLast > 0
        ? Math.round(((cancelledSubs ?? []).length / activeLast) * 100)
        : 0

      // ── KPI: ARPU ──────────────────────────────────────────────
      const totalRevThisMonth = (invoices ?? [])
        .filter((inv: any) => inv.paid_at >= monthStart)
        .reduce((s: number, inv: any) => s + (inv.amount ?? 0), 0)
      const payingAccounts = (subs ?? []).length || 1
      const arpu = Math.round(totalRevThisMonth / payingAccounts)

      // ── KPI: Conversion ──────────────────────────────────────────
      // Approximation: (invoices paid this month) / new subs in same period
      const invoicesThisMonth = (invoices ?? []).filter((inv: any) => inv.paid_at >= monthStart)
      const convPct = invoicesThisMonth.length > 0
        ? Math.min(100, Math.round((invoicesThisMonth.length / Math.max(payingAccounts, 1)) * 100))
        : 0

      setKpi({ mrr, arr, churnPct, arpu, convPct })

      // ── Revenue by month ──────────────────────────────────────────
      const revenueByMonth: Record<string, MonthRevenue> = {}
      for (const inv of invoices ?? []) {
        const m = monthKey(inv.paid_at ?? '')
        if (!revenueByMonth[m]) revenueByMonth[m] = { month: m, subscriptions: 0, commissions: 0, packs: 0 }
        if (inv.type === 'subscription') revenueByMonth[m].subscriptions += inv.amount ?? 0
      }
      for (const c of commissions ?? []) {
        const m = monthKey(c.created_at ?? '')
        if (!revenueByMonth[m]) revenueByMonth[m] = { month: m, subscriptions: 0, commissions: 0, packs: 0 }
        revenueByMonth[m].commissions += c.commission_amount ?? 0
      }
      for (const p of creditPurchases ?? []) {
        const m = monthKey(p.purchased_at ?? '')
        if (!revenueByMonth[m]) revenueByMonth[m] = { month: m, subscriptions: 0, commissions: 0, packs: 0 }
        revenueByMonth[m].packs += p.amount_paid ?? 0
      }
      setMonthRevenue(Object.values(revenueByMonth).sort((a, b) => a.month.localeCompare(b.month)))

      // ── Actor shares ──────────────────────────────────────────────
      const actorMap: Record<string, number> = {}
      for (const c of commissions ?? []) {
        const role = c.acteur_role ?? 'other'
        actorMap[role] = (actorMap[role] ?? 0) + (c.commission_amount ?? 0)
      }
      setActorShares(Object.entries(actorMap).map(([label, amount]) => ({ label, amount })))

      // ── Journey (daily counts) ────────────────────────────────────
      const dayMap: Record<string, JourneyPoint> = {}
      const addDay = (arr: { created_at: string }[] | null, key: 'appointments' | 'reservations' | 'withdrawals') => {
        for (const r of arr ?? []) {
          const d = (r.created_at ?? '').substring(0, 10)
          if (!dayMap[d]) dayMap[d] = { date: d, appointments: 0, reservations: 0, withdrawals: 0 }
          dayMap[d][key]++
        }
      }
      addDay(appts, 'appointments')
      addDay(reservations, 'reservations')
      addDay(withdrawals, 'withdrawals')
      setJourney(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)))

      // ── PSP stats ─────────────────────────────────────────────────
      const pspMap: Record<string, PspRow> = {}
      for (const p of payments ?? []) {
        const psp = p.provider ?? 'Unknown'
        if (!pspMap[psp]) pspMap[psp] = { psp, paid: 0, failed: 0 }
        if (p.status === 'paid' || p.status === 'succeeded') pspMap[psp].paid++
        else if (p.status === 'failed') pspMap[psp].failed++
      }
      setPspStats(Object.values(pspMap))

      // ── AI data ───────────────────────────────────────────────────
      const aiMap: Record<string, AiDay> = {}
      for (const log of aiLogs ?? []) {
        const d = (log.created_at ?? '').substring(0, 10)
        if (!aiMap[d]) aiMap[d] = { date: d, cost: 0, billed: 0 }
        aiMap[d].cost += log.cost_usd ?? 0
        aiMap[d].billed += log.credits_used ?? 0
      }
      setAiData(Object.values(aiMap).sort((a, b) => a.date.localeCompare(b.date)))

      // ── Network health ─────────────────────────────────────────────
      const [{ count: prosCount }, { count: pharmCount }, { count: mutCount }] = await Promise.all([
        (supabase as any).from('appointments').select('professional_id', { count: 'exact', head: true }).gte('created_at', sinceDate),
        (supabase as any).from('reservations').select('pharmacy_id', { count: 'exact', head: true }).gte('created_at', sinceDate),
        (supabase as any).from('coverage_requests').select('mutual_id', { count: 'exact', head: true }).gte('created_at', sinceDate),
      ])
      setNetHealth({ pros: prosCount ?? 0, pharmacies: pharmCount ?? 0, mutuelles: mutCount ?? 0 })

    } catch (e: unknown) {
      setError('Erreur chargement analytics: ' + (e as Error).message)
    }
    setLoading(false)
  }

  async function exportReport(type: 'csv' | 'pdf') {
    setExporting(true)
    await supabase.functions.invoke('super-admin', {
      body: { action: 'export_report', reportType: 'analytics', format: type, filters: { period, actorFilter, segmentFilter } },
    })
    setExporting(false)
  }

  const PERIOD_OPTS: { label: string; value: Period }[] = [
    { label: '7 jours', value: '7j' },
    { label: '30 jours', value: '30j' },
    { label: '90 jours', value: '90j' },
    { label: '12 mois', value: '12m' },
  ]

  return (
    <div className="space-y-s-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-s-4">
        <div>
          <h1 className="text-h2 font-bold text-ink">Analytics</h1>
          <p className="text-small text-ink-3">Tableau de bord financier et opérationnel.</p>
        </div>
        <div className="flex gap-s-2">
          <Button variant="secondary" size="sm" onClick={() => exportReport('csv')} loading={exporting}>Exporter CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => exportReport('pdf')} loading={exporting}>Exporter PDF</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-s-3">
        <div className="flex gap-s-1">
          {PERIOD_OPTS.map(o => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`rounded-md px-s-3 py-s-1 text-small font-medium transition-colors ${period === o.value ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink-2 hover:bg-surface-2'}`}
            >
              {o.value}
            </button>
          ))}
        </div>
        <Select
          options={[
            { label: 'Tous les acteurs', value: 'all' },
            { label: 'Patients', value: 'patient' },
            { label: 'Professionnels', value: 'professional' },
            { label: 'Pharmacies', value: 'pharmacy' },
            { label: 'Mutuelles', value: 'mutual' },
          ]}
          value={actorFilter}
          onValueChange={setActorFilter}
          className="w-48"
        />
        <Select
          options={[{ label: 'Tous les plans', value: 'all' }, ...plans.map(p => ({ label: p.name, value: p.code }))]}
          value={segmentFilter}
          onValueChange={setSegmentFilter}
          className="w-48"
        />
      </div>

      {error && <Banner kind="warning">{error}</Banner>}

      {/* KPI Row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-s-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : kpi && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-s-4">
          <KpiTile
            label="MRR"
            value={`${fmt(kpi.mrr)} XOF`}
            countTo={kpi.mrr}
            subtext="Revenu mensuel récurrent"
          />
          <KpiTile
            label="ARR"
            value={`${fmt(kpi.arr)} XOF`}
            countTo={kpi.arr}
            subtext="Revenu annuel récurrent"
          />
          <KpiTile
            label="Churn mensuel"
            value={`${kpi.churnPct}%`}
            countTo={kpi.churnPct}
            variant={kpi.churnPct > 5 ? 'danger' : kpi.churnPct > 2 ? 'warning' : 'success'}
            subtext="Abonnements annulés ce mois"
          />
          <KpiTile
            label="ARPU"
            value={`${fmt(kpi.arpu)} XOF`}
            countTo={kpi.arpu}
            subtext="Revenu moyen par compte payant"
          />
          <KpiTile
            label="Conv. Free→Payant"
            value={`${kpi.convPct}%`}
            countTo={kpi.convPct}
            variant={kpi.convPct > 15 ? 'success' : kpi.convPct > 5 ? 'warning' : 'danger'}
            subtext="Conversion vers abonnement"
          />
        </div>
      )}

      {/* Revenue by source */}
      <Card>
        <CardHeader><CardTitle>Revenus par source</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full rounded" /> : (
            <BarChart
              data={monthRevenue.map(m => ({ label: m.month.substring(5), ...m }))}
              keys={['subscriptions', 'commissions', 'packs']}
              colors={['var(--primary)', 'var(--accent)', 'var(--status-success)']}
              labels={['Abonnements', 'Commissions', 'Packs crédits']}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-s-4">
        {/* Actor share */}
        <Card>
          <CardHeader><CardTitle>Répartition par acteur</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full rounded" /> : <DonutChart shares={actorShares} />}
          </CardContent>
        </Card>

        {/* Payment PSP */}
        <Card>
          <CardHeader><CardTitle>Paiements par PSP</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-32 w-full rounded" /> : (
              pspStats.length === 0 ? <EmptyChart /> : (
                <table className="w-full text-small">
                  <thead className="text-ink-3 border-b border-line">
                    <tr>
                      {['PSP', 'Réussis', 'Échoués', 'Taux'].map(h => (
                        <th key={h} className="px-s-3 py-s-2 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {pspStats.map(row => {
                      const total = row.paid + row.failed
                      const rate = total > 0 ? Math.round((row.paid / total) * 100) : 0
                      return (
                        <tr key={row.psp} className="hover:bg-surface-2">
                          <td className="px-s-3 py-s-2 font-medium text-ink">{row.psp}</td>
                          <td className="px-s-3 py-s-2 text-ink-2">{row.paid}</td>
                          <td className="px-s-3 py-s-2 text-ink-2">{row.failed}</td>
                          <td className="px-s-3 py-s-2">
                            <Badge variant={rate >= 90 ? 'success' : rate >= 70 ? 'pending' : 'danger'}>{rate}%</Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Journey */}
      <Card>
        <CardHeader><CardTitle>Parcours utilisateur</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-36 w-full rounded" /> : (
            <LineSparklines
              data={journey as unknown as { date: string; [k: string]: number | string }[]}
              keys={['appointments', 'reservations', 'withdrawals']}
              colors={['var(--primary)', 'var(--accent)', 'var(--status-success)']}
              labels={['Rendez-vous', 'Réservations', 'Retraits médicaments']}
            />
          )}
        </CardContent>
      </Card>

      {/* AI cost vs billed */}
      <Card>
        <CardHeader><CardTitle>IA — Coût vs crédits facturés</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-36 w-full rounded" /> : (
            <BarChart
              data={aiData.map(d => ({ label: d.date.substring(5), cost: d.cost, billed: d.billed }))}
              keys={['cost', 'billed']}
              colors={['var(--status-danger)', 'var(--status-success)']}
              labels={['Coût USD', 'Crédits facturés']}
            />
          )}
        </CardContent>
      </Card>

      {/* Network health */}
      <div>
        <h2 className="text-h3 font-semibold text-ink mb-s-3">Santé du réseau</h2>
        <div className="grid grid-cols-3 gap-s-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : (
            <>
              <KpiTile label="Professionnels actifs" value={fmt(netHealth.pros)} countTo={netHealth.pros} subtext={`Avec RDV sur ${period}`} variant="success" />
              <KpiTile label="Pharmacies actives" value={fmt(netHealth.pharmacies)} countTo={netHealth.pharmacies} subtext={`Avec réservations sur ${period}`} variant="success" />
              <KpiTile label="Mutuelles actives" value={fmt(netHealth.mutuelles)} countTo={netHealth.mutuelles} subtext={`Avec prises en charge sur ${period}`} variant="success" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
