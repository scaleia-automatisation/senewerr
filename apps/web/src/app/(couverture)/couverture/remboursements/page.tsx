import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RefreshCw, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Remboursements — Couverture' }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtCFA(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

type Req = {
  id: string; status: string; coverage_amount_fcfa: number | null; approved_at: string | null
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  pharmacies: { name: string } | null
  establishments: { name: string } | null
}

export default async function RemboursementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('organismes_couverture').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const { data: reqsData } = await supabase
    .from('demandes_couverture')
    .select('id, status, coverage_amount_fcfa, approved_at, patients(profiles(first_name, last_name)), pharmacies(name), establishments(name)')
    .eq('coverage_org_id', org.id)
    .eq('status', 'approved')
    .eq('payment_mode', 'remboursement')
    .order('approved_at', { ascending: false })

  const reqs = (reqsData ?? []) as unknown as Req[]
  const total = reqs.reduce((s, r) => s + (r.coverage_amount_fcfa ?? 0), 0)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-warning-bg)] flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-[var(--sw-warning)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Remboursements différés</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Remboursements à effectuer directement aux adhérents</p>
        </div>
      </div>

      {reqs.length > 0 && (
        <div className="sw-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Total à rembourser</p>
            <p className="text-2xl font-bold text-[var(--sw-warning)]">{fmtCFA(total)}</p>
          </div>
          <span className="text-sm text-[var(--sw-ink-2)]">{reqs.length} dossier{reqs.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {reqs.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <RefreshCw className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun remboursement en attente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reqs.map(r => {
            const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
            const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
            const provName = (r.pharmacies as unknown as { name: string } | null)?.name ?? (r.establishments as unknown as { name: string } | null)?.name
            const refNum = `PC-${r.id.slice(-6).toUpperCase()}`
            return (
              <Link key={r.id} href={`/couverture/demandes/${r.id}`} className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[var(--sw-primary)]">{refNum}</span>
                    <span className="text-xs font-bold text-[var(--sw-warning)]">{fmtCFA(r.coverage_amount_fcfa)}</span>
                  </div>
                  <p className="text-sm text-[var(--sw-ink)]">{patName}</p>
                  <div className="flex gap-3 text-xs text-[var(--sw-ink-2)]">
                    {provName && <span>{provName}</span>}
                    {r.approved_at && <span>{fmtDate(r.approved_at)}</span>}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
