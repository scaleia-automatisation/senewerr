import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarPlus, ArrowRight, Calendar, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes rendez-vous' }

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', arrived: 'Arrivé',
  in_consultation: 'En consultation', completed: 'Terminé',
  cancelled: 'Annulé', rescheduled: 'Reporté', no_show: 'Non présenté',
}
const STATUS_CLASSES: Record<string, string> = {
  pending:        'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  confirmed:      'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  arrived:        'bg-blue-50 text-blue-600',
  in_consultation:'bg-blue-100 text-blue-700',
  completed:      'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  cancelled:      'bg-red-50 text-[var(--sw-danger)]',
  rescheduled:    'bg-purple-50 text-purple-600',
  no_show:        'bg-red-50 text-[var(--sw-danger)]',
}

type Appointment = {
  id: string; status: string; scheduled_at: string; reason: string | null
  professionals: { title: string | null; specialty: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null
  establishments: { name: string } | null
}

function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function RendezVousPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const appointments: Appointment[] = []
  if (patient) {
    const { data } = await supabase
      .from('appointments')
      .select('id, status, scheduled_at, reason, professionals(title, specialty, profiles(first_name, last_name)), establishments(name)')
      .eq('patient_id', patient.id)
      .order('scheduled_at', { ascending: false })
    if (data) appointments.push(...(data as unknown as Appointment[]))
  }

  const now = new Date()
  const upcoming = appointments.filter(a => ['pending', 'confirmed', 'arrived', 'in_consultation'].includes(a.status) && new Date(a.scheduled_at) >= now)
  const past = appointments.filter(a => !upcoming.includes(a))

  function Card({ a }: { a: Appointment }) {
    const pro = (a.professionals as unknown as { title: string | null; specialty: string | null; profiles: { first_name: string | null; last_name: string | null } | null } | null)
    const proName = pro?.profiles ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
    const estName = (a.establishments as unknown as { name: string } | null)?.name
    return (
      <Link href={`/patient/rendez-vous/${a.id}`} className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[a.status] ?? ''}`}>
              {STATUS_LABELS[a.status] ?? a.status}
            </span>
          </div>
          {proName && <p className="text-sm font-medium text-[var(--sw-ink)]">{proName}</p>}
          {pro?.specialty && <p className="text-xs text-[var(--sw-ink-3)]">{pro.specialty}</p>}
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
            <Clock className="w-3 h-3" />
            <span>{fmtDateTime(a.scheduled_at)}</span>
          </div>
          {estName && <p className="text-xs text-[var(--sw-ink-2)]">{estName}</p>}
          {a.reason && <p className="text-xs text-[var(--sw-ink-3)] italic truncate">{a.reason}</p>}
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-1" />
      </Link>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes rendez-vous</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{upcoming.length} à venir</p>
        </div>
        <Link href="/patient/rendez-vous/recherche" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity shrink-0">
          <CalendarPlus className="w-4 h-4" /> Prendre RDV
        </Link>
      </div>

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">À venir ({upcoming.length})</h2>
          {upcoming.map(a => <Card key={a.id} a={a} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)]">Passés ({past.length})</h2>
          {past.map(a => <Card key={a.id} a={a} />)}
        </section>
      )}

      {appointments.length === 0 && (
        <div className="sw-card p-10 text-center">
          <Calendar className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto mb-4" />
          <p className="text-sm font-medium text-[var(--sw-ink)]">Aucun rendez-vous</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1 mb-4">Prenez votre premier rendez-vous en quelques étapes.</p>
          <Link href="/patient/rendez-vous/recherche" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            <CalendarPlus className="w-4 h-4" /> Chercher un professionnel
          </Link>
        </div>
      )}
    </div>
  )
}
