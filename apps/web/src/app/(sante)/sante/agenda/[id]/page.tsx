import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, User, MapPin, FileText } from 'lucide-react'
import { AppointmentStatusActions } from '@/components/sante/appointment-status-actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Détail rendez-vous' }

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de confirmation', confirmed: 'Confirmé',
  arrived: 'Patient arrivé', in_consultation: 'En consultation',
  completed: 'Terminé', cancelled: 'Annulé', rescheduled: 'Reporté', no_show: 'Non présenté',
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

function Field({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string | null }) {
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

export default async function AgendaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase.from('professionals').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string } | null
  if (!pro) redirect('/connexion')

  const { data: apptData } = await supabase
    .from('appointments')
    .select('id, status, scheduled_at, duration_minutes, reason, notes, cancellation_reason, created_at, patients(profiles(first_name, last_name, phone, date_of_birth)), establishments(name, address_commune)')
    .eq('id', id)
    .eq('professional_id', pro.id)
    .maybeSingle()

  const appt = apptData as unknown as {
    id: string; status: string; scheduled_at: string; duration_minutes: number | null
    reason: string | null; notes: string | null; cancellation_reason: string | null; created_at: string
    patients: { profiles: { first_name: string | null; last_name: string | null; phone: string | null; date_of_birth: string | null } | null } | null
    establishments: { name: string; address_commune: string | null } | null
  } | null

  if (!appt) notFound()

  const patientProfile = (appt.patients as unknown as { profiles: { first_name: string | null; last_name: string | null; phone: string | null; date_of_birth: string | null } | null } | null)?.profiles
  const patientName = patientProfile ? `${patientProfile.first_name ?? ''} ${patientProfile.last_name ?? ''}`.trim() : null
  const estName = (appt.establishments as unknown as { name: string; address_commune: string | null } | null)?.name

  function fmtDateTime(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const isTerminal = ['completed', 'cancelled', 'no_show'].includes(appt.status)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/sante/agenda" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Mon agenda
      </Link>

      <div className="sw-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASSES[appt.status] ?? ''}`}>
              {STATUS_LABELS[appt.status] ?? appt.status}
            </span>
            <p className="text-xs text-[var(--sw-ink-3)] mt-1">Créé le {new Date(appt.created_at).toLocaleDateString('fr-SN')}</p>
          </div>
        </div>

        <div>
          {patientName && <Field icon={User}     label="Patient"          value={patientName} />}
          {patientProfile?.phone && <Field icon={User} label="Téléphone patient" value={patientProfile.phone} />}
          {patientProfile?.date_of_birth && <Field icon={User} label="Date de naissance" value={new Date(patientProfile.date_of_birth).toLocaleDateString('fr-SN')} />}
          <Field icon={Clock}    label="Date et heure"    value={fmtDateTime(appt.scheduled_at)} />
          {appt.duration_minutes != null && <Field icon={Clock} label="Durée estimée" value={`${appt.duration_minutes} min`} />}
          {estName && <Field icon={MapPin} label="Lieu" value={estName} />}
          {appt.reason && <Field icon={FileText} label="Motif déclaré" value={appt.reason} />}
          {appt.notes && <Field icon={FileText}  label="Notes" value={appt.notes} />}
          {appt.cancellation_reason && <Field icon={FileText} label="Motif d'annulation" value={appt.cancellation_reason} />}
        </div>
      </div>

      {!isTerminal && (
        <AppointmentStatusActions appointmentId={appt.id} professionalId={pro.id} currentStatus={appt.status} />
      )}
    </div>
  )
}
