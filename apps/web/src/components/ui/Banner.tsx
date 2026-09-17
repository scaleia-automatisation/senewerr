import { Info, AlertTriangle, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type BannerKind = 'info' | 'warning' | 'offline'

const config: Record<BannerKind, { icon: React.ReactNode; cls: string }> = {
  info:    { icon: <Info className="h-4 w-4" />,          cls: 'bg-primary-soft text-primary' },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, cls: 'bg-accent-soft text-accent' },
  offline: { icon: <WifiOff className="h-4 w-4" />,       cls: 'bg-surface-2 text-ink-2' },
}

export interface BannerProps {
  kind?: BannerKind
  children: React.ReactNode
  className?: string
}

export function Banner({ kind = 'info', children, className }: BannerProps) {
  const c = config[kind]
  return (
    <div
      role="status"
      className={cn('flex items-center gap-s-2 px-s-4 py-s-2 text-small font-medium', c.cls, className)}
    >
      <span className="shrink-0" aria-hidden="true">{c.icon}</span>
      {children}
    </div>
  )
}
