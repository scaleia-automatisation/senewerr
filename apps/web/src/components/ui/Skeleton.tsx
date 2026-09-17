import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-sm bg-surface-2', className)}>
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--ink)_6%,transparent)] to-transparent"
        aria-hidden="true"
      />
    </div>
  )
}

/** Groupe de lignes de squelette avec léger décalage (stagger visuel). */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-s-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 && 'w-2/3')} />
      ))}
    </div>
  )
}
