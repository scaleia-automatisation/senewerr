import { createClient } from '@/lib/supabase/server'
import { User, Phone, Mail, Heart, AlertCircle, Users, MapPin, Edit } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

function calculateAge(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function TagList({ items }: { items: string | string[] }) {
  const tags = Array.isArray(items)
    ? items.filter(Boolean)
    : items.split(/[,;]/).map(t => t.trim()).filter(Boolean)
  if (tags.length === 0) return <span className="text-sm text-[var(--sw-ink-3)]">—</span>
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {tags.map((tag, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]">
          {tag}
        </span>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
      <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value || '—'}</p>
    </div>
  )
}

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as {
    first_name: string; last_name: string; email: string | null; phone: string | null;
    avatar_url: string | null; gender: string | null; date_of_birth: string | null;
    address_region: string | null; address_department: string | null;
    address_commune: string | null; address_details: string | null;
  } | null

  const { data: patientData } = await supabase
    .from('patients')
    .select('*')
    .eq('profile_id', user.id)
    .single()
  const patient = patientData as unknown as {
    date_of_birth: string | null; blood_group: string | null; nin: string | null;
    weight_kg: number | null; height_cm: number | null;
    gender: string | null;
    allergies: string[] | null; chronic_conditions: string[] | null;
    emergency_contact_name: string | null; emergency_contact_phone: string | null;
    address_region: string | null; address_department: string | null;
    address_commune: string | null; address_details: string | null;
  } | null

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Utilisateur'
  const initials = getInitials(fullName)
  const age = patient?.date_of_birth ? calculateAge(patient.date_of_birth) : null

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mon profil</h1>
        <a
          href="/patient/profil/modifier"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)] hover:bg-[var(--sw-surface-2)] transition-colors"
        >
          <Edit className="w-4 h-4" />
          Modifier
        </a>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={fullName}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <span className="text-xl font-bold text-[var(--sw-primary)]">{initials}</span>
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-[var(--sw-ink)]">{fullName}</p>
          <p className="text-sm text-[var(--sw-ink-3)]">{profile?.email ?? user.email}</p>
        </div>
      </div>

      {/* Section 1: Personal info */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" />
            Informations personnelles
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Prénom" value={profile?.first_name} />
            <InfoRow label="Nom" value={profile?.last_name} />
            <InfoRow
              label="Téléphone"
              value={profile?.phone}
            />
            <InfoRow label="Email" value={profile?.email ?? user.email} />
            <InfoRow
              label="Genre"
              value={
                patient?.gender === 'male' ? 'Homme' :
                patient?.gender === 'female' ? 'Femme' :
                patient?.gender ?? null
              }
            />
            <InfoRow
              label="Date de naissance"
              value={
                patient?.date_of_birth
                  ? `${formatDate(patient.date_of_birth)}${age !== null ? ` (${age} ans)` : ''}`
                  : null
              }
            />
            <InfoRow label="Groupe sanguin" value={patient?.blood_group} />
            <InfoRow label="NIN" value={patient?.nin} />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Health info */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Informations de santé
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              label="Poids"
              value={patient?.weight_kg ? `${patient.weight_kg} kg` : null}
            />
            <InfoRow
              label="Taille"
              value={patient?.height_cm ? `${patient.height_cm} cm` : null}
            />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)] font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Allergies
            </p>
            {patient?.allergies ? <TagList items={patient.allergies} /> : (
              <p className="text-sm text-[var(--sw-ink-3)] mt-0.5">Aucune allergie renseignée</p>
            )}
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Maladies chroniques</p>
            {patient?.chronic_conditions ? <TagList items={patient.chronic_conditions} /> : (
              <p className="text-sm text-[var(--sw-ink-3)] mt-0.5">Aucune maladie chronique renseignée</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Emergency contact */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Contact d'urgence
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Nom" value={patient?.emergency_contact_name} />
            <InfoRow label="Téléphone" value={patient?.emergency_contact_phone} />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Address */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Adresse
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Région" value={patient?.address_region} />
            <InfoRow label="Département" value={patient?.address_department} />
            <InfoRow label="Commune" value={patient?.address_commune} />
          </div>
          {patient?.address_details && (
            <InfoRow label="Détails" value={patient.address_details} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
