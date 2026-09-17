import { Hammer } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Hammer className="h-8 w-8" />}
        title={title}
        description="Cet écran arrive dans un prochain bloc."
      />
    </div>
  )
}
