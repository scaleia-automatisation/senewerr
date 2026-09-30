import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCFA } from '@/lib/utils'

export default async function CouvertureStatistiquesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase
    .from('coverage_orgs')
    .select('id, name')
    .eq('profile_id', user.id)
    .single()
  const org = orgData as unknown as { id: string; name: string } | null

  if (!org) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Organisme introuvable.</p>
      </div>
    )
  }

  // Fetch members stats
  const { data: membersData } = await supabase
    .from('coverage_members')
    .select('is_active')
    .eq('coverage_org_id', org.id)

  const members = (membersData ?? []) as unknown as Array<{ is_active: boolean | null }>
  const totalMembers = members.length
  const activeMembers = members.filter(m => m.is_active).length

  // Fetch requests stats
  const { data: requestsData } = await supabase
    .from('coverage_requests')
    .select('status, coverage_amount_fcfa, total_amount_fcfa')
    .eq('coverage_org_id', org.id)

  const requests = (requestsData ?? []) as unknown as Array<{ status: string; coverage_amount_fcfa: number | null; total_amount_fcfa: number | null }>
  const totalRequests = requests.length
  const approvedRequests = requests.filter(r => r.status === 'approved')
  const pendingRequests = requests.filter(r => ['pending', 'needs_info'].includes(r.status))
  const totalCoveragePaid = approvedRequests.reduce((s, r) => s + (r.coverage_amount_fcfa ?? 0), 0)
  const totalPendingAmount = pendingRequests.reduce((s, r) => s + (r.total_amount_fcfa ?? 0), 0)

  const stats = [
    {
      label: 'Total adhérents',
      value: totalMembers,
      type: 'number' as const,
      color: 'text-[var(--sw-ink)]',
    },
    {
      label: 'Adhérents actifs',
      value: activeMembers,
      type: 'number' as const,
      color: 'text-[var(--sw-success)]',
    },
    {
      label: 'Total dossiers',
      value: totalRequests,
      type: 'number' as const,
      color: 'text-[var(--sw-ink)]',
    },
    {
      label: 'Dossiers approuvés',
      value: approvedRequests.length,
      type: 'number' as const,
      color: 'text-[var(--sw-success)]',
    },
    {
      label: 'Dossiers en attente',
      value: pendingRequests.length,
      type: 'number' as const,
      color: 'text-[var(--sw-warning)]',
    },
    {
      label: 'Total pris en charge',
      value: totalCoveragePaid,
      type: 'currency' as const,
      color: 'text-[var(--sw-primary)]',
    },
    {
      label: 'Montant en attente',
      value: totalPendingAmount,
      type: 'currency' as const,
      color: 'text-[var(--sw-warning)]',
    },
  ]

  // Rate calculations
  const approvalRate = totalRequests > 0
    ? Math.round((approvedRequests.length / totalRequests) * 100)
    : 0

  const activeMemberRate = totalMembers > 0
    ? Math.round((activeMembers / totalMembers) * 100)
    : 0

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Statistiques</h1>
        <p className="text-[var(--sw-ink-2)] mt-1">{org.name}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
            <p className="text-sm text-[var(--sw-ink-2)]">{stat.label}</p>
            <p className={`mt-1 font-bold ${stat.color} ${stat.type === 'currency' ? 'text-xl' : 'text-3xl'}`}>
              {stat.type === 'currency' ? formatCFA(stat.value) : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Ratios */}
      {(totalRequests > 0 || totalMembers > 0) && (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-6 space-y-4">
          <h2 className="font-semibold text-[var(--sw-ink)]">Taux</h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--sw-ink-2)]">Taux d'approbation des dossiers</span>
                <span className="font-medium text-[var(--sw-ink)]">{approvalRate}%</span>
              </div>
              <div className="h-3 bg-[var(--sw-surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--sw-success)] rounded-full transition-all"
                  style={{ width: `${approvalRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--sw-ink-2)]">Taux d'adhérents actifs</span>
                <span className="font-medium text-[var(--sw-ink)]">{activeMemberRate}%</span>
              </div>
              <div className="h-3 bg-[var(--sw-surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--sw-primary)] rounded-full transition-all"
                  style={{ width: `${activeMemberRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {totalRequests === 0 && totalMembers === 0 && (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <p className="text-[var(--sw-ink-2)]">Aucune donnée disponible pour le moment.</p>
        </div>
      )}
    </div>
  )
}
