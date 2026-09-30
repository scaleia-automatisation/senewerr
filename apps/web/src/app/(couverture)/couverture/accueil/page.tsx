import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, ClipboardCheck, CreditCard, FolderOpen, ArrowRight } from 'lucide-react'
import { AccountStatusBanner } from '@/components/ui/account-status-banner'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord — Couverture Séné Wérr' }

const STATUS_LABELS: Record<string, string> = {
  pending: 'À traiter', needs_info: 'Info requise',
  approved: 'Validée', refused: 'Refusée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  needs_info: 'bg-blue-50 text-blue-600',
  approved: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

const TYPE_LABELS: Record<string, string> = {
  medication: 'Médicament', consultation: 'Consultation',
  hospitalization: 'Hospitalisation', exam: 'Examen', other: 'Autre',
}

type Req = {
  id: string; status: string; request_type: string | null; created_at: string
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  pharmacies: { name: string } | null
  establishments: { name: string } | null
}

export default async function CouvertureAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('coverage_orgs').select('id, name, org_type').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string; name: string; org_type: string | null } | null
  if (!org) redirect('/connexion')

  const { data: coverageProfileData } = await supabase
    .from('profiles')
    .select('account_status, verification_notes')
    .eq('id', user.id)
    .maybeSingle()
  const coverageProfile = coverageProfileData as unknown as { account_status: string | null; verification_notes: string | null } | null

  const [
    { count: membresCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: closedCount },
    { data: lastReqData },
  ] = await Promise.all([
    supabase.from('coverage_members').select('*', { count: 'exact', head: true }).eq('coverage_org_id', org.id).eq('is_active', true),
    supabase.from('coverage_requests').select('*', { count: 'exact', head: true }).eq('coverage_org_id', org.id).in('status', ['pending', 'needs_info']),
    supabase.from('coverage_requests').select('*', { count: 'exact', head: true }).eq('coverage_org_id', org.id).eq('status', 'approved'),
    supabase.from('coverage_requests').select('*', { count: 'exact', head: true }).eq('coverage_org_id', org.id).in('status', ['approved', 'refused', 'cancelled']),
    supabase.from('coverage_requests')
      .select('id, status, request_type, created_at, patients(profiles(first_name, last_name)), pharmacies(name), establishments(name)')
      .eq('coverage_org_id', org.id)
      .in('status', ['pending', 'needs_info', 'approved'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const lastReqs = (lastReqData ?? []) as unknown as Req[]

  const ORG_TYPE_LABELS: Record<string, string> = {
    mutuelle_communautaire: 'Mutuelle communautaire',
    msae: 'MSAE',
    mutuelle_professionnelle: 'Mutuelle professionnelle',
    ipm: 'IPM',
    assurance_privee: 'Assurance privée',
  }

  const kpis = [
    { label: 'Adhérents actifs',        value: membresCount ?? 0,  icon: Users,         href: '/couverture/adherents', color: 'text-purple-600',                bg: 'bg-purple-50' },
    { label: 'Demandes en attente',      value: pendingCount ?? 0,  icon: ClipboardCheck, href: '/couverture/demandes', color: 'text-[var(--sw-warning)]',       bg: 'bg-[var(--sw-warning-bg)]' },
    { label: 'À payer (tiers payant)',   value: approvedCount ?? 0, icon: CreditCard,     href: '/couverture/paiements', color: 'text-[var(--sw-primary)]',      bg: 'bg-[var(--sw-primary-subtle)]' },
    { label: 'Dossiers clôturés',        value: closedCount ?? 0,   icon: FolderOpen,     href: '/couverture/demandes',  color: 'text-[var(--sw-ink-2)]',        bg: 'bg-[var(--sw-surface-2)]' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {coverageProfile?.account_status && coverageProfile.account_status !== 'verified' && (
        <AccountStatusBanner status={coverageProfile.account_status as 'pending'} motif={coverageProfile.verification_notes} />
      )}

      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">{org.name}</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">
          {org.org_type ? (ORG_TYPE_LABELS[org.org_type] ?? org.org_type) : 'Organisme de couverture'} — À traiter
        </p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} className="sw-card p-4 hover:border-[var(--sw-primary)] transition-colors">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString('fr-SN')}</p>
            <p className="text-xs text-[var(--sw-ink-2)] mt-1 leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* Dernières demandes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Dernières demandes</h2>
          <Link href="/couverture/demandes" className="flex items-center gap-1 text-xs text-[var(--sw-primary)] font-medium">
            Tout voir <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {lastReqs.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune demande en cours.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lastReqs.map(r => {
              const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
              const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
              const orgName = (r.pharmacies as unknown as { name: string } | null)?.name
                ?? (r.establishments as unknown as { name: string } | null)?.name
                ?? ''
              const refNum = `PC-${r.id.slice(-6).toUpperCase()}`
              return (
                <Link key={r.id} href={`/couverture/demandes/${r.id}`} className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono font-bold text-sm text-[var(--sw-primary)]">{refNum}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      {r.request_type && (
                        <span className="text-xs text-[var(--sw-ink-3)]">{TYPE_LABELS[r.request_type] ?? r.request_type}</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--sw-ink-2)]">
                      {patName}{orgName ? ` · ${orgName}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
