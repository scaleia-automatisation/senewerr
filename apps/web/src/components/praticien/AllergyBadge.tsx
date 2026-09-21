import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

type AllergyLevel = 'mild' | 'moderate' | 'severe'

interface AllergyBadgeProps {
  allergen: string
  level?: AllergyLevel
  className?: string
}

const LEVEL_STYLES: Record<AllergyLevel, string> = {
  mild:     'bg-amber-100 text-amber-800 border-amber-200',
  moderate: 'bg-orange-100 text-orange-800 border-orange-200',
  severe:   'bg-red-100 text-red-800 border-red-200',
}

const LEVEL_LABEL: Record<AllergyLevel, string> = {
  mild:     'légère',
  moderate: 'modérée',
  severe:   'sévère',
}

export function AllergyBadge({ allergen, level = 'moderate', className }: AllergyBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-s-1 rounded-pill border px-s-2 py-0.5 text-micro font-medium',
        LEVEL_STYLES[level],
        className,
      )}
      title={`Allergie ${LEVEL_LABEL[level]}`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {allergen}
    </span>
  )
}
