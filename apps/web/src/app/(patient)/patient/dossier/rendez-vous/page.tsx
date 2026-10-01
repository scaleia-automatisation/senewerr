import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarCheck } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rendez-vous — Mon dossier' }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Confirmé', pending: 'En attente', completed: 'Passé', cancelled: 'Annulé', no_show: 'Absent',
}
const STATUS_CLASSES: Record<string, string> = {
  scheduled: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  pending:   'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  completed: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
  no_show:   'bg-red-50 text-[var(--sw-danger)]',
}

type Appointment = {
  id: string; status: string; scheduled_at: string; reason: string | null
  professionals: { profiles: { first_name: string | null; last_name: string | null } | null; specialty: string | null } | null
  establishments: { name: string } | null
}

export default async function DossierRendezVousPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const appointments: Appointment[] = []
  if (patient) {
    const { data } = await supabase
      .from('rendez_vous')
      .select('id, status, scheduled_at, reason, professionals(profiles(first_name, last_name), specialty), establishments(name)')
      .eq('patient_id', patient.id)
      .order('scheduled_at', { ascending: false })
    if (data) appointments.push(...(data as unknown as Appointment[]))
  }

  const upcoming = appointments.filter(a => ['scheduled', 'pending'].includes(a.status) && new Date(a.scheduled_at) >= new Date())
  const past     = appointments.filter(a => !upcoming.includes(a))

  function fmtDateTime(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function AppCard({ a }: { a: Appointment }) {
    const pro = (a.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null; specialty: string | null } | null)
    const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
    const estName = (a.establishments as unknown as { name: string } | null)?.name
    return (
      <div className="sw-card p-4 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[a.status] ?? ''}`}>
            {STATUS_LABELS[a.status] ?? a.status}
          </span>
          <span className="text-xs text-[var(--sw-ink-2)]">{fmtDateTime(a.scheduled_at)}</span>
        </div>
        {proName && <p className="text-sm font-medium text-[var(--sw-ink)]">{proName}</p>}
        {pro?.specialty && <p className="text-xs text-[var(--sw-ink-3)]">{pro.specialty}</p>}
        {estName && <p className="text-xs text-[var(--sw-ink-2)]">{estName}</p>}
        {a.reason && <p className="text-xs text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-2">{a.reason}</p>}
      </div>
    )
  }

  if (appointments.length === 0) return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="sw-card p-10 text-center">
        <CalendarCheck className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
        <p className="text-sm text-[var(--sw-ink-2)]">Aucun rendez-vous enregistré.</p>
      </div>
    </div>
  )

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2">À venir ({upcoming.length})</h2>
          <div className="space-y-2">{upcoming.map(a => <AppCard key={a.id} a={a} />)}</div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] mb-2">Passés ({past.length})</h2>
          <div className="space-y-2">{past.map(a => <AppCard key={a.id} a={a} />)}</div>
        </section>
      )}
    </div>
  )
}
