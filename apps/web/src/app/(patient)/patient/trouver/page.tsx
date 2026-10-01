import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Search, MapPin, Stethoscope, Building2, Star, Calendar, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Trouver un professionnel — Séné Wérr' }

interface Props {
  searchParams: Promise<{ q?: string; region?: string; type?: string; specialty?: string }>
}

interface ProfessionalResult {
  id: string
  professional_type: string
  specialty: string | null
  title: string | null
  consultation_fee_fcfa: number | null
  teleconsultation_enabled: boolean
  address_region: string | null
  address_commune: string | null
  profiles: { first_name: string; last_name: string } | null
}

interface EstablishmentResult {
  id: string
  name: string
  establishment_type: string
  category: string
  address_region: string
  address_commune: string | null
  phone: string | null
  emergency_available: boolean
}

const PROFESSIONAL_TYPE_LABELS: Record<string, string> = {
  medecin_generaliste:  'Médecin généraliste',
  medecin_specialiste:  'Médecin spécialiste',
  chirurgien_dentiste:  'Chirurgien-dentiste',
  sage_femme:           'Sage-femme',
  infirmier:            'Infirmier(ère)',
  paramedicale:         'Paramédical(e)',
  autre:                'Professionnel de santé',
}

const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  clinique:            'Clinique',
  cabinet_medical:     'Cabinet médical',
  hopital_eps1:        'Hôpital EPS1',
  hopital_eps2:        'Hôpital EPS2',
  hopital_eps3:        'Hôpital EPS3',
  centre_sante_cs1:    'Centre de santé',
  centre_sante_cs2:    'Centre de santé',
  laboratoire:         "Laboratoire d'analyses",
  centre_radiologie:   'Centre de radiologie',
  cabinet_paramedical: 'Cabinet paramédical',
}

const REGIONS = ['Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Matam', 'Tambacounda', 'Kédougou', 'Kaolack', 'Kaffrine', 'Fatick', 'Ziguinchor', 'Sédhiou', 'Kolda', 'Louga']

export default async function TrouverPage({ searchParams }: Props) {
  const { q = '', region = '', type = 'professionnels', specialty = '' } = await searchParams
  const supabase = await createClient()

  let professionals: ProfessionalResult[] = []
  let establishments: EstablishmentResult[] = []

  if (type === 'professionnels' || !type) {
    let query = supabase
      .from('professionnels')
      .select(`
        id,
        professional_type,
        specialty,
        title,
        consultation_fee_fcfa,
        teleconsultation_enabled,
        address_region,
        address_commune,
        profiles!inner(first_name, last_name)
      `)
      .limit(24)

    if (region) query = query.eq('address_region', region)
    if (specialty) query = query.ilike('specialty', `%${specialty}%`)
    if (q) {
      // search name via profiles or specialty
      query = query.or(`specialty.ilike.%${q}%,professional_type.ilike.%${q}%`)
    }

    const { data } = await query
    professionals = (data ?? []) as unknown as ProfessionalResult[]
  } else {
    let query = supabase
      .from('etablissements')
      .select(`
        id,
        name,
        establishment_type,
        category,
        address_region,
        address_commune,
        phone,
        emergency_available
      `)
      .limit(24)

    if (region) query = query.eq('address_region', region)
    if (q) query = query.ilike('name', `%${q}%`)

    const { data } = await query
    establishments = (data ?? []) as unknown as EstablishmentResult[]
  }

  const totalResults = type === 'professionnels' ? professionals.length : establishments.length

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Trouver un professionnel</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">Recherchez par spécialité, région ou nom d&apos;établissement</p>
      </div>

      {/* Formulaire de recherche */}
      <form method="GET" action="/patient/trouver" className="space-y-3">
        {/* Tabs */}
        <div className="flex gap-2">
          {(['professionnels', 'etablissements'] as const).map(t => (
            <button
              key={t}
              type="submit"
              name="type"
              value={t}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                type === t
                  ? 'bg-[var(--sw-primary)] text-white'
                  : 'bg-[var(--sw-surface)] border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
              }`}
            >
              {t === 'professionnels' ? <Stethoscope className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              {t === 'professionnels' ? 'Professionnels' : 'Établissements'}
            </button>
          ))}
          <input type="hidden" name="type" value={type} />
        </div>

        {/* Barre de recherche + filtres */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sw-ink-3)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder={type === 'professionnels' ? 'Spécialité, nom…' : 'Nom d\'établissement…'}
              className="sw-input w-full pl-9"
            />
          </div>
          <select name="region" defaultValue={region} className="sw-input min-w-36">
            <option value="">Toutes les régions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {type === 'professionnels' && (
            <input name="specialty" defaultValue={specialty} placeholder="Spécialité" className="sw-input min-w-36" />
          )}
          <button type="submit" className="px-4 py-2 bg-[var(--sw-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Rechercher
          </button>
        </div>
      </form>

      {/* Résultats */}
      <div>
        <p className="text-xs text-[var(--sw-ink-3)] mb-3">
          {totalResults} résultat{totalResults !== 1 ? 's' : ''}
          {region ? ` · ${region}` : ''}
          {q ? ` · "${q}"` : ''}
        </p>

        {type === 'professionnels' ? (
          professionals.length === 0 ? (
            <EmptyState type="professionnels" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {professionals.map(pro => {
                const fullName = pro.profiles
                  ? `${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
                  : 'Professionnel'
                const initials = fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <div key={pro.id} className="sw-card p-4 space-y-3 hover:border-[var(--sw-primary)] transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-[var(--sw-primary)]">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--sw-ink)] truncate">
                          {pro.title ? `${pro.title} ` : ''}{fullName}
                        </p>
                        <p className="text-xs text-[var(--sw-ink-2)]">
                          {PROFESSIONAL_TYPE_LABELS[pro.professional_type] ?? pro.professional_type}
                          {pro.specialty ? ` · ${pro.specialty}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--sw-ink-3)]">
                      {(pro.address_commune ?? pro.address_region) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {pro.address_commune ?? pro.address_region}
                        </span>
                      )}
                      {pro.consultation_fee_fcfa != null && pro.consultation_fee_fcfa > 0 && (
                        <span className="font-medium text-[var(--sw-ink-2)]">
                          {pro.consultation_fee_fcfa.toLocaleString('fr-FR')} FCFA
                        </span>
                      )}
                      {pro.teleconsultation_enabled && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--sw-info-bg,#eff6ff)] text-[var(--sw-info,#3b82f6)]">
                          Téléconsultation
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/prendre-rendez-vous/${pro.id}`}
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Prendre rendez-vous
                    </Link>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          establishments.length === 0 ? (
            <EmptyState type="etablissements" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {establishments.map(est => (
                <div key={est.id} className="sw-card p-4 space-y-3 hover:border-[var(--sw-primary)] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-[var(--sw-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--sw-ink)] truncate">{est.name}</p>
                      <p className="text-xs text-[var(--sw-ink-2)]">
                        {ESTABLISHMENT_TYPE_LABELS[est.establishment_type] ?? est.establishment_type}
                      </p>
                    </div>
                    {est.emergency_available && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)] shrink-0">
                        Urgences
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--sw-ink-3)]">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {est.address_commune ?? est.address_region}
                    </span>
                    {est.phone && (
                      <a href={`tel:${est.phone}`} className="text-[var(--sw-primary)] hover:underline">
                        {est.phone}
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/prendre-rendez-vous/${est.id}?type=etablissement`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-[var(--sw-primary)] text-[var(--sw-primary)] text-sm font-medium hover:bg-[var(--sw-primary-subtle)] transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Prendre rendez-vous
                  </Link>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ type }: { type: 'professionnels' | 'etablissements' }) {
  return (
    <div className="sw-card p-10 text-center space-y-2">
      {type === 'professionnels'
        ? <Stethoscope className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto" />
        : <Building2 className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto" />
      }
      <p className="font-medium text-[var(--sw-ink)]">Aucun résultat</p>
      <p className="text-sm text-[var(--sw-ink-2)]">Essayez une autre région ou spécialité.</p>
    </div>
  )
}
