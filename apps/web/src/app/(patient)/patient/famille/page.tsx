import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, UserPlus, User, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ma famille — Séné Wérr' }

const RELATIONSHIP_LABELS: Record<string, string> = {
  child:   'Enfant',
  spouse:  'Conjoint(e)',
  parent:  'Parent',
  sibling: 'Frère / Sœur',
  other:   'Proche',
}

interface Beneficiary {
  id: string
  first_name: string
  last_name: string
  relationship: string
  date_of_birth: string | null
  gender: string | null
  blood_group: string | null
}

export default async function FamillePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const { data: benData } = patient
    ? await (supabase.from('beneficiaires') as unknown as {
        select: (s: string) => {
          eq: (col: string, val: string) => {
            order: (col: string, opts: object) => Promise<{ data: unknown[] | null }>
          }
        }
      }).select('id, first_name, last_name, relationship, date_of_birth, gender, blood_group')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: true })
    : { data: null }

  const beneficiaries = (benData ?? []) as unknown as Beneficiary[]

  function age(dob: string | null) {
    if (!dob) return null
    const diff = Date.now() - new Date(dob).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
            <Users className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">Ma famille</h1>
            <p className="text-xs text-[var(--sw-ink-2)]">{beneficiaries.length} bénéficiaire{beneficiaries.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link
          href="/patient/famille/ajouter"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter
        </Link>
      </div>

      {beneficiaries.length === 0 ? (
        <div className="sw-card p-8 flex flex-col items-center gap-3 text-center border-dashed">
          <div className="w-14 h-14 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center">
            <Users className="w-7 h-7 text-[var(--sw-ink-3)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--sw-ink)]">Aucun bénéficiaire</p>
            <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
              Ajoutez un proche pour gérer sa santé depuis votre compte.
            </p>
          </div>
          <Link
            href="/patient/famille/ajouter"
            className="mt-1 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter un bénéficiaire
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {beneficiaries.map(b => {
            const a = age(b.date_of_birth)
            return (
              <div key={b.id} className="sw-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-[var(--sw-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">
                    {b.first_name} {b.last_name}
                  </p>
                  <p className="text-xs text-[var(--sw-ink-2)]">
                    {RELATIONSHIP_LABELS[b.relationship] ?? b.relationship}
                    {a != null ? ` · ${a} ans` : ''}
                    {b.blood_group ? ` · ${b.blood_group}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
