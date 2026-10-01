// Spec 27.3 — Consentement et partage : le patient comprend ce qu'il partage et avec qui
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/security/audit'
import { ShieldCheck, Eye, FileText, AlertTriangle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Confidentialité — Patient' }

type Consent = {
  id: string; consent_type: string; accepted: boolean; accepted_at: string
}

const CONSENT_DESCRIPTIONS: Record<string, { label: string; with_whom: string; purpose: string; revocable: boolean }> = {
  data_processing: {
    label: 'Traitement de mes données de santé',
    with_whom: 'Séné Wérr (plateforme)',
    purpose: 'Fonctionnement du dossier médical numérique',
    revocable: false, // obligatoire pour utiliser le service
  },
  professional_access: {
    label: 'Accès de mes professionnels de santé',
    with_whom: 'Professionnels de santé que je consulte',
    purpose: 'Consultation de mon dossier lors des rendez-vous',
    revocable: true,
  },
  pharmacy_prescription: {
    label: "Partage d'ordonnances avec les pharmacies",
    with_whom: 'Pharmacie de mon choix',
    purpose: 'Préparation et délivrance de médicaments',
    revocable: true,
  },
  coverage_sharing: {
    label: 'Transmission à mon organisme de couverture',
    with_whom: 'Mutuelle / IPM / Assurance',
    purpose: 'Prise en charge et remboursement',
    revocable: true,
  },
  reminder_contact: {
    label: 'Rappels par SMS / WhatsApp',
    with_whom: 'Prestataires de messagerie (Orange, Wave…)',
    purpose: 'Rappels de rendez-vous et retraits',
    revocable: true,
  },
}

async function withdrawConsent(formData: FormData) {
  'use server'
  const consentId = formData.get('consent_id') as string
  const consentType = formData.get('consent_type') as string
  if (!consentId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  type UpdateFn = {
    update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> }
  }
  await (supabase.from('consentements') as unknown as UpdateFn)
    .update({ accepted: false })
    .eq('id', consentId)

  // Spec 27.4 — journaliser le retrait
  await logAudit({
    action: 'consent.withdrawn',
    result: 'success',
    object_type: 'consent',
    object_id: consentId,
    category: 'consentements',
    metadata: { consent_type: consentType },
  })

  revalidatePath('/patient/confidentialite')
}

export default async function ConfidentialitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  type FetchFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => Promise<{ data: unknown[] | null }>
    }
  }
  const { data: consentsData } = await (supabase.from('consentements') as unknown as FetchFn)
    .select('id, consent_type, accepted, accepted_at')
    .eq('patient_id', patient.id)

  const consents = (consentsData ?? []) as unknown as Consent[]
  const consentMap: Record<string, Consent> = {}
  for (const c of consents) consentMap[c.consent_type] = c

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Confidentialité</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 27.3 — consentements et partage de données</p>
      </div>

      {/* Intro spec 27.3 */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
        <ShieldCheck className="w-4 h-4 text-[var(--sw-primary)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-[var(--sw-primary)]">
          Vous choisissez ce que vous partagez et avec qui. Les partages sont limités à l'objectif concerné (spec 27.3).
        </p>
      </div>

      {/* Consentements */}
      <div className="space-y-3">
        {Object.entries(CONSENT_DESCRIPTIONS).map(([type, info]) => {
          const consent = consentMap[type]
          const isActive = consent?.accepted ?? false

          return (
            <div key={type} className="sw-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{info.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Eye className="w-3 h-3 text-[var(--sw-ink-3)]" aria-hidden="true" />
                    <span className="text-xs text-[var(--sw-ink-3)]">{info.with_whom}</span>
                  </div>
                  <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{info.purpose}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-lg font-medium ${isActive
                    ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]'
                    : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'
                  }`}
                  aria-label={`Consentement ${isActive ? 'actif' : 'retiré'}`}
                >
                  {isActive ? 'Actif' : 'Retiré'}
                </span>
              </div>

              {consent?.accepted_at && (
                <p className="text-xs text-[var(--sw-ink-3)]">
                  {isActive ? 'Accordé' : 'Retiré'} le{' '}
                  {new Date(consent.accepted_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* Spec 27.3 : retrait possible si consent_type revocable */}
              {info.revocable && isActive && consent && (
                <form action={withdrawConsent}>
                  <input type="hidden" name="consent_id" value={consent.id} />
                  <input type="hidden" name="consent_type" value={type} />
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 rounded-xl border border-[var(--sw-danger)] text-[var(--sw-danger)] hover:bg-red-50 transition-colors"
                    aria-label={`Retirer le consentement : ${info.label}`}
                  >
                    Retirer ce consentement
                  </button>
                </form>
              )}

              {!info.revocable && (
                <p className="text-xs text-[var(--sw-ink-3)] italic">
                  Obligatoire pour utiliser le service.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Note légale spec 27.3 */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-warning-bg)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs text-[var(--sw-warning)] font-medium">Important</p>
          <p className="text-xs text-[var(--sw-warning)]">
            Le retrait d'un consentement empêche les nouveaux accès qui en dépendent.
            Les données déjà transmises dans le cadre d'obligations légales ou de traitements autorisés par la loi
            ne peuvent pas être supprimées rétroactivement (spec 27.3).
          </p>
        </div>
      </div>

      {/* Ordonnances partagées */}
      <div className="sw-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Partages d'ordonnances</h2>
        </div>
        <p className="text-xs text-[var(--sw-ink-2)]">
          Chaque partage d'ordonnance est limité à la pharmacie désignée et à l'objectif de délivrance.
          Le lien de partage expire automatiquement après utilisation ou à la date d'expiration de l'ordonnance.
        </p>
        <a href="/patient/ordonnances" className="text-xs font-medium text-[var(--sw-primary)]">
          Voir mes ordonnances →
        </a>
      </div>

      {/* Conformité CDPD spec 27.5 */}
      <p className="text-xs text-[var(--sw-ink-3)]">
        La gestion de vos données personnelles est soumise à la Commission de protection des données personnelles
        du Sénégal (CDPD). Pour exercer vos droits (accès, rectification, suppression), contactez le support Séné Wérr.
      </p>
    </div>
  )
}
