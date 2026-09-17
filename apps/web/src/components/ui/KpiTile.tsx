import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface KpiTileProps {
  label: string
  /** Valeur déjà formatée (ex. « 1,2 M FCFA ») */
  value: string
  /** Valeur numérique pour le count-up (optionnel) */
  countTo?: number
  /** Variation en %, ex. +12 ou -4 */
  variation?: number
  /** Points pour un mini sparkline (valeurs brutes) */
  sparkline?: number[]
  className?: string
}

function useCountUp(target: number | undefined, duration = 600) {
  const [value, setValue] = useState(target ?? 0)
  useEffect(() => {
    if (target == null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const w = 72
  const h = 24
  const step = w / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden="true">
      <path d={d} stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiTile({ label, value, countTo, variation, sparkline, className }: KpiTileProps) {
  const counted = useCountUp(countTo)
  const up = (variation ?? 0) >= 0

  return (
    <div className={cn('flex flex-col gap-s-2 rounded-lg border border-line bg-surface p-s-4 shadow-1', className)}>
      <span className="text-small text-ink-3">{label}</span>
      <div className="flex items-end justify-between gap-s-3">
        <span className="text-h1 font-semibold text-ink tabular-nums">
          {countTo != null ? counted.toLocaleString('fr-FR') : value}
        </span>
        {sparkline && <Sparkline points={sparkline} />}
      </div>
      {variation != null && (
        <span
          className={cn(
            'inline-flex items-center gap-s-1 text-small font-medium',
            up ? 'text-status-success' : 'text-status-danger',
          )}
        >
          {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {up ? '+' : ''}{variation}%
        </span>
      )}
    </div>
  )
}
