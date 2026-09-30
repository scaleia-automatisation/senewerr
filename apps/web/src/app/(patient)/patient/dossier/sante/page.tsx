import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HeartPulse, AlertTriangle, Pill, Activity } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Santé — Mon dossier' }

function Section({ icon: Icon, label, color, items }: {
  icon: typeof HeartPulse; label: string; color: string; items: string[] | null
}) {
  if (!items || items.length === 0) return (
    <div className="sw-card p-5">
      <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} /> {label}
      </h2>
      <p className="text-sm text-[var(--sw-ink-3)] italic">Aucune information enregistrée.</p>
    </div>
  )
  return (
    <div className="sw-card p-5">
      <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} /> {label}
      </h2>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--sw-ink)]">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.replace('text-', 'bg-')}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function parseList(v: unknown): string[] | null {
  if (!v) return null
  if (Array.isArray(v)) return v.filter(Boolean).map(String)
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!trimmed) return null
    return trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
  }
  return null
}

export default async function SantePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase
    .from('patients')
    .select('id, blood_type, allergies, chronic_conditions, current_medications, surgical_history, family_history')
    .eq('profile_id', user.id)
    .maybeSingle()

  const patient = patientData as unknown as {
    id: string; blood_type: string | null
    allergies: unknown; chronic_conditions: unknown
    current_medications: unknown; surgical_history: unknown; family_history: unknown
  } | null

  const BLOOD_LABELS: Record<string, string> = {
    'A+': 'A positif (A+)', 'A-': 'A négatif (A−)', 'B+': 'B positif (B+)', 'B-': 'B négatif (B−)',
    'AB+': 'AB positif (AB+)', 'AB-': 'AB négatif (AB−)', 'O+': 'O positif (O+)', 'O-': 'O négatif (O−)',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Groupe sanguin */}
      {patient?.blood_type && (
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Groupe sanguin</p>
            <p className="text-base font-bold text-red-600">{BLOOD_LABELS[patient.blood_type] ?? patient.blood_type}</p>
          </div>
        </div>
      )}

      <Section icon={AlertTriangle} label="Allergies"                  color="text-[var(--sw-danger)]"   items={parseList(patient?.allergies)} />
      <Section icon={HeartPulse}    label="Antécédents / maladies chroniques" color="text-[var(--sw-warning)]" items={parseList(patient?.chronic_conditions)} />
      <Section icon={Pill}          label="Traitements en cours"       color="text-[var(--sw-primary)]"  items={parseList(patient?.current_medications)} />
      <Section icon={Activity}      label="Antécédents chirurgicaux"   color="text-[var(--sw-ink-2)]"    items={parseList(patient?.surgical_history)} />
      <Section icon={Activity}      label="Antécédents familiaux"      color="text-purple-500"            items={parseList(patient?.family_history)} />

      {!patient && (
        <div className="sw-card p-10 text-center">
          <HeartPulse className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune donnée de santé enregistrée pour l'instant.</p>
        </div>
      )}
    </div>
  )
}
