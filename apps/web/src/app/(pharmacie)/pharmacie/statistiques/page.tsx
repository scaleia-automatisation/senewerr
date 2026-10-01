import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCFA } from '@/lib/utils'

export default async function PharmacieStatistiquesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmacyData } = await supabase
    .from('pharmacies')
    .select('id, name')
    .eq('profile_id', user.id)
    .single()
  const pharmacy = pharmacyData as unknown as { id: string; name: string } | null

  if (!pharmacy) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Pharmacie introuvable.</p>
      </div>
    )
  }

  // Fetch all reservations for stats
  const { data: reservationsData } = await supabase
    .from('reservations_pharmacie')
    .select('status, total_amount_fcfa')
    .eq('pharmacy_id', pharmacy.id)

  const reservations = (reservationsData ?? []) as unknown as Array<{ status: string; total_amount_fcfa: number | null }>
  const totalReservations = reservations.length
  const collected = reservations.filter(r => r.status === 'collected')
  const totalRevenue = collected.reduce((sum, r) => sum + (r.total_amount_fcfa ?? 0), 0)

  const statusCounts: Record<string, number> = {}
  for (const r of reservations) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
  }

  // Fetch active products count
  const { count: activeProductsCount } = await supabase
    .from('produits_pharmacie')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacy.id)
    .eq('is_available', true)

  const statusLabels: Record<string, string> = {
    new: 'Nouvelles',
    verifying: 'Vérification',
    to_prepare: 'À préparer',
    preparing: 'En préparation',
    ready: 'Prêtes',
    collected: 'Collectées',
    refused: 'Refusées',
    cancelled: 'Annulées',
  }

  const statusColors: Record<string, string> = {
    new: 'bg-[var(--sw-info)]',
    verifying: 'bg-[var(--sw-warning)]',
    to_prepare: 'bg-[var(--sw-warning)]',
    preparing: 'bg-[var(--sw-warning)]',
    ready: 'bg-[var(--sw-success)]',
    collected: 'bg-[var(--sw-primary)]',
    refused: 'bg-[var(--sw-danger)]',
    cancelled: 'bg-[var(--sw-danger)]',
  }

  const maxCount = Math.max(...Object.values(statusCounts), 1)

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Statistiques</h1>
        <p className="text-[var(--sw-ink-2)] mt-1">{pharmacy.name}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Total réservations</p>
          <p className="text-3xl font-bold text-[var(--sw-ink)] mt-1">{totalReservations}</p>
        </div>
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Collectées</p>
          <p className="text-3xl font-bold text-[var(--sw-success)] mt-1">{collected.length}</p>
        </div>
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Revenu total</p>
          <p className="text-2xl font-bold text-[var(--sw-primary)] mt-1">{formatCFA(totalRevenue)}</p>
        </div>
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Produits actifs</p>
          <p className="text-3xl font-bold text-[var(--sw-ink)] mt-1">{activeProductsCount ?? 0}</p>
        </div>
      </div>

      {/* Répartition par statut */}
      {totalReservations > 0 && (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-6">
          <h2 className="font-semibold text-[var(--sw-ink)] mb-4">Répartition par statut</h2>
          <div className="space-y-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-28 text-sm text-[var(--sw-ink-2)] shrink-0">
                  {statusLabels[status] ?? status}
                </span>
                <div className="flex-1 bg-[var(--sw-surface-2)] rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${statusColors[status] ?? 'bg-[var(--sw-ink-3)]'}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-[var(--sw-ink)] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalReservations === 0 && (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <p className="text-[var(--sw-ink-2)]">Aucune donnée disponible pour le moment.</p>
        </div>
      )}
    </div>
  )
}
