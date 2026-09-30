import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { User, Phone, Mail, MapPin, Calendar, Droplets } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Identité — Mon dossier' }

function Field({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null }) {
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

export default async function DossierIdentitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [profileResult, patientResult] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, phone, email, date_of_birth, gender, address_region, address_commune, address_details').eq('id', user.id).single(),
    supabase.from('patients').select('id, blood_type, emergency_contact_name, emergency_contact_phone').eq('profile_id', user.id).maybeSingle(),
  ])

  const profile = profileResult.data as unknown as {
    first_name: string | null; last_name: string | null; phone: string | null; email: string | null
    date_of_birth: string | null; gender: string | null
    address_region: string | null; address_commune: string | null; address_details: string | null
  } | null

  const patient = patientResult.data as unknown as {
    id: string; blood_type: string | null
    emergency_contact_name: string | null; emergency_contact_phone: string | null
  } | null

  const GENDER_LABELS: Record<string, string> = { male: 'Masculin', female: 'Féminin', other: 'Autre' }
  const BLOOD_LABELS: Record<string, string> = { 'A+': 'A+', 'A-': 'A−', 'B+': 'B+', 'B-': 'B−', 'AB+': 'AB+', 'AB-': 'AB−', 'O+': 'O+', 'O-': 'O−' }

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const address = [profile?.address_details, profile?.address_commune, profile?.address_region].filter(Boolean).join(', ') || null

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {/* Avatar + nom */}
      <div className="sw-card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--sw-primary-subtle)] flex items-center justify-center text-[var(--sw-primary)] text-2xl font-bold">
          {profile?.first_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-lg font-bold text-[var(--sw-ink)]">
            {`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'}
          </p>
          {patient?.blood_type && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium mt-1">
              <Droplets className="w-3 h-3" /> {BLOOD_LABELS[patient.blood_type] ?? patient.blood_type}
            </span>
          )}
        </div>
      </div>

      {/* Coordonnées */}
      <div className="sw-card p-5">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Coordonnées</h2>
        <div className="space-y-0">
          <Field icon={Phone}    label="Téléphone"          value={profile?.phone ?? null} />
          <Field icon={Mail}     label="Email"              value={profile?.email ?? null} />
          <Field icon={Calendar} label="Date de naissance"  value={fmtDate(profile?.date_of_birth ?? null)} />
          <Field icon={User}     label="Genre"              value={profile?.gender ? (GENDER_LABELS[profile.gender] ?? profile.gender) : null} />
          <Field icon={MapPin}   label="Adresse"            value={address} />
        </div>
      </div>

      {/* Contact d'urgence */}
      {(patient?.emergency_contact_name || patient?.emergency_contact_phone) && (
        <div className="sw-card p-5">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Contact d'urgence</h2>
          <div className="space-y-0">
            <Field icon={User}  label="Nom"       value={patient.emergency_contact_name ?? null} />
            <Field icon={Phone} label="Téléphone" value={patient.emergency_contact_phone ?? null} />
          </div>
        </div>
      )}
    </div>
  )
}
