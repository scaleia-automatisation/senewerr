import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Couverture — Mon dossier' }

const ORG_TYPE_LABELS: Record<string, string> = {
  mutuelle_communautaire: 'Mutuelle communautaire', msae: 'MSAE',
  mutuelle_professionnelle: 'Mutuelle professionnelle', ipm: 'IPM', assurance_privee: 'Assurance privée',
}

function fmtDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Member = {
  id: string; member_number: string | null; start_date: string | null; end_date: string | null; is_active: boolean
  coverage_orgs: { name: string; org_type: string | null } | null
  coverage_plans: { name: string } | null
}

export default async function DossierCouverturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const memberships: Member[] = []
  if (patient) {
    const { data } = await supabase
      .from('adherents_couverture')
      .select('id, member_number, start_date, end_date, is_active, coverage_orgs(name, org_type), coverage_plans(name)')
      .eq('patient_id', patient.id)
      .order('is_active', { ascending: false })
    if (data) memberships.push(...(data as unknown as Member[]))
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <p className="text-xs text-[var(--sw-ink-2)]">{memberships.length} affiliation{memberships.length > 1 ? 's' : ''}</p>

      {memberships.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Shield className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune couverture enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map(m => {
            const org = (m.coverage_orgs as unknown as { name: string; org_type: string | null } | null)
            const plan = (m.coverage_plans as unknown as { name: string } | null)
            return (
              <div key={m.id} className="sw-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
                        <Shield className="w-4 h-4 text-[var(--sw-primary)]" />
                      </div>
                      <p className="text-sm font-bold text-[var(--sw-ink)]">{org?.name ?? 'Organisme'}</p>
                    </div>
                    {org?.org_type && <p className="text-xs text-[var(--sw-ink-3)] ml-10">{ORG_TYPE_LABELS[org.org_type] ?? org.org_type}</p>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${m.is_active ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
                    {m.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {m.member_number && (
                    <div>
                      <p className="text-[var(--sw-ink-3)]">N° adhérent</p>
                      <p className="font-medium text-[var(--sw-ink)]">{m.member_number}</p>
                    </div>
                  )}
                  {plan?.name && (
                    <div>
                      <p className="text-[var(--sw-ink-3)]">Formule</p>
                      <p className="font-medium text-[var(--sw-ink)]">{plan.name}</p>
                    </div>
                  )}
                  {m.start_date && (
                    <div>
                      <p className="text-[var(--sw-ink-3)]">Début</p>
                      <p className="font-medium text-[var(--sw-ink)]">{fmtDate(m.start_date)}</p>
                    </div>
                  )}
                  {m.end_date && (
                    <div>
                      <p className="text-[var(--sw-ink-3)]">Fin</p>
                      <p className="font-medium text-[var(--sw-ink)]">{fmtDate(m.end_date)}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
