'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Search, Building2, ArrowLeft, MapPin, CheckCircle2 } from 'lucide-react'

const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  case_sante:          'Case de santé',
  poste_sante:         'Poste de santé',
  centre_sante_cs1:    'Centre de santé CS1',
  centre_sante_cs2:    'Centre de santé CS2',
  hopital_eps1:        'Hôpital EPS1',
  hopital_eps2:        'Hôpital EPS2',
  hopital_eps3:        'Hôpital EPS3',
  clinique:            'Clinique',
  cabinet_medical:     'Cabinet médical',
  cabinet_paramedical: 'Cabinet paramédical',
  poste_sante_prive:   'Poste de santé privé',
  structure_entreprise:"Structure d'entreprise",
  dispensaire_prive:   'Dispensaire privé',
  laboratoire:         "Laboratoire d'analyses",
  centre_radiologie:   'Centre de radiologie',
  centre_sante_mentale:'Centre de santé mentale',
  centre_reeducation:  'Centre de rééducation',
  centre_transfusion:  'Centre de transfusion sanguine',
  autre_specialise:    'Autre structure spécialisée',
}

interface EstablishmentResult {
  id: string
  name: string
  establishment_type: string
  address_region: string
  address_commune: string | null
}

export default function RejoindreEtablissementPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EstablishmentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [functionRole, setFunctionRole] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    const supabase = createClient()
    const { data } = await supabase
      .from('etablissements')
      .select('id, name, establishment_type, address_region, address_commune')
      .ilike('name', `%${query.trim()}%`)
      .limit(10)
    setResults((data ?? []) as unknown as EstablishmentResult[])
    setSearching(false)
  }

  async function handleRequest() {
    if (!selectedId) return
    setError('')
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Session expirée.'); setSending(false); return }

    const { data: proData } = await supabase
      .from('professionnels')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    const pro = proData as unknown as { id: string } | null
    if (!pro) { setError('Profil professionnel introuvable.'); setSending(false); return }

    const { error: err } = await (supabase.from('establishment_professionals') as unknown as {
      insert: (v: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      professional_id: pro.id,
      establishment_id: selectedId,
      function: functionRole.trim() || null,
      status: 'pending',
    })
    if (err) { setError(err.message); setSending(false); return }

    setDone(true)
    setSending(false)
  }

  if (done) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="sw-card p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-[var(--sw-success)]" />
          </div>
          <div>
            <p className="font-bold text-[var(--sw-ink)]">Demande envoyée !</p>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">
              L&apos;établissement recevra votre demande et pourra l&apos;accepter ou la refuser.
            </p>
          </div>
          <Link href="/sante/etablissements">
            <Button className="w-full">Voir mes rattachements</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/sante/etablissements" className="text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rejoindre un établissement</h1>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">Recherchez et envoyez une demande de rattachement</p>
        </div>
      </div>

      {/* Recherche */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Nom de l'établissement…"
          className="sw-input flex-1"
        />
        <Button type="submit" disabled={searching}>
          <Search className="w-4 h-4" />
        </Button>
      </form>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--sw-ink-3)]">{results.length} résultat{results.length > 1 ? 's' : ''}</p>
          {results.map(est => (
            <button
              key={est.id}
              type="button"
              onClick={() => setSelectedId(est.id)}
              className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-colors ${
                selectedId === est.id
                  ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]'
                  : 'border-[var(--sw-line)] bg-[var(--sw-surface)] hover:border-[var(--sw-primary)]'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${selectedId === est.id ? 'bg-[var(--sw-primary)]' : 'bg-[var(--sw-surface-2)]'}`}>
                <Building2 className={`w-5 h-5 ${selectedId === est.id ? 'text-white' : 'text-[var(--sw-ink-2)]'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${selectedId === est.id ? 'text-[var(--sw-primary)]' : 'text-[var(--sw-ink)]'}`}>
                  {est.name}
                </p>
                <p className="text-xs text-[var(--sw-ink-2)] mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {est.address_commune ?? est.address_region}
                  {' · '}
                  {ESTABLISHMENT_TYPE_LABELS[est.establishment_type] ?? est.establishment_type}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="text-sm text-[var(--sw-ink-2)] text-center py-4">Recherche en cours…</p>
      )}

      {/* Envoi de la demande */}
      {selectedId && (
        <div className="sw-card p-5 space-y-4">
          <p className="text-sm font-medium text-[var(--sw-ink)]">Préciser votre fonction (optionnel)</p>
          <input
            type="text"
            value={functionRole}
            onChange={e => setFunctionRole(e.target.value)}
            placeholder="Ex : Médecin de garde, Consultant…"
            className="sw-input w-full"
          />
          {error && (
            <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">{error}</p>
          )}
          <Button className="w-full" onClick={handleRequest} disabled={sending}>
            {sending ? 'Envoi…' : 'Envoyer la demande de rattachement'}
          </Button>
        </div>
      )}
    </div>
  )
}
