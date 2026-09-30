import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, Stethoscope, Building2, ShoppingBag, Shield, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Utilisateurs — Admin Séné Wérr' }

type StatusFilter = 'all' | 'pending' | 'verified' | 'refused'

interface GenericAccount {
  id: string
  profile_id: string
  created_at: string
  name?: string
  professional_type?: string
  org_type?: string
  profiles: { first_name: string; last_name: string; phone: string | null; account_status: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft:      { label: 'Brouillon',    className: 'text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)]',            icon: Clock },
  pending:    { label: 'En attente',   className: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]',         icon: Clock },
  needs_info: { label: 'À compléter',  className: 'text-[var(--sw-warning)] bg-[var(--sw-warning-bg)]',         icon: AlertCircle },
  verified:   { label: 'Vérifié',      className: 'text-[var(--sw-success)] bg-[var(--sw-success-bg)]',         icon: CheckCircle2 },
  refused:    { label: 'Refusé',       className: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]',   icon: XCircle },
  suspended:  { label: 'Suspendu',     className: 'text-[var(--sw-danger)] bg-[var(--sw-danger-bg,#fef2f2)]',   icon: XCircle },
  disabled:   { label: 'Désactivé',    className: 'text-[var(--sw-ink-3)] bg-[var(--sw-surface-2)]',            icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

interface Props {
  searchParams: Promise<{ status?: string; type?: string }>
}

export default async function AdminUtilisateursPage({ searchParams }: Props) {
  const { status = 'pending', type = 'professionals' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/admin/utilisateurs')

  const TABS = [
    { value: 'professionals', icon: Stethoscope, label: 'Professionnels' },
    { value: 'establishments', icon: Building2,  label: 'Établissements' },
    { value: 'pharmacies',     icon: ShoppingBag, label: 'Pharmacies' },
    { value: 'coverage_orgs',  icon: Shield,     label: 'Couvertures' },
  ]

  const STATUS_TABS: { value: string; label: string }[] = [
    { value: 'pending',    label: 'En attente' },
    { value: 'needs_info', label: 'À compléter' },
    { value: 'verified',   label: 'Vérifiés' },
    { value: 'refused',    label: 'Refusés' },
    { value: 'all',        label: 'Tous' },
  ]

  let accounts: GenericAccount[] = []
  let pendingCount = 0

  // Requête principale selon le type
  const selectQuery = `id, profile_id, created_at, profiles!inner(first_name, last_name, phone, account_status)`
  const extraFields = type === 'professionals'
    ? ', professional_type, specialty'
    : type === 'coverage_orgs'
      ? ', name, org_type'
      : ', name'

  let query = (supabase.from(type as 'professionals') as unknown as {
    select: (s: string) => {
      eq: (col: string, val: string) => { order: (col: string, opts: object) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } }
      order: (col: string, opts: object) => { limit: (n: number) => Promise<{ data: unknown[] | null }> }
    }
  }).select(selectQuery + extraFields)

  const { data } = status === 'all'
    ? await (query as unknown as { order: (col: string, opts: object) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } })
        .order('created_at', { ascending: false }).limit(50)
    : await (query as unknown as {
        eq: (col: string, val: string) => { order: (col: string, opts: object) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } }
      }).eq('profiles.account_status', status).order('created_at', { ascending: false }).limit(50)

  accounts = (data ?? []) as unknown as GenericAccount[]

  // Count pour le badge "en attente"
  const { count: rawCount } = await (supabase.from(type as 'professionals') as unknown as {
    select: (s: string, opts: object) => Promise<{ count: number | null }>
  }).select('id', { count: 'exact', head: true })
  pendingCount = rawCount ?? 0

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <Users className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Gestion des comptes</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Validation et suivi des inscriptions</p>
        </div>
      </div>

      {/* Onglets par type */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(({ value, icon: Icon, label }) => (
          <Link
            key={value}
            href={`/admin/utilisateurs?type=${value}&status=${status}`}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              type === value
                ? 'bg-[var(--sw-primary)] text-white'
                : 'bg-[var(--sw-surface)] border border-[var(--sw-line)] text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Onglets par statut */}
      <div className="flex gap-1.5 flex-wrap border-b border-[var(--sw-line)] pb-3">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/utilisateurs?type=${type}&status=${value}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === value
                ? 'bg-[var(--sw-ink)] text-white'
                : 'text-[var(--sw-ink-2)] hover:bg-[var(--sw-surface-2)]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Résultats */}
      <div>
        <p className="text-xs text-[var(--sw-ink-3)] mb-3">{accounts.length} résultat{accounts.length !== 1 ? 's' : ''}</p>

        {accounts.length === 0 ? (
          <div className="sw-card p-8 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucun compte dans cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(account => {
              const proName = account.profiles
                ? `${account.profiles.first_name} ${account.profiles.last_name}`.trim()
                : 'Inconnu'
              const subLabel = account.name ?? account.professional_type?.replace(/_/g, ' ') ?? account.org_type?.replace(/_/g, ' ') ?? ''
              return (
                <Link
                  key={account.id}
                  href={`/admin/utilisateurs/${account.id}?table=${type}`}
                  className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[var(--sw-primary)]">
                      {proName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{proName}</p>
                    <p className="text-xs text-[var(--sw-ink-2)]">
                      {subLabel}
                      {account.profiles?.phone ? ` · ${account.profiles.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={account.profiles?.account_status ?? 'pending'} />
                    <span className="text-xs text-[var(--sw-ink-3)]">
                      {new Date(account.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
