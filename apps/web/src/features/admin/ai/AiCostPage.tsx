import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { KpiTile } from '@/components/ui/KpiTile'
import { Banner } from '@/components/ui/Banner'
import { Badge } from '@/components/ui/Badge'

const MODELS: Record<string, { input_per_m: number; output_per_m: number }> = {
  'gpt-4.1-mini': { input_per_m: 0.40, output_per_m: 1.60 },
}

const DEFAULT_USD_TO_XOF = 600

function calcRealCostUsd(gen: { model: string; input_tokens: number; output_tokens: number }): number {
  const pricing = MODELS[gen.model]
  if (!pricing) return 0
  return (gen.input_tokens / 1_000_000) * pricing.input_per_m + (gen.output_tokens / 1_000_000) * pricing.output_per_m
}

interface Generation {
  id: string
  profile_id?: string
  model: string
  input_tokens: number
  output_tokens: number
  action_type?: string
  status?: string
  created_at: string
  provider_cost_usd?: number
  credits?: number
  profile?: { full_name?: string }
}

interface KpiData {
  total_gens: number
  total_cost_usd: number
  total_cost_xof: number
  total_credits: number
  margin: number
}

interface DailyPoint {
  date: string
  cost_usd: number
}

interface ConsumerRow {
  profile_id: string
  name: string
  gen_count: number
  credits: number
  cost_usd: number
  cost_xof: number
}

interface ActionRow {
  action_type: string
  count: number
  cost_usd: number
}

function Sparkline30({ data }: { data: DailyPoint[] }) {
  if (data.length < 2) return null
  const costs = data.map((d) => d.cost_usd)
  const max = Math.max(...costs, 0.0001)
  const w = 400
  const h = 80
  const step = w / (data.length - 1)

  const points = data
    .map((d, i) => `${(i * step).toFixed(1)},${(h - (d.cost_usd / max) * h).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }} aria-label="Courbe des coûts 30 jours">
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BarChart({ rows }: { rows: ActionRow[] }) {
  const max = Math.max(...rows.map((r) => r.cost_usd), 0.0001)
  return (
    <div className="flex flex-col gap-s-2">
      {rows.map((r) => (
        <div key={r.action_type} className="flex items-center gap-s-3">
          <span className="text-xs text-ink-3 w-32 shrink-0 truncate">{r.action_type || 'unknown'}</span>
          <div className="flex-1 bg-surface-2 rounded-sm h-4 overflow-hidden">
            <div
              className="h-full bg-primary rounded-sm"
              style={{ width: `${(r.cost_usd / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-ink-3 w-20 text-right shrink-0">${r.cost_usd.toFixed(4)}</span>
          <span className="text-xs text-ink-3 w-16 text-right shrink-0">{r.count} gen</span>
        </div>
      ))}
    </div>
  )
}

export default function AiCostPage() {
  useAdminAudit('ia')

  const [period, setPeriod] = useState('30')
  const [actorSearch, setActorSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [usdToXof, setUsdToXof] = useState(DEFAULT_USD_TO_XOF)

  const [loading, setLoading] = useState(true)
  const [gens, setGens] = useState<Generation[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date(Date.now() - Number(period) * 86400000).toISOString()

    // Load platform settings for usd_to_xof
    const { data: settings } = await (supabase as any)
      .from('platform_settings')
      .select('usd_to_xof, ai_pricing')
      .limit(1)
      .maybeSingle()
    if (settings?.usd_to_xof) setUsdToXof(settings.usd_to_xof)

    let q = (supabase as any)
      .from('ai_generations')
      .select('id, profile_id, model, input_tokens, output_tokens, action_type, status, created_at, provider_cost_usd, credits, profile:profiles(full_name)')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (statusFilter === 'failed') q = q.eq('status', 'failed')
    if (actionFilter !== 'all') q = q.eq('action_type', actionFilter)

    const { data } = await q
    setGens(data ?? [])
    setLoading(false)
  }, [period, statusFilter, actionFilter])

  useEffect(() => { load() }, [load])

  // Derived data
  const filtered = actorSearch
    ? gens.filter((g) => (g.profile?.full_name ?? '').toLowerCase().includes(actorSearch.toLowerCase()))
    : gens

  const kpi: KpiData = filtered.reduce((acc, g) => {
    const costUsd = calcRealCostUsd(g)
    const credits = g.credits ?? 0
    acc.total_gens += 1
    acc.total_cost_usd += costUsd
    acc.total_cost_xof += costUsd * usdToXof
    acc.total_credits += credits
    // Assume avg credit price ~100 FCFA
    acc.margin += (credits * 100) - (costUsd * usdToXof)
    return acc
  }, { total_gens: 0, total_cost_usd: 0, total_cost_xof: 0, total_credits: 0, margin: 0 } as KpiData)

  // Daily cost sparkline
  const dailyMap: Record<string, number> = {}
  filtered.forEach((g) => {
    const day = g.created_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + calcRealCostUsd(g)
  })
  const dailyData: DailyPoint[] = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, cost_usd]) => ({ date, cost_usd }))

  // Top 20 consumers
  const consumerMap: Record<string, ConsumerRow> = {}
  filtered.forEach((g) => {
    const pid = g.profile_id ?? 'unknown'
    if (!consumerMap[pid]) {
      consumerMap[pid] = { profile_id: pid, name: g.profile?.full_name ?? pid.slice(0, 8), gen_count: 0, credits: 0, cost_usd: 0, cost_xof: 0 }
    }
    const costUsd = calcRealCostUsd(g)
    consumerMap[pid].gen_count += 1
    consumerMap[pid].credits += g.credits ?? 0
    consumerMap[pid].cost_usd += costUsd
    consumerMap[pid].cost_xof += costUsd * usdToXof
  })
  const topConsumers = Object.values(consumerMap)
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, 20)

  // Per action
  const actionMap: Record<string, ActionRow> = {}
  filtered.forEach((g) => {
    const key = g.action_type ?? 'unknown'
    if (!actionMap[key]) actionMap[key] = { action_type: key, count: 0, cost_usd: 0 }
    actionMap[key].count += 1
    actionMap[key].cost_usd += calcRealCostUsd(g)
  })
  const actionRows = Object.values(actionMap).sort((a, b) => b.cost_usd - a.cost_usd)

  // Alerts: accounts with cost > 3× average
  const avgCostUsd = kpi.total_cost_usd / Math.max(topConsumers.length, 1)
  const alertedConsumers = topConsumers.filter((c) => c.cost_usd > avgCostUsd * 3)

  const uniqueActions = [...new Set(gens.map((g) => g.action_type ?? 'unknown'))]

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Coûts IA</h1>
      </div>

      {/* Filters */}
      <Card className="p-s-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-3">
          <Select
            label="Période"
            value={period}
            onValueChange={(v) => setPeriod(v)}
            options={[
              { value: '7', label: '7 derniers jours' },
              { value: '30', label: '30 derniers jours' },
              { value: '90', label: '90 derniers jours' },
            ]}
          />
          <Input label="Acteur" placeholder="Recherche…" value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} />
          <Select
            label="Type d'action"
            value={actionFilter}
            onValueChange={setActionFilter}
            options={[{ value: 'all', label: 'Toutes' }, ...uniqueActions.map((a) => ({ value: a, label: a }))]}
          />
          <Select
            label="Statut"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[{ value: 'all', label: 'Tous' }, { value: 'failed', label: 'Échoués seulement' }]}
          />
        </div>
      </Card>

      {/* Alert */}
      {alertedConsumers.length > 0 && (
        <Banner kind="warning">
          {alertedConsumers.length} compte{alertedConsumers.length > 1 ? 's' : ''} avec coût {'>'} 3× la moyenne :
          {' '}{alertedConsumers.map((c) => c.name).join(', ')}
        </Banner>
      )}

      {/* KPI row */}
      {loading
        ? <div className="grid grid-cols-2 sm:grid-cols-5 gap-s-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded" />)}</div>
        : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-s-3">
            <KpiTile label="Total générations" value={kpi.total_gens.toLocaleString('fr-FR')} />
            <KpiTile label="Coût réel (USD)" value={`$${kpi.total_cost_usd.toFixed(4)}`} />
            <KpiTile label="Coût réel (FCFA)" value={Math.round(kpi.total_cost_xof).toLocaleString('fr-FR') + ' FCFA'} />
            <KpiTile label="Crédits facturés" value={kpi.total_credits.toLocaleString('fr-FR')} />
            <KpiTile
              label="Marge (FCFA)"
              value={Math.round(kpi.margin).toLocaleString('fr-FR') + ' FCFA'}
              variant={kpi.margin >= 0 ? 'success' : 'danger'}
            />
          </div>
        )
      }

      {/* Sparkline 30j */}
      <Card className="p-s-4">
        <h2 className="text-sm font-semibold text-ink-2 mb-s-3">Coût quotidien</h2>
        {loading ? <Skeleton className="h-20 w-full rounded" /> : <Sparkline30 data={dailyData} />}
      </Card>

      {/* Top 20 consumers */}
      <Card className="overflow-x-auto">
        <div className="p-s-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-2">Top 20 consommateurs</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Acteur', 'Générations', 'Crédits', 'Coût (USD)', 'Coût (FCFA)'].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(5).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : topConsumers.length === 0
                ? <tr><td colSpan={5} className="px-s-3 py-s-6 text-center text-ink-3">Aucune donnée</td></tr>
                : topConsumers.map((c) => (
                  <tr key={c.profile_id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-medium text-ink">{c.name}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{c.gen_count}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{c.credits}</td>
                    <td className="px-s-3 py-s-3 font-mono text-xs">${c.cost_usd.toFixed(6)}</td>
                    <td className="px-s-3 py-s-3 font-mono text-xs">{Math.round(c.cost_xof).toLocaleString('fr-FR')}</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      {/* Par action */}
      <Card className="p-s-4">
        <h2 className="text-sm font-semibold text-ink-2 mb-s-3">Par type d'action</h2>
        {loading
          ? <Skeleton className="h-32 w-full rounded" />
          : actionRows.length === 0
            ? <p className="text-sm text-ink-3">Aucune donnée</p>
            : <BarChart rows={actionRows} />
        }
      </Card>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={load}>Actualiser</Button>
      </div>
    </div>
  )
}
