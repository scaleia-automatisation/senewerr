import * as RadixAvatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

const sizes = {
  sm: 'h-8 w-8 text-micro',
  md: 'h-10 w-10 text-small',
  lg: 'h-12 w-12 text-body',
  xl: 'h-16 w-16 text-h3',
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export interface AvatarProps {
  src?: string | null
  fallback: string
  size?: keyof typeof sizes
  className?: string
}

export function Avatar({ src, fallback, size = 'md', className }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-pill bg-primary-soft',
        sizes[size],
        className,
      )}
    >
      {src && (
        <RadixAvatar.Image src={src} alt={fallback} className="h-full w-full object-cover" />
      )}
      <RadixAvatar.Fallback className="font-medium text-primary" delayMs={src ? 300 : 0}>
        {initials(fallback)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}
