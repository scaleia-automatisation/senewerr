import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  UserPlus, Smartphone, Calendar, Pill, Shield, FileText,
  ArrowRight, ChevronRight, Package, Users, BarChart3
} from 'lucide-react'

export const metadata = {
  title: 'Comment ça marche — Séné Wérr',
  description: 'Découvrez comment fonctionne Séné Wérr pour les patients, professionnels, pharmacies et mutuelles.',
}

const actors = [
  {
    id: 'patient',
    label: 'Patient',
    badge: 'Gratuit',
    badgeColor: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
    color: 'text-[var(--sw-primary)]',
    accent: 'bg-[var(--sw-primary)]',
    ctaHref: '/inscription?profil=patient',
    cta: 'Créer mon compte patient',
    steps: [
      {
        icon: UserPlus,
        title: 'Créez votre compte gratuit',
        desc: 'Inscrivez-vous avec votre numéro de téléphone sénégalais. Choisissez un mot de passe. Aucune carte bancaire requise. Accès immédiat.',
        detail: '~2 minutes',
      },
      {
        icon: Smartphone,
        title: 'Complétez votre profil de santé',
        desc: 'Renseignez votre date de naissance, groupe sanguin et antécédents. Ajoutez votre mutuelle ou assurance santé. Ajoutez vos bénéficiaires (famille).',
        detail: '~5 minutes',
      },
      {
        icon: Calendar,
        title: 'Prenez un rendez-vous',
        desc: 'Cherchez un médecin ou spécialiste par spécialité ou localisation. Sélectionnez un créneau disponible. Recevez une confirmation et un rappel.',
        detail: 'En 3 clics',
      },
      {
        icon: Pill,
        title: 'Réservez vos médicaments',
        desc: 'Cherchez le médicament par nom ou DCI. Sélectionnez une pharmacie qui l\'a en stock. Confirmez la réservation. Retirez avec votre code.',
        detail: 'Disponible 24/7',
      },
      {
        icon: Shield,
        title: 'Suivez vos prises en charge',
        desc: 'Lors de chaque soin ou réservation, votre mutuelle est notifiée automatiquement. Vous suivez l\'état de votre remboursement en temps réel.',
        detail: 'Automatique',
      },
      {
        icon: FileText,
        title: 'Consultez vos ordonnances',
        desc: 'Après chaque consultation, votre médecin émet votre ordonnance numériquement. Elle est disponible dans votre espace et partageable en un clic.',
        detail: 'Toujours accessible',
      },
    ],
  },
  {
    id: 'sante',
    label: 'Professionnel de santé',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    color: 'text-[var(--sw-info)]',
    accent: 'bg-[var(--sw-info)]',
    ctaHref: '/inscription?profil=sante',
    cta: 'Créer mon espace professionnel',
    steps: [
      {
        icon: UserPlus,
        title: 'Créez et vérifiez votre profil',
        desc: 'Renseignez votre spécialité, numéro d\'ordre, localisation et diplômes. Notre équipe vérifie votre profil sous 48 h et le publie sur la plateforme.',
        detail: '48 h de validation',
      },
      {
        icon: Calendar,
        title: 'Configurez votre agenda',
        desc: 'Définissez vos horaires d\'ouverture, la durée de vos consultations et votre tarif. Les patients peuvent immédiatement réserver en ligne.',
        detail: 'Configurable en 10 min',
      },
      {
        icon: FileText,
        title: 'Réalisez vos consultations',
        desc: 'Consultez les dossiers patients, prenez des notes, ordonnancez numériquement. L\'ordonnance est transmise directement au patient et à sa pharmacie.',
        detail: 'Tout en ligne',
      },
      {
        icon: Shield,
        title: 'Gérez les prises en charge',
        desc: 'Pour chaque acte, la prise en charge est transmise automatiquement à la mutuelle du patient. Vous recevez le règlement sans démarche manuelle.',
        detail: 'Automatique',
      },
      {
        icon: BarChart3,
        title: 'Suivez votre activité',
        desc: 'Consultations réalisées, revenus, patients actifs, taux de no-show — pilotez votre cabinet depuis votre tableau de bord.',
        detail: 'Temps réel',
      },
    ],
  },
  {
    id: 'pharmacie',
    label: 'Pharmacie',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    color: 'text-[var(--sw-success)]',
    accent: 'bg-[var(--sw-success)]',
    ctaHref: '/inscription?profil=pharmacie',
    cta: 'Rejoindre en tant que pharmacie',
    steps: [
      {
        icon: UserPlus,
        title: 'Inscrivez votre pharmacie',
        desc: 'Renseignez votre raison sociale, localisation, horaires et numéro d\'autorisation. Votre profil est vérifié et publié sur la carte des pharmacies.',
        detail: 'Validation rapide',
      },
      {
        icon: Package,
        title: 'Publiez votre catalogue',
        desc: 'Importez ou saisissez votre liste de médicaments avec les stocks et prix. Le catalogue est visible des patients en temps réel.',
        detail: 'Import CSV disponible',
      },
      {
        icon: Pill,
        title: 'Recevez et traitez les réservations',
        desc: 'Un patient réserve un médicament → vous recevez une notification → vous confirmez et préparez → vous attribuez un code → le patient retire.',
        detail: 'Flux automatique',
      },
      {
        icon: FileText,
        title: 'Vérifiez les ordonnances',
        desc: 'Les ordonnances numériques arrivent directement avec les réservations. Authentifiées par le médecin, impossibles à falsifier.',
        detail: '100% sécurisé',
      },
      {
        icon: Shield,
        title: 'Traitez les prises en charge',
        desc: 'Pour chaque réservation avec mutuelle, la demande de prise en charge est transmise automatiquement. Vous êtes réglé directement par la plateforme.',
        detail: 'Automatique',
      },
    ],
  },
  {
    id: 'couverture',
    label: 'Mutuelle / IPM / Assurance',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    color: 'text-purple-700',
    accent: 'bg-purple-600',
    ctaHref: '/inscription?profil=couverture',
    cta: 'Rejoindre en tant qu\'organisme',
    steps: [
      {
        icon: UserPlus,
        title: 'Créez votre espace organisme',
        desc: 'Renseignez les informations de votre mutuelle ou assurance. Importez vos adhérents et configurez vos niveaux de couverture par contrat.',
        detail: 'Intégration en < 1 semaine',
      },
      {
        icon: Users,
        title: 'Gérez vos adhérents',
        desc: 'Vos adhérents s\'inscrivent sur Séné Wérr et déclarent votre organisme. Ils apparaissent automatiquement dans votre espace de gestion.',
        detail: 'Synchronisation auto',
      },
      {
        icon: Shield,
        title: 'Recevez et traitez les demandes',
        desc: 'Chaque acte d\'un adhérent génère une demande structurée. Approuvez, refusez ou demandez des justificatifs directement depuis votre tableau de bord.',
        detail: 'Tout centralisé',
      },
      {
        icon: FileText,
        title: 'Effectuez vos remboursements',
        desc: 'Réglez les prestataires et/ou les patients directement via la plateforme (Orange Money, Wave, virement). Tout est tracé.',
        detail: 'Remboursement en 24 h',
      },
      {
        icon: BarChart3,
        title: 'Pilotez vos dépenses',
        desc: 'Analysez vos dépenses par acte, prestataire, pathologie. Détectez les anomalies. Exportez vos données pour vos audits.',
        detail: 'Rapport mensuel auto',
      },
    ],
  },
]

export default function CommentCaMarchePage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-16 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-primary-subtle)] to-[var(--sw-surface)]">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Comment ça marche</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight">
            Simple à comprendre,<br />
            <span className="text-[var(--sw-primary)]">simple à utiliser.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto">
            Séné Wérr connecte quatre acteurs de santé dans un seul système.
            Voici comment ça fonctionne pour chacun d'entre eux.
          </p>
          {/* Ancres rapides */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {actors.map(({ id, label, badge, badgeColor }) => (
              <a key={id} href={`#${id}`} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--sw-line)] text-sm text-[var(--sw-ink-2)] hover:border-[var(--sw-primary)] hover:text-[var(--sw-primary)] transition-colors bg-white">
                {label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sections par acteur ── */}
      {actors.map(({ id, label, badge, badgeColor, color, accent, ctaHref, cta, steps }) => (
        <section key={id} id={id} className="py-20 px-4 sm:px-6 even:bg-[var(--sw-surface-2)]">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-bold text-[var(--sw-ink)]">{label}</h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
              </div>
            </div>

            <div className="space-y-6">
              {steps.map(({ icon: Icon, title, desc, detail }, i) => (
                <div key={title} className="flex gap-5 items-start group">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className={`w-11 h-11 rounded-full ${accent} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-0.5 h-8 bg-[var(--sw-line)]" />
                    )}
                  </div>
                  <div className="sw-card p-5 flex-1 space-y-2 mb-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-[var(--sw-ink)]">{title}</h3>
                      <span className="shrink-0 text-xs text-[var(--sw-ink-3)] bg-[var(--sw-surface-3)] px-2.5 py-1 rounded-full">{detail}</span>
                    </div>
                    <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-4">
              <Link href={ctaHref}>
                <Button size="lg">
                  {cta}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ))}

      {/* ── CTA Final ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">
            Vous avez des questions ?
          </h2>
          <p className="text-white/80 text-lg">
            Consultez notre FAQ ou contactez directement notre équipe.
            Nous répondons dans les 24 h.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon compte
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Nous contacter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
