import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, Hash, Building2 } from 'lucide-react'
import { AccountStatusBanner } from '@/components/ui/account-status-banner'
import { ValidationButtons } from '@/components/admin/validation-buttons'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Détail compte — Admin' }

type TableName = 'professionals' | 'establishments' | 'pharmacies' | 'coverage_orgs'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ table?: string }>
}

export default async function AdminUtilisateurDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { table = 'professionals' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/admin/utilisateurs')

  const tableName = table as TableName

  // Requête générique selon la table
  const selectMap: Record<TableName, string> = {
    professionals: 'id, profile_id, created_at, professional_type, specialty, ordre_number, consultation_fee_fcfa, address_region, address_commune, profiles!profile_id(first_name, last_name, phone, email, account_status, verification_notes)',
    establishments: 'id, profile_id, created_at, name, category, establishment_type, phone, email, address_region, profiles!profile_id(first_name, last_name, phone, account_status, verification_notes)',
    pharmacies: 'id, profile_id, created_at, name, phone, email, address_region, address_details, profiles!profile_id(first_name, last_name, phone, account_status, verification_notes)',
    coverage_orgs: 'id, profile_id, created_at, name, org_type, phone, email, address_region, profiles!profile_id(first_name, last_name, phone, account_status, verification_notes)',
  }

  const { data } = await supabase
    .from(tableName)
    .select(selectMap[tableName])
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()

  const account = data as unknown as Record<string, unknown> & {
    profile_id: string
    profiles: {
      first_name: string; last_name: string; phone: string | null; email?: string | null
      account_status: string; verification_notes: string | null
    } | null
  }

  const proName = account.profiles
    ? `${account.profiles.first_name} ${account.profiles.last_name}`.trim()
    : 'Inconnu'

  function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
    if (!value) return null
    return (
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-[var(--sw-ink-3)]">{label}</p>
          <p className="text-sm text-[var(--sw-ink)] font-medium">{value}</p>
        </div>
      </div>
    )
  }

  const TYPE_LABELS: Record<string, string> = {
    professionals:  'Professionnel de santé',
    establishments: 'Établissement de santé',
    pharmacies:     'Pharmacie',
    coverage_orgs:  'Organisme de couverture',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <Link
        href={`/admin/utilisateurs?type=${tableName}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      {/* Entête */}
      <div className="sw-card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <span className="text-base font-bold text-[var(--sw-primary)]">
            {proName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--sw-ink)]">{proName}</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">
            {TYPE_LABELS[tableName]} · Inscrit le {new Date(account.created_at as string).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      {/* Bannière de statut */}
      {account.profiles?.account_status && account.profiles.account_status !== 'verified' && (
        <AccountStatusBanner
          status={account.profiles.account_status as 'pending'}
          motif={account.profiles.verification_notes}
        />
      )}

      {/* Informations du compte */}
      <div className="sw-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Informations</h2>
        <div className="space-y-3">
          <Field icon={User}     label="Compte"   value={proName} />
          <Field icon={Phone}    label="Téléphone" value={account.profiles?.phone ?? (account.phone as string | null)} />
          <Field icon={Mail}     label="E-mail"    value={(account.profiles?.email ?? account.email) as string | null} />
          <Field icon={MapPin}   label="Région"    value={account.address_region as string | null} />

          {/* Champs spécifiques selon le type */}
          {tableName === 'professionals' && (
            <>
              <Field icon={Hash}      label="Profession"   value={(account.professional_type as string | null)?.replace(/_/g, ' ')} />
              <Field icon={Hash}      label="Spécialité"   value={account.specialty as string | null} />
              <Field icon={Hash}      label="N° identification" value={account.ordre_number as string | null} />
              <Field icon={MapPin}    label="Commune"      value={account.address_commune as string | null} />
              {(account.consultation_fee_fcfa as number | null) != null && (
                <Field icon={Hash} label="Tarif consultation" value={`${(account.consultation_fee_fcfa as number).toLocaleString('fr-FR')} FCFA`} />
              )}
            </>
          )}

          {tableName === 'establishments' && (
            <>
              <Field icon={Building2} label="Nom"           value={account.name as string | null} />
              <Field icon={Hash}      label="Catégorie"     value={account.category as string | null} />
              <Field icon={Hash}      label="Type"          value={(account.establishment_type as string | null)?.replace(/_/g, ' ')} />
              <Field icon={User}      label="Responsable"   value={account.responsible_name as string | null} />
              <Field icon={Phone}     label="Tél. direct"   value={account.phone as string | null} />
            </>
          )}

          {tableName === 'pharmacies' && (
            <>
              <Field icon={Building2} label="Pharmacie"     value={account.name as string | null} />
              <Field icon={Phone}     label="Téléphone"     value={account.phone as string | null} />
              <Field icon={MapPin}    label="Adresse"       value={account.address_details as string | null} />
            </>
          )}

          {tableName === 'coverage_orgs' && (
            <>
              <Field icon={Building2} label="Organisme" value={account.name as string | null} />
              <Field icon={Hash}      label="Type"      value={(account.org_type as string | null)?.replace(/_/g, ' ')} />
              <Field icon={Phone}     label="Téléphone" value={account.phone as string | null} />
            </>
          )}
        </div>
      </div>

      {/* Actions de validation */}
      <div className="sw-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Décision</h2>
        <ValidationButtons
          profileId={account.profile_id}
          currentStatus={account.profiles?.account_status ?? 'pending'}
        />
      </div>
    </div>
  )
}
