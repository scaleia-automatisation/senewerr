import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users, TrendingUp, Package, Shield, CreditCard,
  AlertTriangle, Activity, Server, Settings
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Super Administration — Séné Wérr' }

// Spec 22.4 — indicateurs globaux agrégés (pas de données nominatives)
export default async function SuperAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  // Spec 22.4 — inscriptions, comptes actifs, transactions, réservations, prises en charge, incidents
  const [
    patientsRes, profsRes, pharmaciesRes, orgRes,
    totalPaymentsRes, totalAmountRes, reservationsRes, coverageRes,
    incidentsRes, activeRes,
  ] = await Promise.allSettled([
    supabase.from('patients').select('id', { count: 'exact', head: true }),
    supabase.from('professionnels').select('id', { count: 'exact', head: true }),
    supabase.from('pharmacies').select('id', { count: 'exact', head: true }),
    supabase.from('organismes_couverture').select('id', { count: 'exact', head: true }),
    supabase.from('paiements').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('paiements').select('amount_fcfa').eq('status', 'confirmed'),
    supabase.from('reservations_pharmacie').select('id', { count: 'exact', head: true }),
    supabase.from('demandes_couverture').select('id', { count: 'exact', head: true }),
    supabase.from('profils').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    // Incidents : system_events de type failure dans les dernières 24h
    supabase.from('evenements_systeme').select('id', { count: 'exact', head: true }).eq('result', 'failure'),
  ])

  function cnt(res: PromiseSettledResult<{ count: number | null }>): number {
    return res.status === 'fulfilled' ? (res.value.count ?? 0) : 0
  }

  const totalAmount = totalAmountRes.status === 'fulfilled'
    ? ((totalAmountRes.value.data ?? []) as unknown as { amount_fcfa: number }[])
        .reduce((sum, p) => sum + (p.amount_fcfa ?? 0), 0)
    : 0

  function fmtCFA(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M F CFA`
    if (n >= 1000) return `${Math.round(n / 1000)} k F CFA`
    return `${n} F CFA`
  }

  const kpis = [
    { label: 'Patients inscrits', value: cnt(patientsRes).toLocaleString('fr-SN'), icon: <Users className="w-5 h-5 text-[var(--sw-primary)]" />, color: 'bg-[var(--sw-primary-subtle)]' },
    { label: 'Professionnels', value: cnt(profsRes).toLocaleString('fr-SN'), icon: <Users className="w-5 h-5 text-purple-600" />, color: 'bg-purple-50' },
    { label: 'Pharmacies', value: cnt(pharmaciesRes).toLocaleString('fr-SN'), icon: <Package className="w-5 h-5 text-orange-600" />, color: 'bg-orange-50' },
    { label: 'Organismes', value: cnt(orgRes).toLocaleString('fr-SN'), icon: <Shield className="w-5 h-5 text-[var(--sw-success)]" />, color: 'bg-[var(--sw-success-bg)]' },
    { label: 'Comptes actifs', value: cnt(activeRes).toLocaleString('fr-SN'), icon: <Activity className="w-5 h-5 text-[var(--sw-primary)]" />, color: 'bg-[var(--sw-primary-subtle)]' },
    { label: 'Transactions', value: cnt(totalPaymentsRes).toLocaleString('fr-SN'), icon: <CreditCard className="w-5 h-5 text-[var(--sw-success)]" />, color: 'bg-[var(--sw-success-bg)]' },
    { label: 'Volume paiements', value: fmtCFA(totalAmount), icon: <TrendingUp className="w-5 h-5 text-blue-600" />, color: 'bg-blue-50' },
    { label: 'Réservations', value: cnt(reservationsRes).toLocaleString('fr-SN'), icon: <Package className="w-5 h-5 text-orange-600" />, color: 'bg-orange-50' },
    { label: 'Prises en charge', value: cnt(coverageRes).toLocaleString('fr-SN'), icon: <Shield className="w-5 h-5 text-purple-600" />, color: 'bg-purple-50' },
    { label: 'Erreurs système', value: cnt(incidentsRes).toLocaleString('fr-SN'), icon: <AlertTriangle className="w-5 h-5 text-[var(--sw-danger)]" />, color: 'bg-red-50' },
  ]

  // Spec 22.2 — fonctions principales accessibles
  const sections = [
    { label: 'Gestion des admins', href: '/super-admin/admins', icon: <Users className="w-4 h-4" />, desc: 'Créer, configurer, limiter les permissions' },
    { label: 'Paramétrage central', href: '/super-admin/parametres', icon: <Settings className="w-4 h-4" />, desc: 'Durées, délais, catégories, types de couvertures' },
    { label: 'Fonctionnalités', href: '/super-admin/fonctionnalites', icon: <Server className="w-4 h-4" />, desc: 'Activer ou désactiver des modules' },
    { label: 'Abonnements & tarifs', href: '/super-admin/abonnements', icon: <CreditCard className="w-4 h-4" />, desc: 'Plans, prix, périodes' },
    { label: 'Journal de sécurité', href: '/super-admin/securite', icon: <AlertTriangle className="w-4 h-4" />, desc: 'Accès, anomalies, audits critiques' },
    { label: 'Incidents techniques', href: '/super-admin/incidents', icon: <Activity className="w-4 h-4" />, desc: 'Supervision et résolution' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Super Administration</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Supervision globale — spec 22.4 · Données agrégées, aucune donnée nominative</p>
      </div>

      {/* Spec 22.4 — indicateurs globaux */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Indicateurs globaux</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {kpis.map(k => (
            <div key={k.label} className="sw-card p-3 flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.color}`}>{k.icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--sw-ink-3)] truncate">{k.label}</p>
                <p className="text-base font-bold text-[var(--sw-ink)]">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spec 22.2 — fonctions principales */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2">Fonctions super admin</h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {sections.map(s => (
              <Link key={s.href} href={s.href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--sw-surface-2)] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0 text-[var(--sw-ink-3)]">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{s.label}</p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{s.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Lien vers l'admin standard */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Spec 22.1 — Ce compte ne doit pas être utilisé comme un compte métier ordinaire.
          Pour les opérations courantes, utiliser{' '}
          <Link href="/admin" className="underline">l'espace admin</Link>.
        </p>
      </div>
    </div>
  )
}
