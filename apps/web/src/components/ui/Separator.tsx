import * as RadixSeparator from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
  label?: string
}

export function Separator({ orientation = 'horizontal', className, label }: SeparatorProps) {
  if (label) {
    return (
      <div className="flex items-center gap-s-3">
        <RadixSeparator.Root className="h-px flex-1 bg-line" decorative />
        <span className="whitespace-nowrap text-micro text-ink-3">{label}</span>
        <RadixSeparator.Root className="h-px flex-1 bg-line" decorative />
      </div>
    )
  }
  return (
    <RadixSeparator.Root
      orientation={orientation}
      decorative
      className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'bg-line', className)}
    />
  )
}
