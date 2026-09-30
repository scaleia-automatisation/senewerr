'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, MapPin, ShoppingBag, Info, X, Loader2, Pill } from 'lucide-react'

type PharmacyInfo = { id: string; name: string; address_commune: string | null; address_region: string | null }
type StockInfo = { quantity_available: number | null } | null

type Product = {
  id: string
  name: string
  dosage: string | null
  form: string | null
  prescription_required: boolean
  description: string | null
  unit_price_fcfa: number | null
  pharmacy_id: string
  pharmacies: PharmacyInfo | null
  pharmacy_stock: StockInfo | StockInfo[]
}

type Group = {
  signature: string
  name: string
  dosage: string | null
  form: string | null
  prescription_required: boolean
  description: string | null
  products: Product[]
}

export default function RecherchePharmaciesPage() {
  const [q, setQ] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    startTransition(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('pharmacy_products')
        .select('id, name, dosage, form, prescription_required, description, unit_price_fcfa, pharmacy_id, pharmacies(id, name, address_commune, address_region), pharmacy_stock(quantity_available)')
        .ilike('name', `%${q.trim()}%`)
        .eq('is_available', true)
        .limit(30)

      const products = (data ?? []) as unknown as Product[]

      // Group by name+dosage (same drug at different pharmacies)
      const map = new Map<string, Group>()
      for (const p of products) {
        const sig = `${p.name}||${p.dosage ?? ''}`
        if (!map.has(sig)) {
          map.set(sig, { signature: sig, name: p.name, dosage: p.dosage, form: p.form, prescription_required: p.prescription_required, description: p.description, products: [] })
        }
        map.get(sig)!.products.push(p)
      }
      setGroups(Array.from(map.values()))
      setSearched(true)
    })
  }

  function fmtCFA(n: number | null) {
    if (n == null) return null
    return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Recherche de médicaments</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Vérifiez la disponibilité et réservez en pharmacie</p>
      </div>

      <form onSubmit={handleSearch} className="sw-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sw-ink-3)]" />
          <input type="text" placeholder="Nom du médicament, dosage…" className="sw-input w-full pl-9"
            value={q} onChange={e => setQ(e.target.value)} />
          {q && (
            <button type="button" onClick={() => { setQ(''); setGroups([]); setSearched(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sw-ink-3)]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button type="submit" disabled={isPending || !q.trim()}
          className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Rechercher
        </button>
      </form>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Les informations affichées ne constituent pas un conseil médical. La disponibilité est déclarée par les pharmacies. Consultez un pharmacien ou un professionnel de santé pour tout avis médical.
        </p>
      </div>

      {searched && (
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="sw-card p-8 text-center">
              <Pill className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun médicament trouvé pour « {q} ».</p>
              <p className="text-xs text-[var(--sw-ink-3)] mt-1">Essayez un autre terme ou contactez directement une pharmacie.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--sw-ink-2)]">{groups.length} résultat{groups.length > 1 ? 's' : ''}</p>
              {groups.map(group => (
                <div key={group.signature} className="sw-card overflow-hidden">
                  <div className="p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                        <Pill className="w-4 h-4 text-[var(--sw-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--sw-ink)]">{group.name}</p>
                          {group.prescription_required ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium">Sur ordonnance</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sw-success-bg)] text-[var(--sw-success)] font-medium">Sans ordonnance</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--sw-ink-2)]">
                          {[group.dosage, group.form].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {group.description && (
                        <button onClick={() => setExpanded(expanded === group.signature ? null : group.signature)}
                          className="text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)] shrink-0">
                          <Info className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {expanded === group.signature && group.description && (
                      <p className="text-xs text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)] rounded-xl px-3 py-2 italic">
                        {group.description}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-[var(--sw-line)] divide-y divide-[var(--sw-line)]">
                    {group.products.map(product => {
                      const ph = product.pharmacies
                      return (
                        <div key={product.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            {ph?.name && <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{ph.name}</p>}
                            {ph?.address_commune && (
                              <div className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)]">
                                <MapPin className="w-3 h-3" />
                                <span>{ph.address_commune}</span>
                              </div>
                            )}
                            {fmtCFA(product.unit_price_fcfa) && (
                              <p className="text-xs font-medium text-[var(--sw-ink)] mt-0.5">{fmtCFA(product.unit_price_fcfa)}</p>
                            )}
                          </div>
                          <Link
                            href={`/patient/pharmacie/reserver?productId=${product.id}&pharmacyId=${ph?.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--sw-primary)] text-white text-xs font-medium hover:opacity-90 whitespace-nowrap shrink-0">
                            <ShoppingBag className="w-3.5 h-3.5" /> Réserver
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {!searched && (
        <div className="sw-card p-8 text-center">
          <Search className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Entrez le nom d'un médicament pour voir les disponibilités en pharmacie.</p>
        </div>
      )}
    </div>
  )
}
