import Link from 'next/link'
import { Pill, FileText, ShoppingBag, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Médicaments' }

interface PharmacyProduct {
  id: string
  name: string
  generic_name: string | null
  dci: string | null
  category: string | null
  unit_price_fcfa: number
  prescription_required: boolean
  pharmacies: {
    id: string
    name: string
    address_commune: string | null
    address_region: string | null
  } | null
}

export default async function MedicamentsPage() {
  const supabase = await createClient()

  // Fetch available products (in stock at at least one pharmacy)
  const { data: products, count } = await supabase
    .from('produits_pharmacie')
    .select(`
      id,
      name,
      generic_name,
      dci,
      category,
      unit_price_fcfa,
      prescription_required,
      pharmacies(id, name, address_commune, address_region)
    `, { count: 'exact' })
    .eq('is_available', true)
    .order('name', { ascending: true })
    .limit(50)

  const availableProducts = (products ?? []) as unknown as PharmacyProduct[]

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Médicaments</h1>
        {count != null && count > 0 && (
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
            {count} produit{count > 1 ? 's' : ''} disponible{count > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* CTA ordonnance */}
      <div className="sw-card p-4 flex items-center justify-between gap-3 border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[var(--sw-primary)] flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--sw-ink)]">Vous avez une ordonnance ?</p>
            <p className="text-xs text-[var(--sw-ink-2)]">Réservez vos médicaments directement</p>
          </div>
        </div>
        <Link
          href="/patient/ordonnances"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[var(--sw-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Voir
        </Link>
      </div>

      {/* Products grid */}
      {availableProducts.length === 0 ? (
        <div className="sw-card p-10 flex flex-col items-center gap-4 text-center">
          <Pill className="w-12 h-12 text-[var(--sw-ink-3)]" />
          <div>
            <p className="text-sm font-medium text-[var(--sw-ink)]">Aucun médicament disponible</p>
            <p className="text-xs text-[var(--sw-ink-2)] mt-1">
              Les stocks des pharmacies partenaires s'afficheront ici
            </p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
            Disponible en pharmacie
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableProducts.map(product => (
              <div key={product.id} className="sw-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--sw-success-bg)] flex items-center justify-center flex-shrink-0">
                    <Pill className="w-4 h-4 text-[var(--sw-success)]" />
                  </div>
                  {product.prescription_required && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]">
                      Ordonnance
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-[var(--sw-ink)] leading-tight">{product.name}</p>
                  {product.generic_name && (
                    <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">{product.generic_name}</p>
                  )}
                  {product.dci && product.dci !== product.generic_name && (
                    <p className="text-xs text-[var(--sw-ink-3)]">DCI : {product.dci}</p>
                  )}
                </div>

                {product.category && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]">
                    {product.category}
                  </span>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[var(--sw-line)]">
                  <span className="text-sm font-bold text-[var(--sw-primary)]">
                    {formatCFA(product.unit_price_fcfa)}
                  </span>
                  {product.pharmacies && (
                    <p className="text-xs text-[var(--sw-ink-3)] text-right max-w-[120px] leading-tight">
                      {product.pharmacies.name}
                    </p>
                  )}
                </div>

                <Link
                  href={`/patient/pharmacie/reserver?productId=${product.id}&pharmacyId=${product.pharmacies?.id}`}
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-medium hover:bg-[var(--sw-primary)] hover:text-white transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Réserver
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Info supplémentaire */}
      <div className="sw-card p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[var(--sw-info)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-ink-2)]">
          Les prix sont fournis à titre indicatif et peuvent varier selon les pharmacies.
          La disponibilité est mise à jour en temps réel.
        </p>
      </div>
    </div>
  )
}
