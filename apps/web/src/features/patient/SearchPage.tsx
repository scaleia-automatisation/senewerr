import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

type Professional = {
  id: string
  full_name: string
  specialty: string
  establishment_name: string
  city: string
  consultation_fee: number
  teleconsultation: boolean
}

type Filters = {
  specialty: string
  city: string
  teleconsultation: boolean | null
  max_fee: number | null
}

const defaultFilters: Filters = { specialty: '', city: '', teleconsultation: null, max_fee: null }

export default function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [sortBy, setSortBy] = useState<'availability' | 'fee'>('availability')
  const [results, setResults] = useState<Professional[]>([])
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string, f: Filters) => {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('search_professionals', {
        p_query: q || null,
        p_specialty: f.specialty || null,
        p_city: f.city || null,
        p_teleconsultation: f.teleconsultation,
        p_max_fee: f.max_fee,
        p_limit: 20,
      })
      setResults(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(query, filters), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, filters, fetchResults])

  const handleAiSearch = async () => {
    if (!query.trim()) return
    setAiLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-smart-search', { body: { text: query } })
      if (!error && data?.filters) {
        const f = data.filters
        setFilters(prev => ({
          specialty: f.specialty ?? prev.specialty,
          city: f.city ?? prev.city,
          teleconsultation: f.teleconsultation ?? prev.teleconsultation,
          max_fee: f.max_fee ?? prev.max_fee,
        }))
      }
    } finally {
      setAiLoading(false)
    }
  }

  const sorted = [...results].sort((a, b) =>
    sortBy === 'fee' ? (a.consultation_fee ?? 0) - (b.consultation_fee ?? 0) : 0
  )

  return (
    <div className="p-s-4 max-w-3xl mx-auto space-y-gap-s-3">
      <h1 className="text-2xl font-semibold text-ink">Rechercher un professionnel</h1>

      <div className="flex gap-s-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <Input
            className="pl-9"
            placeholder="Médecin, spécialité, symptôme…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={handleAiSearch} disabled={aiLoading || !query.trim()}>
          <Sparkles className="w-4 h-4 mr-1" />
          {aiLoading ? 'Analyse…' : 'Recherche intelligente'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-s-2 md:grid-cols-4">
        <Input
          placeholder="Spécialité"
          value={filters.specialty}
          onChange={e => setFilters(f => ({ ...f, specialty: e.target.value }))}
        />
        <Input
          placeholder="Ville"
          value={filters.city}
          onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Tarif max (€)"
          value={filters.max_fee ?? ''}
          onChange={e => setFilters(f => ({ ...f, max_fee: e.target.value ? Number(e.target.value) : null }))}
        />
        <label className="flex items-center gap-s-2 text-sm text-ink-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.teleconsultation === true}
            onChange={e => setFilters(f => ({ ...f, teleconsultation: e.target.checked ? true : null }))}
            className="rounded"
          />
          Téléconsultation
        </label>
      </div>

      <div className="flex gap-s-2">
        {(['availability', 'fee'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              sortBy === s
                ? 'bg-primary text-white border-primary'
                : 'border-line text-ink-2 hover:border-primary'
            }`}
          >
            {s === 'availability' ? 'Disponibilité' : 'Tarif'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-gap-s-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title="Aucun professionnel trouvé"
          description="Essayez d'élargir vos critères ou utilisez la recherche intelligente pour décrire votre besoin."
        />
      ) : (
        <div className="space-y-gap-s-2">
          {sorted.map(pro => (
            <Card key={pro.id} className="p-s-4 flex items-center justify-between gap-s-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-s-2 flex-wrap">
                  <p className="font-medium text-ink">{pro.full_name}</p>
                  {pro.teleconsultation && <Badge variant="info">Téléconsultation</Badge>}
                </div>
                <p className="text-sm text-ink-2">{pro.specialty}</p>
                <p className="text-sm text-ink-3">{pro.establishment_name} — {pro.city}</p>
              </div>
              <div className="text-right shrink-0 space-y-gap-s-2">
                <p className="font-semibold text-ink">{pro.consultation_fee}€</p>
                <Button size="sm" onClick={() => navigate(`/app/pro/${pro.id}`)}>
                  Voir le profil
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
