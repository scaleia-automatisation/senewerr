import { cn } from '@/lib/utils'
import type { StatusKind } from './StatusPill'

const DOT: Record<StatusKind, string> = {
  success:  'bg-status-success',
  pending:  'bg-status-pending',
  progress: 'bg-status-progress',
  danger:   'bg-status-danger',
  neutral:  'bg-status-neutral',
}

export interface TimelineItem {
  id: string
  status: StatusKind
  title: string
  meta?: string
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-s-3">
          <div className="flex flex-col items-center">
            <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-pill', DOT[item.status])} aria-hidden="true" />
            {i < items.length - 1 && <span className="w-px flex-1 bg-line" aria-hidden="true" />}
          </div>
          <div className={cn('pb-s-4', i === items.length - 1 && 'pb-0')}>
            <p className="text-body text-ink">{item.title}</p>
            {item.meta && <p className="text-small text-ink-3">{item.meta}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
