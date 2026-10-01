import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Garanties — Couverture' }

type Guarantee = {
  id: string; plan_id: string; act_type: string | null; coverage_rate: number | null
  max_amount_fcfa: number | null; requires_prescription: boolean | null
  tiers_payant: boolean | null; notes: string | null
  coverage_plans: { name: string } | null
}

const ACT_LABELS: Record<string, string> = {
  medication: 'Médicaments', consultation: 'Consultations',
  hospitalization: 'Hospitalisation', exam: 'Examens', other: 'Autres actes',
}

export default async function GarantiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('organismes_couverture').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const { data: plansData } = await supabase
    .from('formules_couverture')
    .select('id, name')
    .eq('coverage_org_id', org.id)

  const plans = (plansData ?? []) as unknown as { id: string; name: string }[]
  const planIds = plans.map(p => p.id)

  const guarantees: Guarantee[] = []
  if (planIds.length > 0) {
    const { data: gData } = await supabase
      .from('coverage_guarantees')
      .select('id, plan_id, act_type, coverage_rate, max_amount_fcfa, requires_prescription, tiers_payant, notes, coverage_plans(name)')
      .in('plan_id', planIds)
    if (gData) guarantees.push(...(gData as unknown as Guarantee[]))
  }

  const byPlan = plans.map(p => ({
    plan: p,
    items: guarantees.filter(g => g.plan_id === p.id),
  }))

  const fmtCFA = (n: number | null) => n != null ? new Intl.NumberFormat('fr-SN').format(n) + ' F CFA' : null

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-success-bg)] flex items-center justify-center">
          <Shield className="w-5 h-5 text-[var(--sw-success)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Garanties</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Taux et plafonds par formule</p>
        </div>
      </div>

      {byPlan.length === 0 || byPlan.every(b => b.items.length === 0) ? (
        <div className="sw-card p-10 text-center">
          <Shield className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune garantie configurée.</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">Configurez vos formules dans l'onglet Contrats, puis ajoutez les garanties ici.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {byPlan.map(({ plan, items }) => items.length > 0 && (
            <section key={plan.id}>
              <h2 className="text-sm font-bold text-[var(--sw-ink)] mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--sw-success)]" /> {plan.name}
              </h2>
              <div className="space-y-2">
                {items.map(g => (
                  <div key={g.id} className="sw-card p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--sw-ink)]">
                        {g.act_type ? (ACT_LABELS[g.act_type] ?? g.act_type) : 'Acte non précisé'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {g.tiers_payant && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] font-medium">Tiers payant</span>
                        )}
                        {g.requires_prescription && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] font-medium">Ordonnance requise</span>
                        )}
                      </div>
                      {g.notes && <p className="text-xs text-[var(--sw-ink-2)]">{g.notes}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {g.coverage_rate != null && (
                        <p className="text-xl font-bold text-[var(--sw-success)]">{g.coverage_rate}%</p>
                      )}
                      {fmtCFA(g.max_amount_fcfa) && (
                        <p className="text-xs text-[var(--sw-ink-2)]">Plafond : {fmtCFA(g.max_amount_fcfa)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
