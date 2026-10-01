import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type StockItem = {
  id: string
  quantity_available: number | null
  quantity_total: number | null
  quantity_reserved: number | null
  reorder_threshold: number | null
  expiry_date: string | null
  pharmacy_products: {
    name: string
    generic_name: string | null
    dci: string | null
    category: string | null
  } | null
}

export default async function StockPage() {
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
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Pharmacie introuvable.</p>
      </div>
    )
  }

  const { data: stockData } = await supabase
    .from('stock_pharmacie')
    .select(`
      id, quantity_available, quantity_total, quantity_reserved, reorder_threshold, expiry_date,
      pharmacy_products ( name, generic_name, dci, category )
    `)
    .eq('pharmacy_id', pharmacy.id)

  const stock = (stockData ?? []) as unknown as StockItem[]

  // Sort: low stock first
  const sorted = [...stock].sort((a, b) => {
    const aLow = (a.quantity_available ?? 0) <= (a.reorder_threshold ?? 0)
    const bLow = (b.quantity_available ?? 0) <= (b.reorder_threshold ?? 0)
    if (aLow && !bLow) return -1
    if (!aLow && bLow) return 1
    return 0
  })

  const lowStockCount = stock.filter(
    s => (s.quantity_available ?? 0) <= (s.reorder_threshold ?? 0)
  ).length

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Stock</h1>
        <p className="text-[var(--sw-ink-2)] mt-1">{pharmacy.name}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Total produits</p>
          <p className="text-3xl font-bold text-[var(--sw-ink)] mt-1">{stock.length}</p>
        </div>
        <div className={cn(
          'rounded-xl border p-4',
          lowStockCount > 0
            ? 'bg-[var(--sw-warning-bg)] border-[var(--sw-warning)]'
            : 'bg-[var(--sw-surface)] border-[var(--sw-line)]'
        )}>
          <p className="text-sm text-[var(--sw-ink-2)]">Stock bas</p>
          <p className={cn(
            'text-3xl font-bold mt-1',
            lowStockCount > 0 ? 'text-[var(--sw-warning)]' : 'text-[var(--sw-ink)]'
          )}>{lowStockCount}</p>
        </div>
      </div>

      {/* Stock table */}
      {sorted.length === 0 ? (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <p className="text-[var(--sw-ink-2)]">Aucun article en stock.</p>
        </div>
      ) : (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--sw-ink-2)]">Produit</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--sw-ink-2)]">Disponible</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--sw-ink-2)]">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--sw-ink-2)]">Réservé</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--sw-ink-2)]">Seuil</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--sw-ink-2)]">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sw-line)]">
                {sorted.map(item => {
                  const qtyAvail = item.quantity_available ?? 0
                  const threshold = item.reorder_threshold ?? 0
                  const isLow = qtyAvail <= threshold
                  const product = item.pharmacy_products

                  return (
                    <tr key={item.id} className={cn(isLow && 'bg-[var(--sw-warning-bg)]')}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--sw-ink)]">{product?.name ?? 'N/A'}</p>
                        {(product?.generic_name || product?.dci) && (
                          <p className="text-xs text-[var(--sw-ink-3)]">
                            {product.generic_name ?? product.dci}
                          </p>
                        )}
                      </td>
                      <td className={cn(
                        'px-4 py-3 text-right font-semibold',
                        isLow ? 'text-[var(--sw-warning)]' : 'text-[var(--sw-ink)]'
                      )}>
                        {qtyAvail}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--sw-ink-2)]">
                        {item.quantity_total ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--sw-ink-2)]">
                        {item.quantity_reserved ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--sw-ink-2)]">
                        {threshold}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] font-medium">
                            Stock bas
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-[var(--sw-success-bg)] text-[var(--sw-success)] font-medium">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
