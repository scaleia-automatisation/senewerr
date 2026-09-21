import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Download, Calendar, DollarSign, Users, XCircle } from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Select } from '@/components/ui/Select'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function pct(n: number, ref: number): number | null {
  if (!ref) return null
  return Math.round(((n - ref) / ref) * 100)
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPIData {
  revenus_mois:              number
  revenus_mois_prec:         number
  consultations_mois:        number
  consultations_mois_prec:   number
  taux_no_show:              number
  taux_no_show_prec:         number
}

interface BarData  { label: string; valeur: number }
interface EtabSlice { nom: string; valeur: number; color: string }
interface LinePoint { date: string; cumul: number }

interface PaiementRow {
  id: string
  date: string
  patient_name: string
  type: string
  montant: number
  statut: 'recu' | 'attente'
  ref_transaction?: string | null
}

const ETAB_COLORS = [
  '#1A7A4C', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981',
]

const PERIODE_OPTS = [
  { value: 'mois',    label: 'Ce mois' },
  { value: 'prev',    label: 'Mois précédent' },
  { value: '3mois',   label: '3 derniers mois' },
  { value: '6mois',   label: '6 derniers mois' },
]

const PAGE = 20

// ── Charts SVG ────────────────────────────────────────────────────────────────

function BarChart({ data, maxVal }: { data: BarData[]; maxVal: number }) {
  const W = 600; const H = 120; const BAR_W = Math.max(4, Math.floor((W - 40) / Math.max(data.length, 1)) - 2)
  if (!data.length) return <p className="text-micro text-ink-3 text-center py-s-4">Aucune donnée</p>
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {data.map((d, i) => {
        const barH = maxVal ? Math.round((d.valeur / maxVal) * (H - 24)) : 0
        const x    = 20 + i * ((W - 40) / data.length)
        const y    = H - barH - 4
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={2} fill="#1A7A4C" opacity={0.75} />
            {i % Math.ceil(data.length / 8) === 0 && (
              <text x={x + BAR_W / 2} y={H} fontSize={9} textAnchor="middle" fill="#9CA3AF">{d.label}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ slices }: { slices: EtabSlice[] }) {
  const total = slices.reduce((s, x) => s + x.valeur, 0)
  if (!total) return <p className="text-micro text-ink-3 text-center py-s-4">Aucune donnée</p>
  const R = 50; const CX = 60; const CY = 60; const r = 28
  let angle = -Math.PI / 2
  return (
    <div className="flex items-center gap-s-4">
      <svg width={120} height={120}>
        {slices.map((s, i) => {
          const sweep = (s.valeur / total) * 2 * Math.PI
          const x1 = CX + R * Math.cos(angle)
          const y1 = CY + R * Math.sin(angle)
          angle += sweep
          const x2 = CX + R * Math.cos(angle)
          const y2 = CY + R * Math.sin(angle)
          const large = sweep > Math.PI ? 1 : 0
          return (
            <path key={i}
              d={`M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={s.color}
              opacity={0.85}
            />
          )
        })}
        <circle cx={CX} cy={CY} r={r} fill="var(--color-surface)" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={9} fill="var(--color-ink-3)">
          {slices.length} étab.
        </text>
      </svg>
      <div className="flex flex-col gap-s-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-s-2 text-micro">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-ink truncate max-w-[120px]">{s.nom}</span>
            <span className="text-ink-3 ml-auto">{Math.round((s.valeur / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineChart({ points }: { points: LinePoint[] }) {
  const W = 600; const H = 80
  if (points.length < 2) return <p className="text-micro text-ink-3 text-center py-s-4">Aucune donnée</p>
  const maxV = Math.max(...points.map(p => p.cumul), 1)
  const px = (i: number) => 10 + (i / (points.length - 1)) * (W - 20)
  const py = (v: number) => H - 8 - ((v / maxV) * (H - 16))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p.cumul)}`).join(' ')
  const areaD = pathD + ` L ${px(points.length - 1)} ${H} L ${px(0)} ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A7A4C" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1A7A4C" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGrad)" />
      <path d={pathD} stroke="#1A7A4C" strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function RevenusPage() {
  const { profile } = useAuth()
  const db = supabase as any

  const [kpi, setKpi]       = useState<KPIData | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [barData, setBarData]       = useState<BarData[]>([])
  const [donutData, setDonutData]   = useState<EtabSlice[]>([])
  const [lineData, setLineData]     = useState<LinePoint[]>([])
  const [chartsLoading, setChartsLoading] = useState(true)

  const [paiements, setPaiements] = useState<PaiementRow[]>([])
  const [pLoading, setPLoading]   = useState(true)
  const [periode, setPeriode]     = useState('mois')
  const [page, setPage]           = useState(0)

  // ── Charger KPIs via EF ────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return
    setKpiLoading(true)
    supabase.functions.invoke('get-praticien-kpis')
      .then(({ data }) => {
        if (!data) return
        setKpi({
          revenus_mois:            data.revenus_mois ?? 0,
          revenus_mois_prec:       (data.consultations_mois_prec ?? 0) * ((data.revenus_mois ?? 0) / Math.max(data.consultations_mois ?? 1, 1)),
          consultations_mois:      data.consultations_mois ?? 0,
          consultations_mois_prec: data.consultations_mois_prec ?? 0,
          taux_no_show:            0,
          taux_no_show_prec:       0,
        })
      })
      .finally(() => setKpiLoading(false))
  }, [profile?.id])

  // ── Charger données graphiques ────────────────────────────────────────────
  const loadCharts = useCallback(async () => {
    if (!profile?.id) return
    setChartsLoading(true)
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd   = endOfMonth(now)

    // Barres : RDV terminés par jour ce mois
    const { data: apptsMois } = await db.from('appointments')
      .select('starts_at, establishment_id, professional_establishments(pay_rate)')
      .eq('professional_id', profile.id)
      .eq('status', 'completed')
      .gte('starts_at', monthStart.toISOString())
      .lte('starts_at', monthEnd.toISOString())

    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const dayMap: Record<string, number> = {}
    days.forEach(d => { dayMap[format(d, 'dd')] = 0 })
    ;(apptsMois ?? []).forEach((a: any) => {
      const d = format(parseISO(a.starts_at), 'dd')
      const fee = a.professional_establishments?.pay_rate ?? 0
      dayMap[d] = (dayMap[d] ?? 0) + fee
    })
    const bars: BarData[] = Object.entries(dayMap).map(([label, valeur]) => ({ label, valeur }))
    setBarData(bars)

    // Donut : par établissement ce mois
    const etabMap: Record<string, { nom: string; valeur: number }> = {}
    ;(apptsMois ?? []).forEach((a: any, i: number) => {
      const etabId = a.establishment_id ?? 'inconnu'
      if (!etabMap[etabId]) etabMap[etabId] = { nom: `Étab. ${i + 1}`, valeur: 0 }
      etabMap[etabId].valeur += a.professional_establishments?.pay_rate ?? 0
    })

    // Charger les noms des établissements
    const etabIds = Object.keys(etabMap).filter(id => id !== 'inconnu')
    if (etabIds.length > 0) {
      const { data: etabNames } = await db.from('establishments')
        .select('id, nom').in('id', etabIds)
      ;(etabNames ?? []).forEach((e: any) => {
        if (etabMap[e.id]) etabMap[e.id].nom = e.nom
      })
    }

    setDonutData(
      Object.entries(etabMap).map(([, d], i) => ({
        nom:    d.nom,
        valeur: d.valeur,
        color:  ETAB_COLORS[i % ETAB_COLORS.length],
      }))
    )

    // Tendance 30j
    const from30 = subDays(now, 29)
    const { data: appts30 } = await db.from('appointments')
      .select('starts_at, professional_establishments(pay_rate)')
      .eq('professional_id', profile.id)
      .eq('status', 'completed')
      .gte('starts_at', from30.toISOString())
      .lte('starts_at', now.toISOString())

    const last30 = eachDayOfInterval({ start: from30, end: now })
    const cumulMap: Record<string, number> = {}
    last30.forEach(d => { cumulMap[format(d, 'yyyy-MM-dd')] = 0 })
    ;(appts30 ?? []).forEach((a: any) => {
      const d = format(parseISO(a.starts_at), 'yyyy-MM-dd')
      cumulMap[d] = (cumulMap[d] ?? 0) + (a.professional_establishments?.pay_rate ?? 0)
    })

    let cumul = 0
    const linePoints: LinePoint[] = Object.entries(cumulMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => { cumul += v; return { date, cumul } })
    setLineData(linePoints)

    setChartsLoading(false)
  }, [profile?.id])

  useEffect(() => { loadCharts() }, [loadCharts])

  // ── Charger tableau paiements ─────────────────────────────────────────────
  const loadPaiements = useCallback(async () => {
    if (!profile?.id) return
    setPLoading(true)
    const now = new Date()
    let dateMin = startOfMonth(now).toISOString()
    if (periode === 'prev')  { const prev = subMonths(now, 1); dateMin = startOfMonth(prev).toISOString() }
    if (periode === '3mois') dateMin = subMonths(now, 3).toISOString()
    if (periode === '6mois') dateMin = subMonths(now, 6).toISOString()

    const { data } = await db.from('appointments')
      .select(`
        id, starts_at, type, status,
        patient:patient_id ( full_name ),
        professional_establishments ( pay_rate )
      `)
      .eq('professional_id', profile.id)
      .in('status', ['completed', 'paid', 'confirmed'])
      .gte('starts_at', dateMin)
      .order('starts_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)

    const rows: PaiementRow[] = (data ?? []).map((a: any) => ({
      id:             a.id,
      date:           a.starts_at,
      patient_name:   a.patient?.full_name ?? '—',
      type:           a.type === 'teleconsultation' ? 'Téléconsultation' : 'Consultation',
      montant:        a.professional_establishments?.pay_rate ?? 0,
      statut:         a.status === 'completed' ? 'recu' : 'attente',
      ref_transaction: null,
    }))

    setPaiements(rows)
    setPLoading(false)
  }, [profile?.id, periode, page])

  useEffect(() => { loadPaiements() }, [loadPaiements])
  useEffect(() => { setPage(0) }, [periode])

  // ── Export PDF relevé ─────────────────────────────────────────────────────
  function exportPdf() {
    if (!profile) return
    const now = new Date()
    const rows = paiements.map(p =>
      `<tr>
        <td>${format(parseISO(p.date), 'dd/MM/yyyy', { locale: fr })}</td>
        <td>${p.patient_name}</td>
        <td>${p.type}</td>
        <td>${fcfa(p.montant)}</td>
        <td>${p.statut === 'recu' ? 'Reçu' : 'En attente'}</td>
      </tr>`
    ).join('')

    const total = paiements.reduce((s, p) => s + (p.statut === 'recu' ? p.montant : 0), 0)

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Relevé — ${profile.full_name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
  h1 { color: #1A7A4C; font-size: 16pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f5f5f5; border-bottom: 2px solid #1A7A4C; padding: 6px 8px; text-align: left; font-size: 10pt; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
  .total { font-weight: bold; text-align: right; margin-top: 12px; font-size: 12pt; }
  .meta { color: #555; margin-bottom: 16px; }
</style></head><body>
<h1>Relevé des paiements</h1>
<p class="meta">Dr. ${profile.full_name} · Généré le ${format(now, 'dd/MM/yyyy à HH:mm')}</p>
<table>
  <thead><tr><th>Date</th><th>Patient</th><th>Type</th><th>Montant</th><th>Statut</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total">Total reçu : ${fcfa(total)}</div>
</body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const maxBar = Math.max(...barData.map(d => d.valeur), 1)

  return (
    <div className="flex flex-col gap-s-6 p-s-4 md:p-s-6">

      <div className="flex items-center justify-between flex-wrap gap-s-2">
        <h1 className="text-h3 font-semibold text-ink">Revenus</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-s-3 py-s-1.5">
          <p className="text-micro text-amber-700 font-medium">
            ⚠ Données calculées côté serveur — lecture seule
          </p>
        </div>
      </div>

      {/* ── 8.1 KPI tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-s-4 sm:grid-cols-3">
        {kpiLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : kpi && [
            {
              label:   'Revenu ce mois',
              valeur:  fcfa(kpi.revenus_mois),
              delta:   pct(kpi.revenus_mois, kpi.revenus_mois_prec),
              icon:    <DollarSign className="h-5 w-5 text-primary" />,
              alert:   false,
            },
            {
              label:   'Consultations ce mois',
              valeur:  `${kpi.consultations_mois} consultations`,
              delta:   pct(kpi.consultations_mois, kpi.consultations_mois_prec),
              icon:    <Users className="h-5 w-5 text-secondary" />,
              alert:   false,
            },
            {
              label:   'Taux de no-show',
              valeur:  `${kpi.taux_no_show.toFixed(1)} %`,
              delta:   null,
              icon:    <XCircle className={`h-5 w-5 ${kpi.taux_no_show > 15 ? 'text-danger' : 'text-ink-3'}`} />,
              alert:   kpi.taux_no_show > 15,
            },
          ].map((tile, i) => (
            <Card key={i} className={`p-s-4 flex flex-col gap-s-2 ${tile.alert ? 'border-danger/40 bg-danger/5' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-micro text-ink-3 font-medium uppercase tracking-wide">{tile.label}</p>
                {tile.icon}
              </div>
              <p className="text-h3 font-bold text-ink">{tile.valeur}</p>
              {tile.delta !== null && (
                <div className={`flex items-center gap-s-1 text-micro font-medium ${tile.delta > 0 ? 'text-success' : tile.delta < 0 ? 'text-danger' : 'text-ink-3'}`}>
                  {tile.delta > 0
                    ? <TrendingUp className="h-3 w-3" />
                    : tile.delta < 0
                    ? <TrendingDown className="h-3 w-3" />
                    : <Minus className="h-3 w-3" />
                  }
                  {tile.delta > 0 ? '+' : ''}{tile.delta}% vs mois précédent
                </div>
              )}
              {tile.alert && (
                <p className="text-micro text-danger font-medium">⚠ Seuil d'alerte dépassé (&gt;15%)</p>
              )}
            </Card>
          ))
        }
      </div>

      {/* ── 8.2 Graphiques ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-s-4 lg:grid-cols-3">
        {/* Barres */}
        <Card className="p-s-4 lg:col-span-2">
          <p className="mb-s-3 text-small font-semibold text-ink">Revenu par jour (mois en cours)</p>
          {chartsLoading
            ? <Skeleton className="h-32" />
            : <BarChart data={barData} maxVal={maxBar} />
          }
        </Card>

        {/* Donut */}
        <Card className="p-s-4">
          <p className="mb-s-3 text-small font-semibold text-ink">Revenus par établissement</p>
          {chartsLoading
            ? <Skeleton className="h-32" />
            : <DonutChart slices={donutData} />
          }
        </Card>
      </div>

      {/* Tendance 30j */}
      <Card className="p-s-4">
        <p className="mb-s-3 text-small font-semibold text-ink">Tendance 30 derniers jours (revenus cumulés)</p>
        {chartsLoading
          ? <Skeleton className="h-24" />
          : <LineChart points={lineData} />
        }
      </Card>

      {/* ── 8.3 Tableau paiements ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-s-2">
        <h2 className="text-base font-semibold text-ink">Détails des paiements</h2>
        <div className="flex items-center gap-s-2">
          <Select options={PERIODE_OPTS} value={periode} onValueChange={setPeriode} />
          <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={exportPdf}>
            Télécharger relevé PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-small">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              {['Date', 'Patient', 'Type', 'Montant', 'Statut', 'N° transaction'].map(h => (
                <th key={h} className="px-s-3 py-s-2 text-left font-semibold text-ink-3 text-micro whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-s-3 py-s-2"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))
              : paiements.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-s-3 py-s-10 text-center text-ink-3">
                      <DollarSign className="mx-auto mb-s-2 h-8 w-8 opacity-20" />
                      Aucun paiement sur la période
                    </td>
                  </tr>
                )
                : paiements.map(p => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-s-3 py-s-2 text-ink-3 whitespace-nowrap">
                      {format(parseISO(p.date), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                    <td className="px-s-3 py-s-2 font-medium text-ink">{p.patient_name}</td>
                    <td className="px-s-3 py-s-2 text-ink-3">{p.type}</td>
                    <td className="px-s-3 py-s-2 font-semibold text-ink">{fcfa(p.montant)}</td>
                    <td className="px-s-3 py-s-2">
                      <Badge variant={p.statut === 'recu' ? 'success' : 'pending'}>
                        {p.statut === 'recu' ? 'Reçu' : 'En attente'}
                      </Badge>
                    </td>
                    <td className="px-s-3 py-s-2 text-ink-3 font-mono text-micro">
                      {p.ref_transaction ?? '—'}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-s-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
        <span className="text-small text-ink-3">Page {page + 1}</span>
        <Button variant="ghost" size="sm" disabled={paiements.length < PAGE} onClick={() => setPage(p => p + 1)}>Suivant</Button>
      </div>
    </div>
  )
}
