import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Calendar, Pill, FileText, Shield, FolderOpen,
  Bell, ArrowRight, Clock, CheckCircle2, ShoppingBag, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Accueil Patient — Séné Wérr' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const DAYS_FR   = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function fmtAppt(date: string, time: string) {
  const d = new Date(date)
  return `${DAYS_FR[d.getDay()]}, ${d.getDate()} ${MONTHS_FR[d.getMonth()]} · ${time.slice(0, 5)}`
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  confirmed: 'Confirmé',
  arrived:   'Arrivé',
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]',
  confirmed: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]',
  arrived:   'text-[var(--sw-success)] bg-[var(--sw-success-bg)]',
}

const RESA_STATUS_LABELS: Record<string, string> = {
  new:         'Nouvelle',
  verifying:   'En vérification',
  to_prepare:  'À préparer',
  preparing:   'En préparation',
  ready:       'Prête',
}

interface NextAppointment {
  id: string
  appointment_date: string
  start_time: string
  status: string
  professional: { title: string | null; profiles: { first_name: string; last_name: string } | null } | null
}

interface ActiveReservation {
  id: string
  status: string
  pharmacy: { name: string } | null
}

export default async function PatientAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profils')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null } | null

  const { data: patientData } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: nextAptData },
    { data: activeResaData },
    { count: notifCount },
  ] = await Promise.all([
    patient
      ? supabase
          .from('rendez_vous')
          .select(`
            id, appointment_date, start_time, status,
            professional:professionals(title, profiles!inner(first_name, last_name))
          `)
          .eq('patient_id', patient.id)
          .in('status', ['pending', 'confirmed', 'arrived'])
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    patient
      ? supabase
          .from('reservations_pharmacie')
          .select('id, status, pharmacy:pharmacies(name)')
          .eq('patient_id', patient.id)
          .in('status', ['new', 'verifying', 'to_prepare', 'preparing', 'ready'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false),
  ])

  const nextApt   = nextAptData  as unknown as NextAppointment | null
  const activeResa = activeResaData as unknown as ActiveReservation | null

  const QUICK_ACTIONS = [
    { href: '/patient/trouver',     icon: Search,    label: 'Trouver un professionnel',   color: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
    { href: '/patient/trouver',     icon: Calendar,  label: 'Prendre rendez-vous',          color: 'text-blue-600 bg-blue-50' },
    { href: '/patient/medicaments', icon: Pill,      label: 'Trouver un médicament',        color: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
    { href: '/patient/ordonnances', icon: FileText,  label: 'Mes ordonnances',              color: 'text-amber-600 bg-amber-50' },
    { href: '/patient/couverture',  icon: Shield,    label: 'Ma couverture',                color: 'text-purple-600 bg-purple-50' },
    { href: '/patient/documents',   icon: FolderOpen, label: 'Mes documents',              color: 'text-slate-600 bg-slate-100' },
  ]

  const proName = nextApt?.professional?.profiles
    ? `${nextApt.professional.title ? nextApt.professional.title + ' ' : ''}${nextApt.professional.profiles.first_name} ${nextApt.professional.profiles.last_name}`.trim()
    : null

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-xl mx-auto">

      {/* Entête */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary)] flex items-center justify-center">
              <span className="text-white font-bold text-xs">SW</span>
            </div>
            <span className="text-xs font-semibold text-[var(--sw-ink-2)]">Séné Wérr</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)] mt-2">
            Bonjour{profile?.first_name ? `, ${profile.first_name}` : ''} 👋
          </h1>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">Que souhaitez-vous faire ?</p>
        </div>
        <Link
          href="/patient/notifications"
          className="relative p-2.5 rounded-xl bg-[var(--sw-surface)] border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] transition-colors"
        >
          <Bell className="w-5 h-5" />
          {notifCount != null && notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--sw-danger)] text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>
      </div>

      {/* 6 actions principales */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {QUICK_ACTIONS.map(({ href, icon: Icon, label, color }) => (
          <Link
            key={label}
            href={href}
            className="sw-card p-4 flex flex-col items-start gap-3 hover:border-[var(--sw-primary)] hover:shadow-sm transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[var(--sw-ink)] leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* Prochain rendez-vous */}
      {nextApt ? (
        <Link href="/patient/rendez-vous" className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Mon prochain rendez-vous</p>
            <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{proName ?? 'Professionnel'}</p>
            <p className="text-xs text-[var(--sw-ink-2)]">{fmtAppt(nextApt.appointment_date, nextApt.start_time)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[nextApt.status] ?? 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]'}`}>
              {STATUS_LABELS[nextApt.status] ?? nextApt.status}
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)]" />
          </div>
        </Link>
      ) : (
        <Link href="/patient/trouver" className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors border-dashed">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[var(--sw-ink-3)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--sw-ink-2)]">Aucun rendez-vous à venir</p>
            <p className="text-xs text-[var(--sw-primary)]">Prendre un rendez-vous →</p>
          </div>
        </Link>
      )}

      {/* Réservation active */}
      {activeResa ? (
        <Link href="/patient/reservations" className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Ma réservation</p>
            <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">
              {(activeResa.pharmacy as unknown as { name: string } | null)?.name ?? 'Pharmacie'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]">
              {RESA_STATUS_LABELS[activeResa.status] ?? activeResa.status}
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)]" />
          </div>
        </Link>
      ) : null}

      {/* Accès rapides secondaires */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/patient/famille" className="sw-card p-3 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
          <Clock className="w-4 h-4 text-[var(--sw-ink-2)]" />
          <span className="text-sm text-[var(--sw-ink)]">Ma famille</span>
        </Link>
        <Link href="/patient/paiements" className="sw-card p-3 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
          <ArrowRight className="w-4 h-4 text-[var(--sw-ink-2)]" />
          <span className="text-sm text-[var(--sw-ink)]">Paiements</span>
        </Link>
      </div>

    </div>
  )
}
