import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings, Building2, Phone, Mail, MapPin } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paramètres — Établissement Séné Wérr' }

const TYPE_LABELS: Record<string, string> = {
  cabinet_medical: 'Cabinet médical', clinique: 'Clinique', hopital_eps1: 'Hôpital EPS1',
  hopital_eps2: 'Hôpital EPS2', hopital_eps3: 'Hôpital EPS3', laboratoire: "Laboratoire d'analyses",
  centre_radiologie: 'Centre de radiologie', centre_sante_mentale: 'Centre de santé mentale',
  centre_reeducation: 'Centre de rééducation', poste_sante: 'Poste de santé',
  centre_sante_cs1: 'Centre CS1', centre_sante_cs2: 'Centre CS2', autre_specialise: 'Autre',
}

function Field({ icon: Icon, label, value }: { icon: typeof Settings; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--sw-line)] last:border-0">
      <Icon className="w-4 h-4 text-[var(--sw-ink-2)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
        <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default async function EtablissementParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase
    .from('establishments')
    .select('id, name, establishment_type, phone, email, address_region, address_commune')
    .eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as {
    id: string; name: string; establishment_type: string; phone: string | null;
    email: string | null; address_region: string | null; address_commune: string | null
  }

  const { data: profileData } = await supabase.from('profiles').select('first_name, last_name, phone, account_status').eq('id', user.id).single()
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; phone: string | null; account_status: string | null } | null

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <Settings className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paramètres</h1>
      </div>

      {/* Infos établissement */}
      <div className="sw-card p-5">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Informations de l&apos;établissement
        </h2>
        <Field icon={Building2} label="Nom"          value={est.name} />
        <Field icon={Building2} label="Type"         value={TYPE_LABELS[est.establishment_type] ?? est.establishment_type} />
        <Field icon={Phone}     label="Téléphone"    value={est.phone} />
        <Field icon={Mail}      label="Email"        value={est.email} />
        <Field icon={MapPin}    label="Région"       value={est.address_region} />
        <Field icon={MapPin}    label="Commune"      value={est.address_commune} />
      </div>

      {/* Responsable */}
      <div className="sw-card p-5">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Responsable</h2>
        {profile && (
          <>
            <Field icon={Settings} label="Nom"       value={`${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || null} />
            <Field icon={Phone}    label="Téléphone" value={profile.phone} />
          </>
        )}
      </div>

      {/* Statut */}
      <div className="sw-card p-4 flex items-center justify-between">
        <p className="text-sm text-[var(--sw-ink)]">Statut du compte</p>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          profile?.account_status === 'verified'
            ? 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]'
            : 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]'
        }`}>
          {profile?.account_status === 'verified' ? 'Vérifié' : profile?.account_status === 'pending' ? 'En attente' : (profile?.account_status ?? 'En attente')}
        </span>
      </div>
    </div>
  )
}
