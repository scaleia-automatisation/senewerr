import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { MapPin, Phone, Clock, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import { Seo } from '@/hooks/useSeo'
import { SchemaPharmacy, SchemaBreadcrumb } from '@/components/seo/SchemaOrg'
import type { Database } from '@medikool/shared'

type OrgRow = Database['public']['Tables']['organizations']['Row']

interface PharmacyData extends OrgRow {
  stock_count?: number
}

export default function PharmacyPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [pharmacy, setPharmacy] = useState<PharmacyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return

    supabase
      .from('organizations')
      .select('*')
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .eq('type', 'pharmacy')
      .eq('verification_status', 'verified')
      .eq('is_active', true)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
          setLoading(false)
          return
        }

        // Fetch rough stock count for teaser (non-blocking)
        let stock_count: number | undefined
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count } = await (supabase as any)
            .from('pharmacy_inventory')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', data.id)
            .gt('quantity', 0)
          stock_count = count ?? undefined
        } catch {
          // ignore — stock count is optional
        }

        setPharmacy({ ...data, stock_count })
        setLoading(false)
      })
  }, [slug])

  if (loading) return <PageSpinner />
  if (notFound) return <Navigate to="/" replace />

  const name = pharmacy?.name ?? 'Pharmacie'
  const city = pharmacy?.city ?? ''
  const pageTitle = `${name}${city ? ` — ${city}` : ''} | Pharmacie sur Séne Wérr`
  const description =
    pharmacy?.description
      ? `${pharmacy.description.slice(0, 140)}…`
      : `Commandez vos médicaments à ${name}${city ? ` à ${city}` : ''} via Séne Wérr. Réservez en ligne en quelques clics.`

  return (
    <>
      <Seo
        title={pageTitle}
        description={description}
        canonical={`/pharmacie/${slug}`}
        ogType="website"
      />
      <SchemaPharmacy
        name={name}
        telephone={pharmacy?.phone ?? undefined}
        addressLocality={city || undefined}
        url={`https://senewerr.com/pharmacie/${slug}`}
      />
      <SchemaBreadcrumb
        items={[
          { name: 'Accueil', url: '/' },
          { name: 'Pharmacies', url: '/recherche-publique' },
          { name: name, url: `/pharmacie/${slug}` },
        ]}
      />

      <div className="mx-auto max-w-3xl px-s-4 py-s-8">
        {/* Header */}
        <div className="mb-s-6 flex items-start gap-s-4">
          {pharmacy?.logo_url ? (
            <img
              src={pharmacy.logo_url}
              alt={name}
              className="h-20 w-20 rounded-2xl object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-soft text-h2 font-semibold text-primary">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-display text-h1 font-semibold text-ink">{name}</h1>
            <p className="mt-1 text-small font-medium text-success">
              Pharmacie vérifiée Séne Wérr
            </p>
          </div>
        </div>

        {/* Description */}
        {pharmacy?.description && (
          <p className="mb-s-6 text-body leading-relaxed text-ink-2">
            {pharmacy.description}
          </p>
        )}

        {/* Details */}
        <div className="mb-s-6 space-y-s-3">
          {(pharmacy?.address || city) && (
            <div className="flex items-start gap-s-2 text-body text-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                {[pharmacy?.address, city, pharmacy?.region]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </div>
          )}
          {pharmacy?.phone && (
            <div className="flex items-center gap-s-2 text-body text-ink-2">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${pharmacy.phone}`} className="hover:text-primary">
                {pharmacy.phone}
              </a>
            </div>
          )}
          {pharmacy?.stock_count != null && pharmacy.stock_count > 0 && (
            <div className="flex items-center gap-s-2 text-body text-ink-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span>
                {pharmacy.stock_count.toLocaleString('fr-SN')} médicaments disponibles
              </span>
            </div>
          )}
        </div>

        {/* Hours note */}
        <div className="mb-s-6 flex items-center gap-s-2 rounded-xl bg-amber-50 px-s-4 py-s-3 text-small text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Horaires et disponibilités en temps réel après inscription</span>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-line bg-surface-2 p-s-6 text-center">
          <p className="mb-s-3 font-medium text-ink">
            Réservez vos médicaments à {name}
          </p>
          <Link
            to="/auth/inscription"
            className="inline-flex items-center gap-s-2 rounded-xl bg-primary px-s-5 py-s-3 font-medium text-white transition-opacity hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4" />
            Réserver dans cette pharmacie
          </Link>
          <p className="mt-s-2 text-small text-ink-3">
            Compte gratuit · Paiement en ligne ou sur place
          </p>
        </div>
      </div>
    </>
  )
}
