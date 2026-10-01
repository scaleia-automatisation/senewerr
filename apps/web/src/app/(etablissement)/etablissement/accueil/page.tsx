import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, Users, UserCheck, ClipboardList, ChevronRight, Circle } from 'lucide-react'
import { AccountStatusBanner } from '@/components/ui/account-status-banner'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord — Établissement Séné Wérr' }

interface ProMember {
  id: string
  function: string | null
  professional: {
    id: string
    title: string | null
    professional_type: string | null
    specialty: string | null
    profiles: { first_name: string; last_name: string } | null
  } | null
}

interface TodayApt {
  id: string
  start_time: string
  end_time: string | null
  status: string
  professional_id: string
}

export default async function EtablissementAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase
    .from('etablissements')
    .select('id, name')
    .eq('profile_id', user.id)
    .single()
  if (!estRaw) redirect('/sante/accueil')

  const est = estRaw as unknown as { id: string; name: string }

  const { data: estProfileData } = await supabase
    .from('profils')
    .select('account_status, verification_notes')
    .eq('id', user.id)
    .maybeSingle()
  const estProfile = estProfileData as unknown as { account_status: string | null; verification_notes: string | null } | null

  const today = new Date().toISOString().split('T')[0]

  // Membres actifs
  const { data: membersData } = await supabase
    .from('establishment_professionals')
    .select(`
      id, function,
      professional:professionals(
        id, title, professional_type, specialty,
        profiles!inner(first_name, last_name)
      )
    `)
    .eq('establishment_id', est.id)
    .eq('status', 'accepted')
  const members = (membersData ?? []) as unknown as ProMember[]
  const proIds = members.map(m => m.professional?.id).filter(Boolean) as string[]

  // Demandes en attente d'invitation
  const { count: pendingInvites } = await supabase
    .from('establishment_professionals')
    .select('*', { count: 'exact', head: true })
    .eq('establishment_id', est.id)
    .eq('status', 'pending')

  // RDV d'aujourd'hui + patients attendus
  const [{ count: rdvCount }, { count: patientsCount }, { data: aptData }] = await Promise.all([
    proIds.length > 0
      ? supabase.from('rendez_vous').select('*', { count: 'exact', head: true })
          .in('professional_id', proIds).eq('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show")')
      : Promise.resolve({ count: 0 }),
    proIds.length > 0
      ? supabase.from('rendez_vous').select('*', { count: 'exact', head: true })
          .in('professional_id', proIds).eq('appointment_date', today)
          .in('status', ['confirmed', 'arrived'])
      : Promise.resolve({ count: 0 }),
    proIds.length > 0
      ? supabase.from('rendez_vous')
          .select('id, start_time, end_time, status, professional_id')
          .in('professional_id', proIds)
          .eq('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show")')
          .order('start_time', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const todayApts = (aptData ?? []) as unknown as TodayApt[]

  // Construire planning du jour : pour chaque professionnel actif, plage horaire d'activité
  const proSchedule = members
    .map(m => {
      const pro = m.professional
      if (!pro) return null
      const proApts = todayApts.filter(a => a.professional_id === pro.id)
      if (proApts.length === 0) return null
      const start = proApts[0].start_time?.slice(0, 5) ?? '--:--'
      const last  = proApts[proApts.length - 1]
      const end   = last.end_time?.slice(0, 5) ?? '--:--'
      const isActive = proApts.some(a => a.status === 'in_progress' || a.status === 'arrived')
      const isComing = proApts.every(a => a.status === 'pending' || a.status === 'confirmed')
      const fullName = pro.profiles
        ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.last_name}`.trim()
        : 'Dr ?'
      return { id: pro.id, name: fullName, specialty: pro.specialty ?? pro.professional_type ?? '', start, end, isActive, isComing }
    })
    .filter(Boolean) as { id: string; name: string; specialty: string; start: string; end: string; isActive: boolean; isComing: boolean }[]

  const todayFmt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const KPIs = [
    { label: 'Rendez-vous du jour',   value: rdvCount      ?? 0, icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
    { label: 'Professionnels actifs', value: members.length,     icon: Users,        color: 'text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]' },
    { label: 'Patients attendus',     value: patientsCount ?? 0, icon: UserCheck,    color: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]' },
    { label: 'Demandes de planning',  value: pendingInvites ?? 0, icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {estProfile?.account_status && estProfile.account_status !== 'verified' && (
        <AccountStatusBanner status={estProfile.account_status as 'pending'} motif={estProfile.verification_notes} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-[var(--sw-ink)]">{est.name}</h1>
        <p className="text-[var(--sw-ink-2)] mt-0.5 capitalize">{todayFmt}</p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIs.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="sw-card p-4 space-y-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon style={{ width: 18, height: 18 }} />
            </div>
            <p className="text-2xl font-bold text-[var(--sw-ink)]">{value}</p>
            <p className="text-xs text-[var(--sw-ink-2)] leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Planning du jour */}
      <div className="sw-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sw-line)]">
          <h2 className="font-semibold text-[var(--sw-ink)]">Planning du jour</h2>
          <Link href="/etablissement/agenda" className="text-xs text-[var(--sw-primary)] hover:underline">
            Voir l&apos;agenda complet
          </Link>
        </div>

        {proSchedule.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <CalendarDays className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun professionnel en activité aujourd&apos;hui.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--sw-line)]">
            {proSchedule.map(ps => (
              <li key={ps.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">
                    {ps.start} – {ps.end}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{ps.name}</p>
                  <p className="text-xs text-[var(--sw-ink-2)] capitalize truncate">
                    {ps.specialty.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  ps.isActive
                    ? 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]'
                    : 'text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)]'
                }`}>
                  <Circle style={{ width: 7, height: 7, fill: 'currentColor' }} />
                  {ps.isActive ? 'Actif' : 'À venir'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Raccourcis */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/etablissement/professionnels', label: 'Gérer l\'équipe',   icon: Users },
          { href: '/etablissement/rendez-vous',    label: 'Rendez-vous',       icon: CalendarDays },
          { href: '/etablissement/finances',       label: 'Finances',          icon: CalendarDays },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors"
          >
            <Icon className="w-4 h-4 text-[var(--sw-ink-2)]" />
            <span className="text-sm font-medium text-[var(--sw-ink)]">{label}</span>
            <ChevronRight className="w-4 h-4 text-[var(--sw-ink-3)] ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  )
}
