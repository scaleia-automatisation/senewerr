'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react'

const RELATIONSHIPS = [
  { value: 'child',   label: 'Enfant' },
  { value: 'spouse',  label: 'Conjoint(e)' },
  { value: 'parent',  label: 'Parent' },
  { value: 'sibling', label: 'Frère / Sœur' },
  { value: 'other',   label: 'Autre proche' },
]

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

export default function AjouterBeneficiairePage() {
  const router = useRouter()

  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [relationship, setRelationship] = useState('child')
  const [dateOfBirth,  setDateOfBirth]  = useState('')
  const [gender,       setGender]       = useState('')
  const [bloodGroup,   setBloodGroup]   = useState('')
  const [allergies,    setAllergies]    = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.')
      return
    }
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/connexion'); return }

    const { data: patientData } = await supabase
      .from('patients')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    const patient = patientData as unknown as { id: string } | null

    if (!patient) {
      setError('Profil patient introuvable. Complétez votre profil d\'abord.')
      setLoading(false)
      return
    }

    const { error: err } = await (supabase.from('beneficiaires') as unknown as {
      insert: (v: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      patient_id: patient.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      relationship,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      blood_group: bloodGroup || null,
      allergies: allergies.trim() || null,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/patient/famille')
    router.refresh()
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5">
      <Link
        href="/patient/famille"
        className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]"
      >
        <ArrowLeft className="w-4 h-4" />
        Ma famille
      </Link>

      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Ajouter un bénéficiaire</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
          Ajoutez un proche pour gérer sa santé depuis votre compte.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="sw-card p-5 space-y-4">

        {/* Lien de parenté */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--sw-ink-2)]">Lien de parenté *</label>
          <div className="grid grid-cols-3 gap-2">
            {RELATIONSHIPS.slice(0, 3).map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRelationship(r.value)}
                className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                  relationship === r.value
                    ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                    : 'border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONSHIPS.slice(3).map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRelationship(r.value)}
                className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                  relationship === r.value
                    ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                    : 'border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Identité */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--sw-ink-2)]">Prénom *</label>
            <input
              className="sw-input w-full"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Moussa"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--sw-ink-2)]">Nom *</label>
            <input
              className="sw-input w-full"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Diallo"
              required
            />
          </div>
        </div>

        {/* Date de naissance */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--sw-ink-2)]">Date de naissance</label>
          <input
            type="date"
            className="sw-input w-full"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Sexe */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--sw-ink-2)]">Sexe</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: '',       label: 'Non précisé' },
              { value: 'male',   label: 'Masculin' },
              { value: 'female', label: 'Féminin' },
            ] as const).map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
                  gender === g.value
                    ? 'border-[var(--sw-primary)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]'
                    : 'border-[var(--sw-line)] text-[var(--sw-ink-2)]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groupe sanguin */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--sw-ink-2)]">Groupe sanguin</label>
          <div className="flex gap-2 flex-wrap">
            {BLOOD_GROUPS.map(bg => (
              <button
                key={bg}
                type="button"
                onClick={() => setBloodGroup(bg === bloodGroup ? '' : bg)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  bloodGroup === bg
                    ? 'border-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)]'
                    : 'border-[var(--sw-line)] text-[var(--sw-ink-2)]'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--sw-ink-2)]">Allergies connues</label>
          <textarea
            className="sw-input w-full resize-none"
            value={allergies}
            onChange={e => setAllergies(e.target.value)}
            placeholder="Pénicilline, arachides…"
            rows={2}
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)] rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><UserPlus className="w-4 h-4" /> Ajouter le bénéficiaire</>
          }
        </button>
      </form>
    </div>
  )
}
