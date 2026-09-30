'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { User, Heart, Phone, MapPin, ChevronLeft } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

interface PatientProfile {
  first_name: string
  last_name: string
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  blood_group: string | null
  nin: string | null
  weight_kg: number | null
  height_cm: number | null
  allergies: string[] | null
  chronic_conditions: string[] | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  address_region: string | null
  address_department: string | null
  address_commune: string | null
  address_details: string | null
}

export function EditForm({ userId, initial }: { userId: string; initial: PatientProfile }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: initial.first_name ?? '',
    last_name: initial.last_name ?? '',
    phone: initial.phone ?? '',
    date_of_birth: initial.date_of_birth ?? '',
    gender: initial.gender ?? '',
    blood_group: initial.blood_group ?? '',
    nin: initial.nin ?? '',
    weight_kg: initial.weight_kg?.toString() ?? '',
    height_cm: initial.height_cm?.toString() ?? '',
    allergies: (initial.allergies ?? []).join(', '),
    chronic_conditions: (initial.chronic_conditions ?? []).join(', '),
    emergency_contact_name: initial.emergency_contact_name ?? '',
    emergency_contact_phone: initial.emergency_contact_phone ?? '',
    address_region: initial.address_region ?? '',
    address_department: initial.address_department ?? '',
    address_commune: initial.address_commune ?? '',
    address_details: initial.address_details ?? '',
  })

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function toArray(s: string): string[] {
    return s.split(/[,;]/).map(t => t.trim()).filter(Boolean)
  }

  function friendlyError(msg: string | undefined): string {
    if (!msg) return 'Une erreur est survenue. Veuillez réessayer.'
    if (msg.includes('infinite recursion')) return 'Erreur de configuration serveur. Contactez le support.'
    if (msg.includes('violates') || msg.includes('unique')) return 'Ces informations sont déjà utilisées par un autre compte.'
    if (msg.includes('not-null') || msg.includes('null value')) return 'Certains champs obligatoires sont manquants.'
    if (msg.includes('network') || msg.includes('fetch')) return 'Problème de connexion. Vérifiez votre réseau.'
    return 'Une erreur est survenue. Veuillez réessayer.'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const supabase = createClient()

    const patientPayload = {
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      nin: form.nin.trim() || null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      allergies: toArray(form.allergies).length > 0 ? toArray(form.allergies) : null,
      chronic_conditions: toArray(form.chronic_conditions).length > 0 ? toArray(form.chronic_conditions) : null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      address_region: form.address_region.trim() || null,
      address_department: form.address_department.trim() || null,
      address_commune: form.address_commune.trim() || null,
      address_details: form.address_details.trim() || null,
    }

    // Vérifie si la ligne patient existe déjà
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', userId)
      .single()

    const patientQuery = existing
      ? supabase.from('patients').update(patientPayload).eq('profile_id', userId)
      : supabase.from('patients').insert({ ...patientPayload, profile_id: userId })

    const [profileRes, patientRes] = await Promise.all([
      supabase.from('profiles').update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      }).eq('id', userId),
      patientQuery,
    ])

    setSaving(false)
    if (profileRes.error || patientRes.error) {
      const raw = profileRes.error?.message ?? patientRes.error?.message
      setError(friendlyError(raw))
      return
    }
    router.push('/patient/profil')
    router.refresh()
  }

  const label = 'block text-xs font-medium text-[var(--sw-ink-3)] mb-1'
  const field = 'w-full px-3 py-2 rounded-lg border border-[var(--sw-line)] bg-[var(--sw-surface)] text-sm text-[var(--sw-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-primary)] focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-[var(--sw-surface-2)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--sw-ink-2)]" />
        </button>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Modifier le profil</h1>
      </div>

      {/* Informations personnelles */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" />
            Informations personnelles
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Prénom *</label>
              <input className={field} value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div>
              <label className={label}>Nom *</label>
              <input className={field} value={form.last_name} onChange={set('last_name')} required />
            </div>
            <div>
              <label className={label}>Téléphone</label>
              <input className={field} type="tel" value={form.phone} onChange={set('phone')} placeholder="+221 77 000 00 00" />
            </div>
            <div>
              <label className={label}>Date de naissance</label>
              <input className={field} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            </div>
            <div>
              <label className={label}>Genre</label>
              <select className={field} value={form.gender} onChange={set('gender')}>
                <option value="">— Sélectionner —</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
              </select>
            </div>
            <div>
              <label className={label}>Groupe sanguin</label>
              <select className={field} value={form.blood_group} onChange={set('blood_group')}>
                <option value="">— Sélectionner —</option>
                {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>NIN (Numéro d'identification)</label>
              <input className={field} value={form.nin} onChange={set('nin')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informations de santé */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Informations de santé
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Poids (kg)</label>
              <input className={field} type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} placeholder="70" />
            </div>
            <div>
              <label className={label}>Taille (cm)</label>
              <input className={field} type="number" value={form.height_cm} onChange={set('height_cm')} placeholder="175" />
            </div>
          </div>
          <div>
            <label className={label}>Allergies (séparer par des virgules)</label>
            <textarea
              className={`${field} resize-none`}
              rows={2}
              value={form.allergies}
              onChange={set('allergies')}
              placeholder="Pénicilline, Arachides…"
            />
          </div>
          <div>
            <label className={label}>Maladies chroniques (séparer par des virgules)</label>
            <textarea
              className={`${field} resize-none`}
              rows={2}
              value={form.chronic_conditions}
              onChange={set('chronic_conditions')}
              placeholder="Diabète, Hypertension…"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact d'urgence */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Contact d'urgence
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Nom du contact</label>
              <input className={field} value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />
            </div>
            <div>
              <label className={label}>Téléphone du contact</label>
              <input className={field} type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card className="sw-card">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Adresse
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Région</label>
              <input className={field} value={form.address_region} onChange={set('address_region')} />
            </div>
            <div>
              <label className={label}>Département</label>
              <input className={field} value={form.address_department} onChange={set('address_department')} />
            </div>
            <div>
              <label className={label}>Commune</label>
              <input className={field} value={form.address_commune} onChange={set('address_commune')} />
            </div>
          </div>
          <div>
            <label className={label}>Détails de l'adresse</label>
            <textarea
              className={`${field} resize-none`}
              rows={2}
              value={form.address_details}
              onChange={set('address_details')}
              placeholder="Rue, quartier, numéro…"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-[var(--sw-danger-bg)] text-[var(--sw-danger)] text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-2.5 rounded-lg border border-[var(--sw-line)] text-sm font-medium text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)] transition-colors"
        >
          Annuler
        </button>
        <Button type="submit" loading={saving} className="flex-1">
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
