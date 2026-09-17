import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

interface PharmacyResult {
  pharmacyId: string
  pharmacyName: string
  city: string
  products: { productId: string; productName: string; availableQty: number; price: number; status: 'available' | 'low_stock' | 'unavailable' }[]
  totalPrice: number
}

export default function MedicinesPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const prescriptionId = params.get('ordonnance')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PharmacyResult[]>([])
  const [loading, setLoading] = useState(false)
  const [prescription, setPrescription] = useState<{ items: { medicine_name: string }[] } | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (prescriptionId) fetchPrescription()
  }, [prescriptionId])

  async function fetchPrescription() {
    const { data } = await supabase
      .from('prescriptions')
      .select('*, prescription_items(medicine_name, dosage, quantity)')
      .eq('id', prescriptionId)
      .single()
    if (data) {
      setPrescription(data)
      setSelectedItems(new Set(data.prescription_items.map((i: { medicine_name: string }) => i.medicine_name)))
    }
  }

  async function search() {
    if (!query.trim() && !prescriptionId) return
    setLoading(true)
    const searchQuery = query || (prescription?.items.map(i => i.medicine_name).join(' ') ?? '')
    const { data } = await supabase.rpc('search_pharmacy_products', { p_query: searchQuery, p_limit: 10 })
    setResults(data ?? [])
    setLoading(false)
  }

  function handleReserve(pharmacyId: string) {
    const searchParams = new URLSearchParams({ pharmacie: pharmacyId })
    if (prescriptionId) searchParams.set('ordonnance', prescriptionId)
    navigate(`/patient/reserver?${searchParams}`)
  }

  function stockBadge(status: string) {
    if (status === 'available') return <Badge variant="success">En stock</Badge>
    if (status === 'low_stock') return <Badge variant="warning">Stock limité</Badge>
    return <Badge variant="danger">Indisponible</Badge>
  }

  return (
    <div className="flex flex-col gap-s-4 p-s-4">
      <h1 className="text-h2 font-display text-ink">Trouver un médicament</h1>

      {prescription && (
        <Card className="p-s-4 bg-surface-2">
          <p className="text-small font-medium text-ink-2 mb-s-2">Médicaments de votre ordonnance</p>
          <div className="flex flex-wrap gap-s-2">
            {prescription.items.map((item: { medicine_name: string }) => (
              <label key={item.medicine_name} className="flex items-center gap-s-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.medicine_name)}
                  onChange={e => {
                    const next = new Set(selectedItems)
                    if (e.target.checked) next.add(item.medicine_name)
                    else next.delete(item.medicine_name)
                    setSelectedItems(next)
                  }}
                  className="accent-primary"
                />
                <span className="text-small text-ink">{item.medicine_name}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-s-2">
        <Input
          label=""
          placeholder="Rechercher un médicament…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <Button onClick={search} loading={loading} className="shrink-0">
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-s-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-md" />)}
        </div>
      )}

      {!loading && results.length === 0 && query && (
        <EmptyState title="Aucun résultat" description="Essayez un autre terme ou une ville différente." />
      )}

      <div className="flex flex-col gap-s-3">
        {results.map(pharmacy => (
          <Card key={pharmacy.pharmacyId} className="p-s-4">
            <div className="flex items-start justify-between gap-s-3">
              <div>
                <p className="font-semibold text-ink">{pharmacy.pharmacyName}</p>
                <div className="flex items-center gap-s-1 text-small text-ink-3">
                  <MapPin className="w-3 h-3" />
                  <span>{pharmacy.city}</span>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => handleReserve(pharmacy.pharmacyId)}
                className="shrink-0"
              >
                <ShoppingCart className="w-4 h-4 mr-s-1" />
                Réserver
              </Button>
            </div>
            <div className="mt-s-3 flex flex-col gap-s-2">
              {pharmacy.products.map(p => (
                <div key={p.productId} className="flex items-center justify-between text-small">
                  <span className="text-ink">{p.productName}</span>
                  <div className="flex items-center gap-s-2">
                    {stockBadge(p.status)}
                    <span className="font-medium text-ink">{p.price.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-s-2 text-right text-small font-semibold text-primary">
              Total : {pharmacy.totalPrice.toLocaleString('fr-FR')} FCFA
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}
