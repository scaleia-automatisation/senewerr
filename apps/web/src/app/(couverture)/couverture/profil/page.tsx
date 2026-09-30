import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, Phone, Mail, Globe, MapPin } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon organisme — Espace Couverture' }

const ORG_TYPE_LABELS: Record<string, string> = {
  mutuelle_communautaire: 'Mutuelle communautaire',
  msae: 'Mutuelle santé et assurance entreprise',
  mutuelle_professionnelle: 'Mutuelle professionnelle',
  ipm: 'Institution de prévoyance maladie (IPM)',
  assurance_privee: 'Assurance privée',
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  verified: { label: 'Vérifiée', color: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' },
  pending: { label: 'En attente', color: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]' },
  draft: { label: 'Brouillon', color: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]' },
  refused: { label: 'Refusée', color: 'bg-red-50 text-[var(--sw-danger)]' },
  suspended: { label: 'Suspendue', color: 'bg-red-50 text-[var(--sw-danger)]' },
  needs_info: { label: 'Informations requises', color: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]' },
}

export default async function CouvertureProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: profileData }, { data: orgData }] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, phone, email, account_status').eq('id', user.id).single(),
    supabase.from('coverage_orgs').select('name, org_type, registration_number, description, phone, email, website, address_region, address_details').eq('profile_id', user.id).single(),
  ])
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; account_status: string | null } | null
  const org = orgData as unknown as { name: string | null; org_type: string | null; registration_number: string | null; description: string | null; phone: string | null; email: string | null; website: string | null; address_region: string | null; address_details: string | null } | null

  const status = profile?.account_status ?? 'draft'
  const statusInfo = STATUS_INFO[status] ?? { label: status, color: '' }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="sw-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center shrink-0">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-[var(--sw-ink)]">{org?.name ?? 'Mon Organisme'}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          {org?.org_type && (
            <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
              {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
            </p>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="sw-card p-5 space-y-3">
        <h2 className="font-semibold text-[var(--sw-ink)]">Informations</h2>
        <div className="space-y-2 text-sm">
          {org?.registration_number && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">N° d&apos;enregistrement</span>
              <span className="font-medium text-[var(--sw-ink)]">{org.registration_number}</span>
            </div>
          )}
        </div>
        {org?.description && (
          <p className="text-sm text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-3">
            {org.description}
          </p>
        )}
      </div>

      {/* Contact */}
      <div className="sw-card p-5 space-y-3">
        <h2 className="font-semibold text-[var(--sw-ink)]">Contact</h2>
        <div className="space-y-2 text-sm">
          {(org?.phone ?? profile?.phone) && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{org?.phone ?? profile?.phone}</span>
            </div>
          )}
          {(org?.email ?? profile?.email) && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{org?.email ?? profile?.email}</span>
            </div>
          )}
          {org?.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{org.website}</span>
            </div>
          )}
        </div>
      </div>

      {/* Adresse */}
      {(org?.address_region || org?.address_details) && (
        <div className="sw-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--sw-primary)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">Adresse</h2>
          </div>
          <div className="text-sm text-[var(--sw-ink-2)] space-y-1">
            {org.address_region && <p>{org.address_region}</p>}
            {org.address_details && <p className="text-[var(--sw-ink)]">{org.address_details}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
