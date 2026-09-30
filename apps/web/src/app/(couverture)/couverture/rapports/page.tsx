import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BarChart3 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rapports — Couverture' }

export default async function RapportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[var(--sw-ink-3)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rapports</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Statistiques et analyses</p>
        </div>
      </div>
      <div className="sw-card p-10 text-center">
        <BarChart3 className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto mb-4" />
        <p className="text-sm font-medium text-[var(--sw-ink)]">Rapports et analyses</p>
        <p className="text-sm text-[var(--sw-ink-2)] mt-1 max-w-xs mx-auto">
          Les rapports de sinistralité, de consommation et les statistiques seront disponibles prochainement.
        </p>
      </div>
    </div>
  )
}
