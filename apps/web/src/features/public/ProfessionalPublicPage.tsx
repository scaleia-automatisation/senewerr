import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { MapPin, Stethoscope, CalendarDays, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import { Seo } from '@/hooks/useSeo'
import { SchemaPhysician, SchemaBreadcrumb } from '@/components/seo/SchemaOrg'

interface ProfessionalData {
  id: string
  specialty: string
  bio: string | null
  languages: string[] | null
  available_for_teleconsultation: boolean
  consultation_fee: number | null
  experience_years: number | null
  verification_status: string
  profile: {
    full_name: string
    avatar_url: string | null
    phone: string | null
  }
  organization: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
  } | null
}

const SPECIALTY_LABELS: Record<string, string> = {
  general_medicine: 'Médecine générale',
  cardiology: 'Cardiologie',
  dermatology: 'Dermatologie',
  gynecology: 'Gynécologie',
  neurology: 'Neurologie',
  ophthalmology: 'Ophtalmologie',
  orthopedics: 'Orthopédie',
  pediatrics: 'Pédiatrie',
  psychiatry: 'Psychiatrie',
  radiology: 'Radiologie',
  surgery: 'Chirurgie',
  dentistry: 'Dentisterie',
  pharmacy: 'Pharmacie',
  nursing: 'Soins infirmiers',
  midwifery: 'Sage-femme',
  other: 'Autre',
}

export default function ProfessionalPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [pro, setPro] = useState<ProfessionalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return

    // Query by slug or id (slug column not in generated TS types → cast to any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('professionals')
      .select(
        `id, specialty, bio, languages, available_for_teleconsultation, consultation_fee, experience_years, verification_status,
         profile:profiles!professionals_profile_id_fkey(full_name, avatar_url, phone),
         organization:organizations(name, address, city, phone)`,
      )
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .eq('verification_status', 'verified')
      .single()
      .then(({ data, error }: { data: ProfessionalData | null; error: unknown }) => {
        if (error || !data) setNotFound(true)
        else setPro(data)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <PageSpinner />
  if (notFound) return <Navigate to="/" replace />

  const name = pro?.profile?.full_name ?? 'Professionnel de santé'
  const specialty = pro?.specialty ? (SPECIALTY_LABELS[pro.specialty] ?? pro.specialty) : ''
  const city = pro?.organization?.city ?? ''
  const pageTitle = `${name}${specialty ? `, ${specialty}` : ''}${city ? ` à ${city}` : ''} — Séne Wérr`
  const description =
    pro?.bio
      ? `${pro.bio.slice(0, 140)}…`
      : `Prenez rendez-vous avec ${name}${specialty ? `, ${specialty}` : ''}${city ? ` à ${city}` : ''} sur Séne Wérr.`

  return (
    <>
      <Seo
        title={pageTitle}
        description={description}
        canonical={`/pro/${slug}`}
        ogType="website"
      />
      <SchemaPhysician
        name={name}
        specialty={specialty}
        telephone={pro?.profile?.phone ?? pro?.organization?.phone ?? undefined}
        addressLocality={city || undefined}
        url={`https://senewerr.com/pro/${slug}`}
      />
      <SchemaBreadcrumb
        items={[
          { name: 'Accueil', url: '/' },
          { name: 'Professionnels', url: '/recherche-publique' },
          { name: name, url: `/pro/${slug}` },
        ]}
      />

      <div className="mx-auto max-w-3xl px-s-4 py-s-8">
        {/* Header */}
        <div className="mb-s-6 flex items-start gap-s-4">
          {pro?.profile?.avatar_url ? (
            <img
              src={pro.profile.avatar_url}
              alt={name}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-h2 font-semibold text-primary">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-display text-h1 font-semibold text-ink">{name}</h1>
            {specialty && (
              <p className="mt-1 flex items-center gap-1.5 text-body text-ink-2">
                <Stethoscope className="h-4 w-4" />
                {specialty}
              </p>
            )}
            {pro?.experience_years && (
              <p className="mt-0.5 text-small text-ink-3">
                {pro.experience_years} ans d'expérience
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {pro?.bio && (
          <p className="mb-s-6 text-body leading-relaxed text-ink-2">{pro.bio}</p>
        )}

        {/* Details */}
        <div className="mb-s-6 space-y-s-2">
          {pro?.organization && (
            <div className="flex items-start gap-s-2 text-body text-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                {pro.organization.name}
                {pro.organization.address ? ` · ${pro.organization.address}` : ''}
                {pro.organization.city ? `, ${pro.organization.city}` : ''}
              </span>
            </div>
          )}
          {pro?.available_for_teleconsultation && (
            <div className="flex items-center gap-s-2 text-body text-ink-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>Téléconsultation disponible</span>
            </div>
          )}
          {pro?.languages && pro.languages.length > 0 && (
            <p className="text-small text-ink-3">
              Langues : {pro.languages.join(', ')}
            </p>
          )}
          {pro?.consultation_fee != null && (
            <p className="text-small text-ink-3">
              Consultation : {pro.consultation_fee.toLocaleString('fr-SN')} XOF
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-line bg-surface-2 p-s-6 text-center">
          <p className="mb-s-3 font-medium text-ink">
            Prenez rendez-vous avec {name}
          </p>
          <Link
            to="/auth/inscription"
            className="inline-flex items-center gap-s-2 rounded-xl bg-primary px-s-5 py-s-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            <CalendarDays className="h-4 w-4" />
            Prendre rendez-vous
          </Link>
          <p className="mt-s-2 text-small text-ink-3">
            Créez un compte gratuit pour réserver en ligne
          </p>
        </div>
      </div>
    </>
  )
}
