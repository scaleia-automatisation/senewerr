import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users, Stethoscope, Building2, Package, Shield,
  AlertTriangle, CreditCard, FolderOpen, CheckCircle2, Clock
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Administration — Séné Wérr' }

// Spec 21.2 — tableau de bord admin avec stats réelles
type CountQuery = {
  select: (q: string, opts: { count: string; head: boolean }) => {
    eq?: (c: string, v: string) => Promise<{ count: number | null }>
    in?: (c: string, v: string[]) => Promise<{ count: number | null }>
    then: (fn: (r: { count: number | null }) => unknown) => Promise<unknown>
  } & Promise<{ count: number | null }>
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  // Spec 21.2 — comptages par acteur et actions prioritaires
  const [
    patientsRes, profsRes, etablissRes, pharmaciesRes, organismesRes,
    pendingProfsRes, pendingPaymentsRes, blockedRes,
  ] = await Promise.allSettled([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('professionals').select('id', { count: 'exact', head: true }),
    supabase.from('establishments').select('id', { count: 'exact', head: true }),
    supabase.from('pharmacies').select('id', { count: 'exact', head: true }),
    supabase.from('organismes_couverture').select('id', { count: 'exact', head: true }),
    // Comptes à vérifier : professionnels sans vérification
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .eq('status', 'pending_verification'),
    // Paiements en attente
    supabase.from('payments').select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    // Dossiers bloqués : réservations bloquées depuis longtemps
    supabase.from('pharmacy_reservations').select('id', { count: 'exact', head: true })
      .in('status', ['verifying', 'awaiting_coverage', 'awaiting_payment']),
  ])

  function cnt(res: PromiseSettledResult<{ count: number | null }>): number {
    return res.status === 'fulfilled' ? (res.value.count ?? 0) : 0
  }

  const stats = {
    patients: cnt(patientsRes),
    professionnels: cnt(profsRes),
    etablissements: cnt(etablissRes),
    pharmacies: cnt(pharmaciesRes),
    organismes: cnt(organismesRes),
    comptes_a_verifier: cnt(pendingProfsRes),
    paiements_en_attente: cnt(pendingPaymentsRes),
    dossiers_bloques: cnt(blockedRes),
  }
  const demandesATraiter = stats.comptes_a_verifier + stats.paiements_en_attente + stats.dossiers_bloques

  const actorCards = [
    { label: 'Patients inscrits', value: stats.patients, icon: <Users className="w-5 h-5 text-[var(--sw-primary)]" />, href: '/admin/patients', color: 'bg-[var(--sw-primary-subtle)]' },
    { label: 'Professionnels', value: stats.professionnels, icon: <Stethoscope className="w-5 h-5 text-purple-600" />, href: '/admin/professionnels', color: 'bg-purple-50' },
    { label: 'Établissements', value: stats.etablissements, icon: <Building2 className="w-5 h-5 text-blue-600" />, href: '/admin/etablissements', color: 'bg-blue-50' },
    { label: 'Pharmacies', value: stats.pharmacies, icon: <Package className="w-5 h-5 text-orange-600" />, href: '/admin/pharmacies', color: 'bg-orange-50' },
    { label: 'Organismes', value: stats.organismes, icon: <Shield className="w-5 h-5 text-[var(--sw-success)]" />, href: '/admin/organismes', color: 'bg-[var(--sw-success-bg)]' },
  ]

  const priorityActions = [
    {
      label: 'Comptes à vérifier',
      value: stats.comptes_a_verifier,
      href: '/admin/validation',
      icon: <CheckCircle2 className="w-4 h-4" />,
      urgent: stats.comptes_a_verifier > 0,
    },
    {
      label: 'Paiements en attente',
      value: stats.paiements_en_attente,
      href: '/admin/paiements?status=pending',
      icon: <CreditCard className="w-4 h-4" />,
      urgent: stats.paiements_en_attente > 0,
    },
    {
      label: 'Dossiers bloqués',
      value: stats.dossiers_bloques,
      href: '/admin/dossiers-bloques',
      icon: <FolderOpen className="w-4 h-4" />,
      urgent: stats.dossiers_bloques > 0,
    },
  ]

  // Spec 21.3 — raccourcis vers les sections de l'admin
  const menuLinks = [
    { label: 'Utilisateurs', href: '/admin/utilisateurs', icon: <Users className="w-4 h-4" /> },
    { label: 'Rendez-vous', href: '/admin/rendezvous', icon: <Clock className="w-4 h-4" /> },
    { label: 'Réservations', href: '/admin/reservations', icon: <Package className="w-4 h-4" /> },
    { label: 'Prises en charge', href: '/admin/prises-en-charge', icon: <Shield className="w-4 h-4" /> },
    { label: 'Paiements', href: '/admin/paiements', icon: <CreditCard className="w-4 h-4" /> },
    { label: 'Litiges', href: '/admin/litiges', icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Notifications', href: '/admin/notifications', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Rappels', href: '/admin/rappels', icon: <Clock className="w-4 h-4" /> },
    { label: 'Journal d\'audit', href: '/admin/historique', icon: <FolderOpen className="w-4 h-4" /> },
    { label: 'Événements', href: '/admin/evenements', icon: <FolderOpen className="w-4 h-4" /> },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Administration — Séné Wérr</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Vue générale · spec 21.2</p>
      </div>

      {/* Demandes à traiter */}
      {demandesATraiter > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--sw-warning-bg)]">
          <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0" />
          <p className="text-sm font-medium text-[var(--sw-warning)]">
            {demandesATraiter} demande{demandesATraiter > 1 ? 's' : ''} à traiter
          </p>
        </div>
      )}

      {/* Stats acteurs */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Acteurs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {actorCards.map(c => (
            <Link key={c.href} href={c.href} className="sw-card p-4 flex items-center gap-3 hover:bg-[var(--sw-surface-2)] transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>{c.icon}</div>
              <div>
                <p className="text-xs text-[var(--sw-ink-3)]">{c.label}</p>
                <p className="text-xl font-bold text-[var(--sw-ink)]">{c.value.toLocaleString('fr-SN')}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Actions prioritaires */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Actions prioritaires</h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {priorityActions.map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--sw-surface-2)] transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.urgent && a.value > 0 ? 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
                  {a.icon}
                </div>
                <span className="flex-1 text-sm font-medium text-[var(--sw-ink)]">{a.label}</span>
                <span className={`text-sm font-bold ${a.urgent && a.value > 0 ? 'text-[var(--sw-warning)]' : 'text-[var(--sw-ink-3)]'}`}>
                  {a.value}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Accès rapide menus (spec 21.3) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-2">
          {menuLinks.map(m => (
            <Link key={m.href} href={m.href}
              className="sw-card px-4 py-3 flex items-center gap-2.5 hover:bg-[var(--sw-surface-2)] transition-colors">
              <span className="text-[var(--sw-ink-3)]">{m.icon}</span>
              <span className="text-sm font-medium text-[var(--sw-ink)]">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
