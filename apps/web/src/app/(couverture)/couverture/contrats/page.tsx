import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileCheck2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contrats et formules — Couverture' }

type Plan = {
  id: string; name: string; description: string | null; monthly_fee_fcfa: number | null
  max_members: number | null; is_active: boolean | null
}

export default async function ContratsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('coverage_orgs').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const { data: plansData } = await supabase
    .from('coverage_plans')
    .select('id, name, description, monthly_fee_fcfa, max_members, is_active')
    .eq('coverage_org_id', org.id)
    .order('name')

  const plans = (plansData ?? []) as unknown as Plan[]

  const fmtCFA = (n: number | null) => n != null ? new Intl.NumberFormat('fr-SN').format(n) + ' F CFA' : null

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <FileCheck2 className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Contrats et formules</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{plans.length} formule{plans.length > 1 ? 's' : ''} configurée{plans.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <FileCheck2 className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune formule configurée.</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">La gestion des contrats sera disponible prochainement.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className="sw-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--sw-ink)]">{p.name}</h2>
                  {p.description && <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">{p.description}</p>}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${p.is_active !== false ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
                  {p.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                {fmtCFA(p.monthly_fee_fcfa) && (
                  <div>
                    <p className="text-xs text-[var(--sw-ink-3)]">Cotisation mensuelle</p>
                    <p className="font-semibold text-[var(--sw-ink)]">{fmtCFA(p.monthly_fee_fcfa)}</p>
                  </div>
                )}
                {p.max_members != null && (
                  <div>
                    <p className="text-xs text-[var(--sw-ink-3)]">Membres max</p>
                    <p className="font-semibold text-[var(--sw-ink)]">{p.max_members}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
