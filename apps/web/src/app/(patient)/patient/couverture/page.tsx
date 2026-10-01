import { Shield, CheckCircle, XCircle, Info, Calendar, Hash, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ma couverture' }

interface CoverageMember {
  id: string
  member_number: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  coverage_orgs: {
    name: string
    org_type: string | null
  } | null
  coverage_plans: {
    name: string
    description: string | null
  } | null
}

export default async function CouverturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patientData } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user!.id)
    .single()
  const patient = patientData as unknown as { id: string } | null

  let memberships: CoverageMember[] = []

  if (patient) {
    const { data } = await supabase
      .from('adherents_couverture')
      .select(`
        id,
        member_number,
        start_date,
        end_date,
        is_active,
        coverage_orgs(name, org_type),
        coverage_plans(name, description)
      `)
      .eq('patient_id', patient.id)
      .order('is_active', { ascending: false })

    if (data) {
      memberships = data as unknown as CoverageMember[]
    }
  }

  const activeCount = memberships.filter(m => m.is_active).length

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Ma couverture santé</h1>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--sw-success-bg)] text-[var(--sw-success)]">
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Link
          href="/patient/couverture/declarer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Déclarer
        </Link>
      </div>

      {memberships.length === 0 ? (
        <div className="space-y-4">
          <div className="sw-card p-10 flex flex-col items-center gap-4 text-center">
            <Shield className="w-12 h-12 text-[var(--sw-ink-3)]" />
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">
                Vous n'avez pas encore déclaré de couverture
              </p>
              <p className="text-xs text-[var(--sw-ink-2)] mt-1">
                Déclarez votre mutuelle, IPM ou assurance pour bénéficier du tiers payant.
              </p>
            </div>
            <Link
              href="/patient/couverture/declarer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Déclarer ma couverture
            </Link>
          </div>

          {/* Info tiers payant */}
          <div className="sw-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--sw-info)]" />
              <p className="text-sm font-semibold text-[var(--sw-ink)]">Comment fonctionne la couverture ?</p>
            </div>
            <p className="text-xs text-[var(--sw-ink-2)] leading-relaxed">
              Grâce au <strong>tiers payant</strong>, votre mutuelle prend en charge une partie
              ou la totalité de vos frais de santé directement auprès des professionnels
              et pharmacies partenaires. Vous ne payez que votre quote-part.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Couvertures actives */}
          {memberships.filter(m => m.is_active).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Couvertures actives
              </h2>
              <div className="space-y-3">
                {memberships.filter(m => m.is_active).map(m => (
                  <CoverageCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {/* Couvertures inactives */}
          {memberships.filter(m => !m.is_active).length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Inactives / expirées
              </h2>
              <div className="space-y-3">
                {memberships.filter(m => !m.is_active).map(m => (
                  <CoverageCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {/* Info tiers payant */}
          <div className="sw-card p-4 flex items-start gap-3 bg-[var(--sw-info-bg)]">
            <Info className="w-4 h-4 text-[var(--sw-info)] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--sw-ink)]">Tiers payant</p>
              <p className="text-xs text-[var(--sw-ink-2)] leading-relaxed">
                Avec votre couverture active, vous bénéficiez du tiers payant dans les pharmacies
                et établissements partenaires Séné Wérr. Votre organisme est facturé directement.
              </p>
            </div>
          </div>

          {/* Lien demandes de prise en charge */}
          <a
            href="/patient/couverture/demandes"
            className="flex items-center justify-between p-4 sw-card hover:bg-[var(--sw-surface-2)] transition-colors"
            aria-label="Voir mes demandes de prise en charge"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--sw-ink)]">Mes demandes de prise en charge</span>
            </div>
            <span className="text-xs text-[var(--sw-ink-3)]">→</span>
          </a>
        </>
      )}
    </div>
  )
}

function CoverageCard({ membership }: { membership: CoverageMember }) {
  const isActive = membership.is_active

  return (
    <div className={cn(
      'sw-card p-4 space-y-3',
      isActive && 'border-[var(--sw-success)]'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            isActive ? 'bg-[var(--sw-success-bg)]' : 'bg-[var(--sw-surface-2)]'
          )}>
            <Shield className={cn('w-4 h-4', isActive ? 'text-[var(--sw-success)]' : 'text-[var(--sw-ink-3)]')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">
              {membership.coverage_orgs?.name ?? 'Organisme inconnu'}
            </p>
            {membership.coverage_orgs?.org_type && (
              <p className="text-xs text-[var(--sw-ink-3)]">{membership.coverage_orgs.org_type}</p>
            )}
          </div>
        </div>
        {isActive ? (
          <CheckCircle className="w-4 h-4 text-[var(--sw-success)] flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-[var(--sw-danger)] flex-shrink-0" />
        )}
      </div>

      {membership.coverage_plans && (
        <div className="pl-11 space-y-0.5">
          <p className="text-sm font-medium text-[var(--sw-ink)]">
            {membership.coverage_plans.name}
          </p>
          {membership.coverage_plans.description && (
            <p className="text-xs text-[var(--sw-ink-2)]">{membership.coverage_plans.description}</p>
          )}
        </div>
      )}

      <div className="pl-11 space-y-1.5">
        {membership.member_number && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
            <Hash className="w-3 h-3" />
            N° adhérent : <span className="font-medium text-[var(--sw-ink)] ml-0.5">{membership.member_number}</span>
          </div>
        )}

        {membership.start_date && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
            <Calendar className="w-3 h-3" />
            Du {formatDate(membership.start_date)}
            {membership.end_date && <> au {formatDate(membership.end_date)}</>}
          </div>
        )}
      </div>

      {!isActive && (
        <div className="pl-11">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-[var(--sw-danger)]">
            Couverture inactive
          </span>
        </div>
      )}
    </div>
  )
}
