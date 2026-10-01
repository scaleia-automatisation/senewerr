import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCFA, formatDate, cn } from '@/lib/utils'

type Product = {
  id: string
  name: string
  generic_name: string | null
  dci: string | null
  category: string | null
  unit_price_fcfa: number | null
  prescription_required: boolean | null
  is_available: boolean | null
  created_at: string
}

const CATEGORY_COLORS: Record<string, string> = {
  analgesique: 'bg-blue-50 text-blue-700',
  antibiotique: 'bg-orange-50 text-orange-700',
  antiviral: 'bg-purple-50 text-purple-700',
  cardiovasculaire: 'bg-red-50 text-red-700',
  dermatologie: 'bg-green-50 text-green-700',
  vitamines: 'bg-yellow-50 text-yellow-700',
}

function categoryStyle(cat: string | null) {
  if (!cat) return 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'
  return CATEGORY_COLORS[cat.toLowerCase()] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'
}

export default async function CataloguePage() {
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

  const { data: productsData } = await supabase
    .from('produits_pharmacie')
    .select('id, name, generic_name, dci, category, unit_price_fcfa, prescription_required, is_available, created_at')
    .eq('pharmacy_id', pharmacy.id)
    .order('created_at', { ascending: false })

  const products = (productsData ?? []) as unknown as Product[]
  const availableCount = products.filter(p => p.is_available).length
  const prescriptionCount = products.filter(p => p.prescription_required).length

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--sw-ink)]">Catalogue</h1>
          <p className="text-[var(--sw-ink-2)] mt-1">{pharmacy.name}</p>
        </div>
        <button className="shrink-0 px-4 py-2 bg-[var(--sw-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
          + Ajouter un produit
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Total</p>
          <p className="text-3xl font-bold text-[var(--sw-ink)] mt-1">{products.length}</p>
        </div>
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Disponibles</p>
          <p className="text-3xl font-bold text-[var(--sw-success)] mt-1">{availableCount}</p>
        </div>
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4">
          <p className="text-sm text-[var(--sw-ink-2)]">Sur ordonnance</p>
          <p className="text-3xl font-bold text-[var(--sw-warning)] mt-1">{prescriptionCount}</p>
        </div>
      </div>

      {/* Products list */}
      {products.length === 0 ? (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <p className="text-[var(--sw-ink-2)]">Aucun produit dans le catalogue.</p>
          <p className="text-sm text-[var(--sw-ink-3)] mt-1">Ajoutez votre premier produit.</p>
        </div>
      ) : (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--sw-ink-2)]">Produit</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--sw-ink-2)]">Catégorie</th>
                  <th className="text-right px-4 py-3 font-medium text-[var(--sw-ink-2)]">Prix unitaire</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--sw-ink-2)]">Ordonnance</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--sw-ink-2)]">Disponible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sw-line)]">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--sw-surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--sw-ink)]">{p.name}</p>
                      {(p.generic_name || p.dci) && (
                        <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
                          {p.generic_name ?? p.dci}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.category ? (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', categoryStyle(p.category))}>
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-[var(--sw-ink-3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--sw-ink)]">
                      {formatCFA(p.unit_price_fcfa ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.prescription_required ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] font-medium">
                          Oui
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--sw-ink-3)]">Non</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-block w-2.5 h-2.5 rounded-full',
                        p.is_available ? 'bg-[var(--sw-success)]' : 'bg-[var(--sw-danger)]'
                      )} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
