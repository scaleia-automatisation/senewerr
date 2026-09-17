import {
  ResponsiveContainer,
  BarChart as ReBarChart, Bar,
  LineChart as ReLineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

/** Palette des séries = tokens statut (jamais de hex direct). */
const SERIES = [
  'var(--primary)',
  'var(--accent)',
  'var(--status-progress)',
  'var(--status-pending)',
  'var(--status-neutral)',
]

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md bg-surface-2 text-small text-ink-3"
      style={{ height }}
    >
      Pas encore de données
    </div>
  )
}

const AXIS = { stroke: 'var(--ink-3)', fontSize: 12 }
const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  fontSize: 13,
  color: 'var(--ink)',
}

export interface SeriesPoint {
  label: string
  value: number
}

export function BarChart({ data, height = 220, className }: { data: SeriesPoint[]; height?: number; className?: string }) {
  if (!data.length) return <EmptyChart height={height} />
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} {...AXIS} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
          <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LineChart({ data, height = 220, className }: { data: SeriesPoint[]; height?: number; className?: string }) {
  if (!data.length) return <EmptyChart height={height} />
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ReLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} {...AXIS} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({ data, height = 220, className }: { data: SeriesPoint[]; height?: number; className?: string }) {
  if (!data.length) return <EmptyChart height={height} />
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Jauge circulaire simple (0–100 %). */
export function Gauge({ value, label, size = 132 }: { value: number; label?: string; size?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="inline-flex flex-col items-center gap-s-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[var(--ink)] font-display text-h2 font-semibold tabular-nums"
        >
          {pct}%
        </text>
      </svg>
      {label && <span className="text-small text-ink-3">{label}</span>}
    </div>
  )
}
