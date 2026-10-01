import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, MapPin, Phone, Mail, Truck, Clock } from 'lucide-react'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon profil — Espace Pharmacie' }

const PLAN_LABELS: Record<string, string> = {
  decouverte: 'Découverte',
  start: 'Start',
  pro: 'Pro',
  premium: 'Premium',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  verified: { label: 'Vérifiée', color: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' },
  pending: { label: 'En attente', color: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]' },
  draft: { label: 'Brouillon', color: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]' },
  refused: { label: 'Refusée', color: 'bg-red-50 text-[var(--sw-danger)]' },
  suspended: { label: 'Suspendue', color: 'bg-red-50 text-[var(--sw-danger)]' },
  needs_info: { label: 'Informations requises', color: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]' },
}

export default async function PharmacieProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: profileData }, { data: pharmacyData }] = await Promise.all([
    supabase.from('profils').select('first_name, last_name, phone, email, account_status').eq('id', user.id).single(),
    supabase.from('pharmacies').select('name, ordre_number, description, phone, email, address_region, address_department, address_commune, address_details, delivery_available, delivery_radius_km, delivery_fee_fcfa, opening_hours, plan, commission_rate_percent').eq('profile_id', user.id).single(),
  ])
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; account_status: string | null } | null
  const pharmacy = pharmacyData as unknown as { name: string | null; ordre_number: string | null; description: string | null; phone: string | null; email: string | null; address_region: string | null; address_department: string | null; address_commune: string | null; address_details: string | null; delivery_available: boolean | null; delivery_radius_km: number | null; delivery_fee_fcfa: number | null; opening_hours: unknown; plan: string | null; commission_rate_percent: number | null } | null

  const status = profile?.account_status ?? 'draft'
  const statusInfo = STATUS_LABELS[status] ?? { label: status, color: '' }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="sw-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--sw-success)] flex items-center justify-center shrink-0">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-[var(--sw-ink)]">{pharmacy?.name ?? 'Ma Pharmacie'}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          {pharmacy?.plan && (
            <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
              Plan {PLAN_LABELS[pharmacy.plan] ?? pharmacy.plan}
            </p>
          )}
        </div>
      </div>

      {/* Infos pharmacie */}
      <div className="sw-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Informations</h2>
        </div>
        <div className="space-y-2 text-sm">
          {pharmacy?.ordre_number && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">N° Ordre</span>
              <span className="font-medium text-[var(--sw-ink)]">{pharmacy.ordre_number}</span>
            </div>
          )}
          {pharmacy?.commission_rate_percent != null && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">Commission plateforme</span>
              <span className="font-medium text-[var(--sw-ink)]">{pharmacy.commission_rate_percent}%</span>
            </div>
          )}
        </div>
        {pharmacy?.description && (
          <p className="text-sm text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-3">
            {pharmacy.description}
          </p>
        )}
      </div>

      {/* Contact */}
      <div className="sw-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Contact</h2>
        </div>
        <div className="space-y-2 text-sm">
          {(pharmacy?.phone ?? profile?.phone) && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{pharmacy?.phone ?? profile?.phone}</span>
            </div>
          )}
          {(pharmacy?.email ?? profile?.email) && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{pharmacy?.email ?? profile?.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Adresse */}
      {(pharmacy?.address_region || pharmacy?.address_commune) && (
        <div className="sw-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--sw-primary)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">Adresse</h2>
          </div>
          <div className="text-sm text-[var(--sw-ink-2)] space-y-1">
            {pharmacy.address_commune && <p>{pharmacy.address_commune}</p>}
            {pharmacy.address_department && <p>{pharmacy.address_department}</p>}
            {pharmacy.address_region && <p>{pharmacy.address_region}</p>}
            {pharmacy.address_details && <p className="text-[var(--sw-ink)]">{pharmacy.address_details}</p>}
          </div>
        </div>
      )}

      {/* Livraison */}
      {pharmacy?.delivery_available && (
        <div className="sw-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[var(--sw-primary)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">Livraison</h2>
          </div>
          <div className="space-y-2 text-sm">
            {pharmacy.delivery_radius_km != null && (
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Rayon</span>
                <span className="font-medium text-[var(--sw-ink)]">{pharmacy.delivery_radius_km} km</span>
              </div>
            )}
            {pharmacy.delivery_fee_fcfa != null && (
              <div className="flex justify-between">
                <span className="text-[var(--sw-ink-2)]">Frais de livraison</span>
                <span className="font-medium text-[var(--sw-ink)]">{formatCFA(pharmacy.delivery_fee_fcfa)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
