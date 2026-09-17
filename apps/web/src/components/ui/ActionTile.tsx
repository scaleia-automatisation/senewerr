import { cn } from '@/lib/utils'

export interface ActionTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
}

/** Grande tuile d'accueil patient : icône trait 24 px + libellé. */
export function ActionTile({ icon, label, className, ...props }: ActionTileProps) {
  return (
    <button
      className={cn(
        'flex min-h-[104px] flex-col items-start justify-between gap-s-3 rounded-lg border border-line bg-surface p-s-4 text-left shadow-1',
        'transition-all duration-fast ease-out hover:-translate-y-0.5 hover:shadow-2 active:scale-[.97]',
        'focus-visible:outline-none focus-visible:shadow-focus',
        className,
      )}
      {...props}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent" aria-hidden="true">{icon}</span>
      <span className="text-body font-medium text-ink">{label}</span>
    </button>
  )
}
