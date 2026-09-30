import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, Calendar, Clock, MapPin, Video, User, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rendez-vous confirmé — Séné Wérr' }

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  appointment_type: string
  status: string
  reason: string | null
  professional: {
    professional_type: string
    title: string | null
    address_region: string | null
    address_commune: string | null
    profiles: { first_name: string; last_name: string } | null
  } | null
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      start_time,
      appointment_type,
      status,
      reason,
      professional:professionals (
        professional_type,
        title,
        address_region,
        address_commune,
        profiles!inner(first_name, last_name)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  const appointment = data as unknown as Appointment | null
  if (!appointment) notFound()

  const pro = appointment.professional
  const proName = pro?.profiles
    ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
    : 'Professionnel'

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        {/* Success card */}
        <div className="sw-card p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rendez-vous demandé !</h1>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">
              Votre demande a été envoyée. Le professionnel vous confirmera sous peu.
            </p>
          </div>
        </div>

        {/* Details card */}
        <div className="sw-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Récapitulatif</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[var(--sw-primary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--sw-ink)]">{proName}</p>
                <p className="text-xs text-[var(--sw-ink-2)]">
                  {pro?.professional_type?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-[var(--sw-ink-2)]" />
              </div>
              <p className="text-sm text-[var(--sw-ink)]">{formatDate(appointment.appointment_date)}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[var(--sw-ink-2)]" />
              </div>
              <p className="text-sm text-[var(--sw-ink)]">{appointment.start_time.slice(0, 5)}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                {appointment.appointment_type === 'teleconsultation'
                  ? <Video className="w-4 h-4 text-[var(--sw-ink-2)]" />
                  : <MapPin className="w-4 h-4 text-[var(--sw-ink-2)]" />
                }
              </div>
              <p className="text-sm text-[var(--sw-ink)]">
                {appointment.appointment_type === 'teleconsultation'
                  ? 'Téléconsultation'
                  : `En présentiel${(pro?.address_commune ?? pro?.address_region) ? ` · ${pro?.address_commune ?? pro?.address_region}` : ''}`
                }
              </p>
            </div>

            {appointment.reason && (
              <div className="pt-2 border-t border-[var(--sw-line)]">
                <p className="text-xs text-[var(--sw-ink-2)]">Motif</p>
                <p className="text-sm text-[var(--sw-ink)] mt-0.5">{appointment.reason}</p>
              </div>
            )}
          </div>

          {/* Status badge */}
          <div className="px-3 py-2 rounded-lg bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            En attente de confirmation du professionnel
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            href="/patient/rendez-vous"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Voir mes rendez-vous
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/patient/trouver"
            className="flex items-center justify-center w-full py-3 rounded-xl border border-[var(--sw-line)] text-[var(--sw-ink-2)] text-sm font-medium hover:border-[var(--sw-primary)] hover:text-[var(--sw-primary)] transition-colors"
          >
            Trouver un autre professionnel
          </Link>
        </div>
      </div>
    </div>
  )
}
