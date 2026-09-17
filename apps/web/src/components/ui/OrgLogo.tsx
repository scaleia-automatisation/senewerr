import { cn } from '@/lib/utils'

const sizes = { sm: 'h-8 w-8 text-micro', md: 'h-10 w-10 text-small', lg: 'h-12 w-12 text-body' }

export interface OrgLogoProps {
  src?: string | null
  name: string
  size?: keyof typeof sizes
  className?: string
}

/** Logo d'organisation avec repli sur les initiales (carré arrondi). */
export function OrgLogo({ src, name, size = 'md', className }: OrgLogoProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent-soft font-semibold text-accent',
        sizes[size],
        className,
      )}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  )
}
