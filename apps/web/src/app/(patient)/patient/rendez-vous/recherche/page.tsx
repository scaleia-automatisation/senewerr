'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, MapPin, Star, ArrowRight, Loader2, X } from 'lucide-react'

type Professional = {
  id: string; specialty: string | null; professional_type: string | null
  title: string | null; consultation_fee_fcfa: number | null; languages: string[] | null
  profiles: { first_name: string | null; last_name: string | null } | null
  establishment_professionals: { establishments: { id: string; name: string; address_commune: string | null; address_region: string | null } | null }[]
}

const SPECIALTIES = [
  'Médecine générale', 'Pédiatrie', 'Gynécologie', 'Cardiologie', 'Dermatologie',
  'Ophtalmologie', 'Orthopédie', 'Neurologie', 'Psychiatrie', 'Sage-femme', 'Infirmier(ière)',
]

export default function RechercheRDVPage() {
  const [q, setQ] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [commune, setCommune] = useState('')
  const [results, setResults] = useState<Professional[]>([])
  const [searched, setSearched] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const supabase = createClient()
      let query = supabase
        .from('professionnels')
        .select('id, specialty, professional_type, title, consultation_fee_fcfa, languages, profiles!inner(first_name, last_name, account_status), establishment_professionals(establishments(id, name, address_commune, address_region))')
        .eq('profiles.account_status', 'verified')

      if (specialty) query = query.eq('specialty', specialty)
      if (q) query = query.or(`specialty.ilike.%${q}%`)

      const { data } = await query.limit(20)
      let pros = (data ?? []) as unknown as Professional[]

      // Filter by name (client-side since profiles join)
      if (q) {
        pros = pros.filter(p => {
          const name = `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.toLowerCase()
          return name.includes(q.toLowerCase()) || (p.specialty ?? '').toLowerCase().includes(q.toLowerCase())
        })
      }

      // Filter by commune (client-side)
      if (commune) {
        pros = pros.filter(p =>
          p.establishment_professionals?.some(ep =>
            (ep.establishments?.address_commune ?? '').toLowerCase().includes(commune.toLowerCase())
          )
        )
      }

      setResults(pros)
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
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Trouver un professionnel</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Recherchez et prenez rendez-vous en ligne</p>
      </div>

      {/* Formulaire de recherche */}
      <form onSubmit={handleSearch} className="sw-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sw-ink-3)]" />
          <input
            type="text"
            placeholder="Nom, spécialité…"
            className="sw-input w-full pl-9"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-[var(--sw-ink-3)]" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <select className="sw-input w-full text-sm" value={specialty} onChange={e => setSpecialty(e.target.value)}>
              <option value="">Toutes spécialités</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sw-ink-3)]" />
            <input
              type="text"
              placeholder="Commune…"
              className="sw-input w-full pl-9 text-sm"
              value={commune}
              onChange={e => setCommune(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" disabled={isPending} className="w-full py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Rechercher
        </button>
      </form>

      {/* Résultats */}
      {searched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="sw-card p-8 text-center">
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun professionnel trouvé pour ces critères.</p>
              <p className="text-xs text-[var(--sw-ink-3)] mt-1">Essayez d'élargir votre recherche.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--sw-ink-2)]">{results.length} résultat{results.length > 1 ? 's' : ''}</p>
              {results.map(p => {
                const pro = p as unknown as Professional
                const name = `${pro.title ? pro.title + ' ' : ''}${pro.profiles?.first_name ?? ''} ${pro.profiles?.last_name ?? ''}`.trim()
                const establishments = (pro.establishment_professionals ?? [])
                  .map(ep => ep.establishments)
                  .filter(Boolean) as { id: string; name: string; address_commune: string | null }[]
                const firstEst = establishments[0]
                const feeCFA = fmtCFA(pro.consultation_fee_fcfa)
                return (
                  <div key={pro.id} className="sw-card p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[var(--sw-ink)]">{name || 'Professionnel'}</p>
                        {pro.specialty && <p className="text-xs text-[var(--sw-primary)] font-medium">{pro.specialty}</p>}
                        {firstEst && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
                            <MapPin className="w-3 h-3" />
                            <span>{firstEst.name}{firstEst.address_commune ? ` · ${firstEst.address_commune}` : ''}</span>
                          </div>
                        )}
                        {feeCFA && (
                          <p className="text-xs font-medium text-[var(--sw-ink)]">Consultation : {feeCFA}</p>
                        )}
                        {Array.isArray(pro.languages) && pro.languages.length > 0 && (
                          <p className="text-xs text-[var(--sw-ink-3)]">Langues : {pro.languages.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/patient/rendez-vous/reserver/${pro.id}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[var(--sw-primary)] text-[var(--sw-primary)] text-sm font-medium hover:bg-[var(--sw-primary-subtle)] transition-colors"
                    >
                      Prendre rendez-vous <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {!searched && (
        <div className="sw-card p-8 text-center">
          <Search className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Recherchez un professionnel de santé pour voir les disponibilités.</p>
        </div>
      )}
    </div>
  )
}
