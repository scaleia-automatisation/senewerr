import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Building2, Plus, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:    { label: 'En attente',  className: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]' },
  accepted:   { label: 'Accepté',    className: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' },
  refused:    { label: 'Refusé',     className: 'bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)]' },
  terminated: { label: 'Terminé',    className: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]' },
}

const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  case_sante:          'Case de santé',
  poste_sante:         'Poste de santé',
  centre_sante_cs1:    'Centre de santé CS1',
  centre_sante_cs2:    'Centre de santé CS2',
  hopital_eps1:        'Hôpital EPS1',
  hopital_eps2:        'Hôpital EPS2',
  hopital_eps3:        'Hôpital EPS3',
  clinique:            'Clinique',
  cabinet_medical:     'Cabinet médical',
  cabinet_paramedical: 'Cabinet paramédical',
  poste_sante_prive:   'Poste de santé privé',
  structure_entreprise:"Structure d'entreprise",
  dispensaire_prive:   'Dispensaire privé',
  laboratoire:         "Laboratoire d'analyses",
  centre_radiologie:   'Centre de radiologie',
  centre_sante_mentale:'Centre de santé mentale',
  centre_reeducation:  'Centre de rééducation',
  centre_transfusion:  'Centre de transfusion sanguine',
  autre_specialise:    'Autre structure spécialisée',
}

interface Attachment {
  id: string
  status: string
  function: string | null
  start_date: string | null
  establishment: {
    id: string
    name: string
    establishment_type: string
    address_region: string
    address_commune: string | null
  } | null
}

export default async function EtablissementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/etablissements')

  const { data: professionalData } = await supabase
    .from('professionnels')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()
  const professional = professionalData as unknown as { id: string } | null

  const { data: establishmentData } = await supabase
    .from('etablissements')
    .select('id, name, establishment_type, address_region, address_commune')
    .eq('profile_id', user.id)
    .maybeSingle()
  const ownEstablishment = establishmentData as unknown as {
    id: string; name: string; establishment_type: string; address_region: string; address_commune: string | null
  } | null

  let attachments: Attachment[] = []
  if (professional) {
    const { data: attachData } = await supabase
      .from('establishment_professionals')
      .select(`
        id,
        status,
        function,
        start_date,
        establishment:establishments (
          id,
          name,
          establishment_type,
          address_region,
          address_commune
        )
      `)
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false })

    attachments = (attachData ?? []) as unknown as Attachment[]
  }

  let associatedProfessionals: { id: string; status: string; function: string | null; professional: { id: string; professional_type: string; profiles: { first_name: string; last_name: string } | null } | null }[] = []
  if (ownEstablishment) {
    const { data: proData } = await supabase
      .from('establishment_professionals')
      .select(`
        id,
        status,
        function,
        professional:professionals (
          id,
          professional_type,
          profiles!inner(first_name, last_name)
        )
      `)
      .eq('establishment_id', ownEstablishment.id)
      .order('created_at', { ascending: false })

    associatedProfessionals = (proData ?? []) as unknown as typeof associatedProfessionals
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Établissements</h1>
          <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
            {ownEstablishment ? 'Gérez les professionnels rattachés à votre établissement' : 'Vos rattachements à des établissements de santé'}
          </p>
        </div>
        {professional && (
          <Link href="/sante/etablissements/rejoindre">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Rejoindre un établissement
            </Button>
          </Link>
        )}
      </div>

      {/* Section : établissement propre (si l'utilisateur représente un établissement) */}
      {ownEstablishment && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Mon établissement</h2>
          <div className="sw-card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[var(--sw-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--sw-ink)]">{ownEstablishment.name}</p>
              <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
                {ESTABLISHMENT_TYPE_LABELS[ownEstablishment.establishment_type] ?? ownEstablishment.establishment_type}
                {' · '}
                {ownEstablishment.address_commune ?? ownEstablishment.address_region}
              </p>
            </div>
          </div>

          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mt-4">
            Professionnels rattachés ({associatedProfessionals.length})
          </h2>
          {associatedProfessionals.length === 0 ? (
            <div className="sw-card p-8 text-center">
              <Building2 className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
              <p className="text-sm text-[var(--sw-ink-2)]">Aucun professionnel rattaché pour l&apos;instant.</p>
              <p className="text-xs text-[var(--sw-ink-3)] mt-1">Les demandes de rattachement apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {associatedProfessionals.map(ap => {
                const pro = ap.professional
                const fullName = pro?.profiles
                  ? `${pro.profiles.first_name} ${pro.profiles.last_name}`.trim()
                  : 'Professionnel inconnu'
                const status = STATUS_LABELS[ap.status] ?? { label: ap.status, className: '' }
                return (
                  <div key={ap.id} className="sw-card p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-[var(--sw-ink-2)]">
                        {fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{fullName}</p>
                      {ap.function && <p className="text-xs text-[var(--sw-ink-3)]">{ap.function}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Section : rattachements (pour un professionnel indépendant) */}
      {professional && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">
            Mes rattachements ({attachments.length})
          </h2>

          {attachments.length === 0 ? (
            <div className="sw-card p-10 text-center space-y-3">
              <Building2 className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto" />
              <div>
                <p className="font-medium text-[var(--sw-ink)]">Aucun rattachement</p>
                <p className="text-sm text-[var(--sw-ink-2)] mt-1">
                  Vous pouvez exercer dans plusieurs établissements tout en conservant un seul agenda.
                </p>
              </div>
              <Link href="/sante/etablissements/rejoindre">
                <Button size="sm" className="mt-2">
                  <Plus className="w-4 h-4 mr-1" />
                  Rejoindre un établissement
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {attachments.map(att => {
                const est = att.establishment
                const status = STATUS_LABELS[att.status] ?? { label: att.status, className: '' }
                const StatusIcon = att.status === 'accepted' ? CheckCircle2 : att.status === 'refused' ? XCircle : Clock
                return (
                  <div key={att.id} className="sw-card p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-[var(--sw-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--sw-ink)] truncate">
                        {est?.name ?? 'Établissement inconnu'}
                      </p>
                      {est && (
                        <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
                          {ESTABLISHMENT_TYPE_LABELS[est.establishment_type] ?? est.establishment_type}
                          {' · '}
                          {est.address_commune ?? est.address_region}
                        </p>
                      )}
                      {att.function && (
                        <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">Fonction : {att.function}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${status.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!professional && !ownEstablishment && (
        <div className="sw-card p-8 text-center">
          <p className="text-sm text-[var(--sw-ink-2)]">
            Profil non configuré.{' '}
            <Link href="/sante/onboarding" className="text-[var(--sw-primary)] hover:underline">
              Compléter mon profil
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
