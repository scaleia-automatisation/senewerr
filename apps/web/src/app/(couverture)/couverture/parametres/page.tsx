import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Phone, Mail, MapPin } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paramètres — Couverture' }

const ORG_TYPE_LABELS: Record<string, string> = {
  mutuelle_communautaire: 'Mutuelle communautaire',
  msae: 'MSAE',
  mutuelle_professionnelle: 'Mutuelle professionnelle',
  ipm: 'Institution de prévoyance maladie (IPM)',
  assurance_privee: 'Assurance privée',
}

const STATUS_CLASSES: Record<string, string> = {
  pending:  'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  verified: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused:  'bg-red-50 text-[var(--sw-danger)]',
  suspended:'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  needs_info: 'bg-orange-50 text-orange-600',
  draft:    'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de vérification', verified: 'Vérifié',
  refused: 'Refusé', suspended: 'Suspendu', needs_info: 'Complément requis', draft: 'Brouillon',
}

function Field({ icon: Icon, label, value }: { icon: typeof Settings; label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--sw-line)] last:border-0">
      <Icon className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
        <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default async function ParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [orgResult, profileResult] = await Promise.all([
    supabase.from('organismes_couverture').select('id, name, org_type, registration_number, address_region, address_details').eq('profile_id', user.id).maybeSingle(),
    supabase.from('profils').select('first_name, last_name, phone, email, account_status, verification_notes').eq('id', user.id).single(),
  ])

  const org = orgResult.data as unknown as {
    id: string; name: string; org_type: string | null; registration_number: string | null
    address_region: string | null; address_details: string | null
  } | null

  const profile = profileResult.data as unknown as {
    first_name: string | null; last_name: string | null; phone: string | null; email: string | null
    account_status: string | null; verification_notes: string | null
  } | null

  if (!org) redirect('/connexion')

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center">
          <Settings className="w-5 h-5 text-[var(--sw-ink-3)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paramètres</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Informations de l'organisme</p>
        </div>
      </div>

      {/* Statut */}
      <div className="sw-card p-4 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--sw-ink)]">Statut du compte</span>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASSES[profile?.account_status ?? ''] ?? ''}`}>
          {STATUS_LABELS[profile?.account_status ?? ''] ?? (profile?.account_status ?? 'En attente')}
        </span>
      </div>

      {profile?.verification_notes && (
        <div className="sw-card p-4 border-red-200 bg-red-50">
          <p className="text-sm font-medium text-[var(--sw-danger)]">Notes de vérification</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1">{profile.verification_notes}</p>
        </div>
      )}

      {/* Infos organisme */}
      <div className="sw-card p-5">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[var(--sw-ink-3)]" /> Organisme
        </h2>
        <div className="space-y-0">
          <Field icon={Building2} label="Dénomination" value={org.name} />
          <Field icon={Building2} label="Type d'organisme" value={org.org_type ? (ORG_TYPE_LABELS[org.org_type] ?? org.org_type) : null} />
          <Field icon={Building2} label="N° d'immatriculation" value={org.registration_number} />
          <Field icon={MapPin}     label="Région" value={org.address_region} />
          <Field icon={MapPin}     label="Adresse" value={org.address_details} />
        </div>
      </div>

      {/* Infos responsable */}
      {profile && (
        <div className="sw-card p-5">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-4">Responsable</h2>
          <div className="space-y-0">
            <Field icon={Settings} label="Nom" value={profile.first_name || profile.last_name ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : null} />
            <Field icon={Phone}    label="Téléphone" value={profile.phone} />
            <Field icon={Mail}     label="Email" value={profile.email} />
          </div>
        </div>
      )}
    </div>
  )
}
