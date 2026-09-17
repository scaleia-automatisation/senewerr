import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './IconButton'

export interface NotificationItemProps {
  title: string
  body: string
  time: string
  read?: boolean
  onDismiss?: () => void
  onClick?: () => void
  className?: string
}

export function NotificationItem({ title, body, time, read, onDismiss, onClick, className }: NotificationItemProps) {
  return (
    <div
      className={cn(
        'group flex items-start gap-s-3 rounded-md p-s-3 transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-2',
        className,
      )}
      onClick={onClick}
    >
      <span
        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-pill', read ? 'bg-transparent' : 'bg-primary')}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('text-body', read ? 'text-ink-2' : 'font-medium text-ink')}>{title}</p>
        <p className="text-small text-ink-3 line-clamp-2">{body}</p>
        <p className="mt-s-1 text-micro text-ink-3">{time}</p>
      </div>
      {onDismiss && (
        <IconButton
          aria-label="Supprimer la notification"
          variant="ghost"
          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={e => {
            e.stopPropagation()
            onDismiss()
          }}
        >
          <X className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  )
}
