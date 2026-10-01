import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Stethoscope, FileText, Clock, ChevronRight } from 'lucide-react'
import { AccountStatusBanner } from '@/components/ui/account-status-banner'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord — Séné Wérr Santé' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']

interface UpcomingApt {
  id: string
  start_time: string
  status: string
  appointment_type: string
  reason: string | null
  patients: { profiles: { first_name: string; last_name: string } | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled:  { label: 'Planifié',  cls: 'text-[var(--sw-info)] bg-[var(--sw-info-bg,#eff6ff)]' },
  confirmed:  { label: 'Confirmé',  cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  pending:    { label: 'En attente', cls: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]' },
  arrived:    { label: 'Arrivé',    cls: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
  in_progress:{ label: 'En cours',  cls: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
}

export default async function SanteAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profils')
    .select('first_name, last_name, account_status, verification_notes')
    .eq('id', user.id)
    .single()
  const profile = profileData as unknown as { first_name: string | null; last_name: string | null; account_status: string | null; verification_notes: string | null } | null

  const { data: proData }  = await supabase.from('professionnels').select('id, title').eq('profile_id', user.id).maybeSingle()
  const { data: estData }  = await supabase.from('etablissements').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string; title?: string | null } | null
  const accountStatus = profile ? { status: profile.account_status, refusal_reason: profile.verification_notes } : null

  const today = new Date().toISOString().split('T')[0]

  const [
    { count: rdvAujourdhui },
    { count: patientsAttendus },
    { count: consultationsEnCours },
    { count: ordonnancesAFinaliser },
    { data: upcomingData },
  ] = await Promise.all([
    pro
      ? supabase.from('rendez_vous').select('*', { count: 'exact', head: true })
          .eq('professional_id', pro.id).eq('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show")')
      : Promise.resolve({ count: 0 }),
    pro
      ? supabase.from('rendez_vous').select('*', { count: 'exact', head: true })
          .eq('professional_id', pro.id).eq('appointment_date', today)
          .in('status', ['confirmed', 'arrived'])
      : Promise.resolve({ count: 0 }),
    pro
      ? (supabase.from('consultations') as unknown as {
          select: (s: string, o: object) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ count: number | null }> } }
        }).select('*', { count: 'exact', head: true })
            .eq('professional_id', pro.id).eq('status', 'in_progress')
      : Promise.resolve({ count: 0 }),
    pro
      ? (supabase.from('ordonnances') as unknown as {
          select: (s: string, o: object) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => Promise<{ count: number | null }> } }
        }).select('*', { count: 'exact', head: true })
            .eq('professional_id', pro.id).eq('status', 'draft')
      : Promise.resolve({ count: 0 }),
    pro
      ? supabase.from('rendez_vous')
          .select(`id, start_time, status, appointment_type, reason,
            patients!inner(profiles!inner(first_name, last_name))`)
          .eq('professional_id', pro.id)
          .eq('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show","completed")')
          .order('start_time', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const upcoming = (upcomingData ?? []) as unknown as UpcomingApt[]

  const KPIs = [
    { label: 'RDV aujourd\'hui',          value: rdvAujourdhui       ?? 0, icon: Calendar,    color: 'text-blue-600 bg-blue-50' },
    { label: 'Patients attendus',          value: patientsAttendus    ?? 0, icon: Users,       color: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
    { label: 'Consultations en cours',     value: consultationsEnCours ?? 0, icon: Stethoscope, color: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
    { label: 'Ordonnances à finaliser',    value: ordonnancesAFinaliser ?? 0, icon: FileText,   color: 'text-amber-600 bg-amber-50' },
  ]

  const todayFmt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {accountStatus && accountStatus.status !== 'verified' && (
        <AccountStatusBanner status={accountStatus.status as 'pending'} motif={accountStatus.refusal_reason} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">
          Bonjour{pro?.title ? `, ${pro.title}` : ''}{profile?.last_name ? ` ${profile.last_name}` : ''} 👋
        </h1>
        <p className="text-[var(--sw-ink-2)] mt-0.5 capitalize">{todayFmt}</p>
      </div>

      {/* Mon activité — 4 KPIs */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wider mb-3">Mon activité</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPIs.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="sw-card p-4 space-y-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <p className="text-2xl font-bold text-[var(--sw-ink)]">{value}</p>
              <p className="text-xs text-[var(--sw-ink-2)] leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prochains rendez-vous */}
      <div className="sw-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sw-line)]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--sw-ink-2)]" />
            <h2 className="font-semibold text-[var(--sw-ink)]">Prochains rendez-vous</h2>
          </div>
          <Link href="/sante/rendez-vous" className="text-xs text-[var(--sw-primary)] hover:underline">
            Voir tout
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Calendar className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun rendez-vous aujourd'hui.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--sw-line)]">
            {upcoming.map(apt => {
              const p = (apt.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
              const fullName = p ? `${p.first_name} ${p.last_name}`.trim() : 'Patient inconnu'
              const cfg = STATUS_CONFIG[apt.status] ?? { label: apt.status, cls: 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]' }
              return (
                <li key={apt.id}>
                  <Link
                    href={`/sante/consultations/${apt.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--sw-surface-2)] transition-colors"
                  >
                    <span className="text-sm font-semibold text-[var(--sw-ink)] w-14 shrink-0">
                      {apt.start_time?.slice(0, 5) ?? '--:--'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{fullName}</p>
                      <p className="text-xs text-[var(--sw-ink-2)] truncate">
                        {apt.reason ?? (apt.appointment_type === 'teleconsultation' ? 'Téléconsultation' : 'Consultation générale')}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/sante/agenda',       label: "Voir l’agenda",       icon: Calendar },
          { href: '/sante/patients',     label: 'Chercher un patient', icon: Users },
          { href: '/sante/ordonnances',  label: 'Mes ordonnances',     icon: FileText },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors"
          >
            <Icon className="w-4 h-4 text-[var(--sw-ink-2)]" />
            <span className="text-sm font-medium text-[var(--sw-ink)]">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
