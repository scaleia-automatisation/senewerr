import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { User, MapPin, Phone, Mail, Stethoscope, BadgeCheck } from 'lucide-react'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mon profil — Espace Santé' }

const PROFESSIONAL_TYPES: Record<string, string> = {
  medecin_generaliste: 'Médecin généraliste',
  medecin_specialiste: 'Médecin spécialiste',
  chirurgien_dentiste: 'Chirurgien-dentiste',
  sage_femme: 'Sage-femme',
  infirmier: 'Infirmier(ère)',
  paramedicale: 'Paramédical',
  autre: 'Autre',
}

export default async function SanteProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: profileData }, { data: professionalData }] = await Promise.all([
    supabase.from('profils').select('first_name, last_name, phone, email, account_status').eq('id', user.id).single(),
    supabase.from('professionnels').select('professional_type, specialty, title, ordre_number, bio, consultation_fee_fcfa, teleconsultation_enabled, teleconsultation_fee_fcfa, address_region, address_department, address_commune, address_details, plan').eq('profile_id', user.id).single(),
  ])
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; phone: string | null; email: string | null; account_status: string | null } | null
  const professional = professionalData as unknown as { professional_type: string | null; specialty: string | null; title: string | null; ordre_number: string | null; bio: string | null; consultation_fee_fcfa: number | null; teleconsultation_enabled: boolean | null; teleconsultation_fee_fcfa: number | null; address_region: string | null; address_department: string | null; address_commune: string | null; address_details: string | null; plan: string | null } | null

  const statusColors: Record<string, string> = {
    verified: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
    pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
    draft: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
    refused: 'bg-red-50 text-[var(--sw-danger)]',
    suspended: 'bg-red-50 text-[var(--sw-danger)]',
    needs_info: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    disabled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  }

  const statusLabels: Record<string, string> = {
    verified: 'Vérifié',
    pending: 'En attente de vérification',
    draft: 'Brouillon',
    refused: 'Refusé',
    suspended: 'Suspendu',
    needs_info: 'Informations requises',
    disabled: 'Désactivé',
  }

  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
  const status = profile?.account_status ?? 'draft'

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="sw-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--sw-primary)] flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xl">
            {profile?.first_name?.[0] ?? ''}{profile?.last_name?.[0] ?? ''}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-[var(--sw-ink)]">
              {professional?.title ? `${professional.title} ` : ''}{fullName}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[status] ?? ''}`}>
              {statusLabels[status] ?? status}
            </span>
          </div>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
            {PROFESSIONAL_TYPES[professional?.professional_type ?? ''] ?? 'Professionnel de santé'}
            {professional?.specialty ? ` — ${professional.specialty}` : ''}
          </p>
        </div>
      </div>

      {/* Infos professionnelles */}
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Informations professionnelles</h2>
        </div>
        <div className="space-y-3 text-sm">
          {professional?.ordre_number && (
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-[var(--sw-success)] shrink-0" />
              <span className="text-[var(--sw-ink-2)]">N° Ordre : </span>
              <span className="text-[var(--sw-ink)] font-medium">{professional.ordre_number}</span>
            </div>
          )}
          {professional?.consultation_fee_fcfa != null && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">Consultation</span>
              <span className="font-medium text-[var(--sw-ink)]">{formatCFA(professional.consultation_fee_fcfa)}</span>
            </div>
          )}
          {professional?.teleconsultation_enabled && professional.teleconsultation_fee_fcfa != null && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">Téléconsultation</span>
              <span className="font-medium text-[var(--sw-ink)]">{formatCFA(professional.teleconsultation_fee_fcfa)}</span>
            </div>
          )}
          {professional?.plan && (
            <div className="flex justify-between">
              <span className="text-[var(--sw-ink-2)]">Plan</span>
              <span className="font-medium text-[var(--sw-ink)] capitalize">{professional.plan}</span>
            </div>
          )}
        </div>
        {professional?.bio && (
          <p className="text-sm text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-3">
            {professional.bio}
          </p>
        )}
      </div>

      {/* Contact */}
      <div className="sw-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--sw-primary)]" />
          <h2 className="font-semibold text-[var(--sw-ink)]">Contact</h2>
        </div>
        <div className="space-y-2 text-sm">
          {profile?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{profile.phone}</span>
            </div>
          )}
          {profile?.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              <span className="text-[var(--sw-ink)]">{profile.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Adresse */}
      {(professional?.address_region || professional?.address_commune) && (
        <div className="sw-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--sw-primary)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">Cabinet / Adresse</h2>
          </div>
          <div className="text-sm text-[var(--sw-ink-2)] space-y-1">
            {professional.address_commune && <p>{professional.address_commune}</p>}
            {professional.address_department && <p>{professional.address_department}</p>}
            {professional.address_region && <p>{professional.address_region}</p>}
            {professional.address_details && <p className="text-[var(--sw-ink)]">{professional.address_details}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
