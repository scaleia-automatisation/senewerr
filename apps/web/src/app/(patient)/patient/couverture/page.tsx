import { Shield, CheckCircle, XCircle, Info, Calendar, Hash, Plus, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RenvoyerForm } from './renvoyer-form'

export const metadata: Metadata = { title: 'Ma couverture' }

interface CoverageMember {
  id: string
  member_number: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  statut: string
  motif_refus: string | null
  employer_name: string | null
  organismes_couverture: {
    name: string
    org_type: string | null
  } | null
  formules_couverture: {
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
        id, member_number, employer_name, start_date, end_date, is_active, statut, motif_refus,
        organismes_couverture(name, org_type),
        formules_couverture(name, description)
      `)
      .eq('patient_id', patient.id)
      .order('statut', { ascending: true })

    if (data) {
      memberships = data as unknown as CoverageMember[]
    }
  }

  const activeCount  = memberships.filter(m => m.statut === 'actif').length
  const pendingCount = memberships.filter(m => m.statut === 'en_attente').length

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap gap-1.5 items-center">
          <h1 className="text-xl font-bold text-[var(--sw-ink)] w-full">Ma couverture santé</h1>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--sw-success-bg)] text-[var(--sw-success)]">
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
              {pendingCount} en attente
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
          {/* En attente */}
          {memberships.filter(m => m.statut === 'en_attente').length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                En attente de validation
              </h2>
              <div className="space-y-3">
                {memberships.filter(m => m.statut === 'en_attente').map(m => (
                  <CoverageCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {/* Couvertures actives */}
          {memberships.filter(m => m.statut === 'actif').length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Couvertures actives
              </h2>
              <div className="space-y-3">
                {memberships.filter(m => m.statut === 'actif').map(m => (
                  <CoverageCard key={m.id} membership={m} />
                ))}
              </div>
            </section>
          )}

          {/* Refusées / inactives */}
          {memberships.filter(m => m.statut === 'refuse').length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Refusées
              </h2>
              <div className="space-y-3">
                {memberships.filter(m => m.statut === 'refuse').map(m => (
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

const ORG_TYPE_LABELS: Record<string, string> = {
  mutuelle_communautaire:  'Mutuelle communautaire',
  mutuelle_professionnelle:'Mutuelle professionnelle',
  msae:                    'MSAE',
  ipm:                     'IPM',
  assurance_privee:        'Assurance privée',
}

function CoverageCard({ membership: m }: { membership: CoverageMember }) {
  const isActif    = m.statut === 'actif'
  const isAttente  = m.statut === 'en_attente'

  return (
    <div className={cn(
      'sw-card p-4 space-y-3',
      isActif   && 'border-[var(--sw-success)]',
      isAttente && 'border-amber-300'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            isActif   ? 'bg-[var(--sw-success-bg)]' :
            isAttente ? 'bg-amber-50' : 'bg-[var(--sw-surface-2)]'
          )}>
            <Shield className={cn(
              'w-4 h-4',
              isActif   ? 'text-[var(--sw-success)]' :
              isAttente ? 'text-amber-500' : 'text-[var(--sw-ink-3)]'
            )} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">
              {m.organismes_couverture?.name ?? 'Organisme inconnu'}
            </p>
            {m.organismes_couverture?.org_type && (
              <p className="text-xs text-[var(--sw-ink-3)]">
                {ORG_TYPE_LABELS[m.organismes_couverture.org_type] ?? m.organismes_couverture.org_type}
              </p>
            )}
          </div>
        </div>
        {isActif   && <CheckCircle className="w-4 h-4 text-[var(--sw-success)] flex-shrink-0" />}
        {isAttente && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">En attente</span>}
        {m.statut === 'refuse' && <XCircle className="w-4 h-4 text-[var(--sw-danger)] flex-shrink-0" />}
      </div>

      {m.formules_couverture && (
        <div className="pl-11 space-y-0.5">
          <p className="text-sm font-medium text-[var(--sw-ink)]">{m.formules_couverture.name}</p>
          {m.formules_couverture.description && (
            <p className="text-xs text-[var(--sw-ink-2)]">{m.formules_couverture.description}</p>
          )}
        </div>
      )}

      <div className="pl-11 space-y-1.5">
        {m.member_number && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
            <Hash className="w-3 h-3" />
            N° adhérent : <span className="font-medium text-[var(--sw-ink)] ml-0.5">{m.member_number}</span>
          </div>
        )}
        {m.start_date && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-2)]">
            <Calendar className="w-3 h-3" />
            Du {formatDate(m.start_date)}
            {m.end_date && <> au {formatDate(m.end_date)}</>}
          </div>
        )}
      </div>

      {isAttente && (
        <div className="pl-11">
          <p className="text-xs text-amber-700 leading-relaxed">
            Votre déclaration est en attente de validation par l'organisme.
            Vous serez notifié(e) dès qu'elle sera traitée.
          </p>
        </div>
      )}
      {m.statut === 'refuse' && (
        <div className="pl-11 space-y-3">
          {m.motif_refus ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50">
              <AlertCircle className="w-3.5 h-3.5 text-[var(--sw-danger)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--sw-danger)] leading-relaxed">
                <span className="font-semibold">Motif : </span>{m.motif_refus}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--sw-danger)]">
              Adhésion non confirmée. Contactez votre organisme pour plus d'informations.
            </p>
          )}
          <RenvoyerForm
            adherentId={m.id}
            defaultMemberNumber={m.member_number}
            defaultEmployerName={m.employer_name}
            defaultStartDate={m.start_date}
            defaultEndDate={m.end_date}
            showEmployer={m.organismes_couverture?.org_type === 'ipm'}
          />
        </div>
      )}
    </div>
  )
}
