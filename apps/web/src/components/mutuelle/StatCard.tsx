import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  value: string | number
  label: string
  icon: React.ReactNode
  trend?: number       // ±% par rapport à la période précédente
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  loading?: boolean
}

const COLOR_MAP = {
  primary: { bg: 'bg-primary/10', icon: 'text-primary', value: 'text-primary' },
  success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  warning: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
  danger:  { bg: 'bg-red-50', icon: 'text-red-500', value: 'text-red-600' },
  neutral: { bg: 'bg-surface-2', icon: 'text-ink-3', value: 'text-ink' },
}

export function StatCard({ value, label, icon, trend, color = 'primary', loading = false }: StatCardProps) {
  const colors = COLOR_MAP[color]

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-surface p-s-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="h-8 w-8 rounded-lg bg-surface-2 animate-pulse mb-s-3" />
        <div className="h-7 w-24 rounded bg-surface-2 animate-pulse mb-s-1" />
        <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-s-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md">
      <div className={cn('mb-s-3 inline-flex rounded-lg p-s-2', colors.bg)}>
        <span className={colors.icon}>{icon}</span>
      </div>
      <p className={cn('font-display text-h2 font-bold', colors.value)}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
      <div className="mt-s-1 flex items-center gap-s-2">
        <p className="text-small text-ink-3">{label}</p>
        {trend !== undefined && (
          <span className={cn(
            'flex items-center gap-s-0.5 text-micro font-semibold',
            trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-ink-3',
          )}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}
