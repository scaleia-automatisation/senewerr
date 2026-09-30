import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  Users, Shield, BarChart3, CreditCard, FileCheck, Network,
  ArrowRight, Check, Star, TrendingDown, Clock, Building,
  AlertCircle, FileText, Zap
} from 'lucide-react'
import { ActorImage } from '@/components/ui/sw-image'

export const metadata = {
  title: 'Espace Mutuelle, IPM & Assurance santé',
  description: 'Gérez vos adhérents, automatisez les prises en charge et pilotez vos dépenses santé sur Séné Wérr.',
}

const features = [
  {
    icon: Users,
    title: 'Gestion des adhérents',
    desc: 'Centralisez tous vos adhérents et leurs bénéficiaires. Suivez les contrats, niveaux de couverture et statuts d\'adhésion en temps réel.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: FileCheck,
    title: 'Prises en charge automatisées',
    desc: 'Les demandes de prise en charge arrivent directement depuis les pharmacies et professionnels de santé. Approuvez, refusez ou questionnez en un clic.',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
  },
  {
    icon: CreditCard,
    title: 'Paiements et remboursements',
    desc: 'Effectuez vos remboursements directement via la plateforme (Orange Money, Wave, virement). Tout est tracé et auditable.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
  {
    icon: BarChart3,
    title: 'Rapports et statistiques',
    desc: 'Analysez vos dépenses par acte, par prestataire, par pathologie et par période. Détectez les dérives et optimisez vos remboursements.',
    color: 'text-[var(--sw-warning)]',
    bg: 'bg-[var(--sw-warning-bg)]',
  },
  {
    icon: Network,
    title: 'Réseau de prestataires',
    desc: 'Accédez au réseau de pharmacies et professionnels de santé connectés. Négociez des tarifs préférentiels et proposez des soins sans avance de frais.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: Shield,
    title: 'Contrôle des dépenses',
    desc: 'Définissez des plafonds, des taux de remboursement et des règles métier. La plateforme applique vos paramètres automatiquement à chaque demande.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
]

const problems = [
  {
    icon: AlertCircle,
    title: 'Gestion manuelle des dossiers',
    desc: 'Chaque demande de remboursement génère des échanges d\'e-mails, de formulaires et de pièces jointes qui ralentissent le traitement.',
  },
  {
    icon: FileText,
    title: 'Fraudes et anomalies non détectées',
    desc: 'Sans outil de pilotage, les abus et les erreurs de facturation sont difficiles à identifier et à corriger à temps.',
  },
  {
    icon: TrendingDown,
    title: 'Adhérents mécontents',
    desc: 'Des délais de remboursement trop longs et une communication floue nuisent à la satisfaction et à la fidélisation de vos adhérents.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Créez votre espace organisme',
    desc: 'Renseignez les informations de votre mutuelle ou assurance, importez vos adhérents et configurez vos niveaux de couverture.',
  },
  {
    n: '2',
    title: 'Paramétrez vos règles de remboursement',
    desc: 'Définissez vos taux, plafonds, exclusions et délais de traitement. La plateforme applique vos règles automatiquement à chaque demande.',
  },
  {
    n: '3',
    title: 'Pilotez vos dépenses en temps réel',
    desc: 'Suivez vos remboursements, détectez les anomalies et consultez vos tableaux de bord depuis votre espace administrateur.',
  },
]

const stats = [
  { value: '-60%', label: 'De temps de traitement' },
  { value: '100%', label: 'Des demandes tracées' },
  { value: '24 h', label: 'Délai de remboursement moyen' },
  { value: '0 €', label: 'De frais d\'intégration' },
]

const avantages = [
  {
    title: 'Sans avance de frais pour vos adhérents',
    desc: "Vos adhérents n'ont plus besoin d'avancer les frais dans les pharmacies et cabinets connectés au réseau. La prise en charge est immédiate.",
  },
  {
    title: "Réduction des fraudes à l'ordonnance",
    desc: 'Toutes les ordonnances sont émises numériquement par les médecins. Impossible de les falsifier ou de les utiliser plusieurs fois.',
  },
  {
    title: 'Intégration avec vos systèmes existants',
    desc: 'Séné Wérr propose une API pour intégrer les prises en charge avec votre logiciel de gestion interne.',
  },
  {
    title: 'Conformité et auditabilité',
    desc: 'Chaque acte, chaque remboursement, chaque décision est horodaté et tracé. Vos audits internes et externes sont simplifiés.',
  },
]

export default function MutuellesPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-4 sm:px-6 bg-gradient-to-b from-purple-50 to-[var(--sw-surface)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white border border-purple-200 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
            <Shield className="w-4 h-4" />
            Mutuelles, IPM & Assurances santé
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight tracking-tight">
            Automatisez vos prises en charge<br />
            <span className="text-[var(--sw-primary)]">et pilotez vos dépenses santé.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
            Séné Wérr connecte votre organisme au réseau de pharmacies et professionnels de santé
            du Sénégal. Traitez les demandes automatiquement, remboursez en 24 h et réduisez vos coûts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/inscription?profil=couverture">
              <Button size="xl" className="w-full sm:w-auto">
                Rejoindre le réseau
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Parler à l'équipe
              </Button>
            </Link>
          </div>
          <p className="text-sm text-[var(--sw-ink-3)]">
            Intégration en moins d'une semaine · Sans frais d'installation · API disponible
          </p>
        </div>
        <div className="mt-14 max-w-5xl mx-auto">
          <ActorImage
            src="https://images.unsplash.com/photo-1573164574511-73c773193279?w=1400&h=800&fit=crop&q=80"
            alt="Équipe africaine en réunion de travail sur la gestion de couverture santé"
            className="w-full aspect-[16/7]"
          />
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-14 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-white">{value}</p>
                <p className="text-sm text-white/70 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problèmes ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Le défi</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              La gestion manuelle des prises en charge coûte cher et génère de la frustration.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Séné Wérr résout les trois problèmes majeurs des organismes de couverture santé.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {problems.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="sw-card p-6 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--sw-danger-bg)] flex items-center justify-center mx-auto">
                  <Icon className="w-6 h-6 text-[var(--sw-danger)]" />
                </div>
                <h3 className="font-semibold text-[var(--sw-ink)]">{title}</h3>
                <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Ce que vous obtenez</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Une plateforme de gestion complète pour les organismes de couverture.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Tout ce dont vous avez besoin pour gérer vos adhérents, automatiser vos remboursements
              et piloter vos dépenses de santé.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="sw-card p-6 space-y-4">
                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-[var(--sw-ink)]">{title}</h3>
                  <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Intégration</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">Connecté en 3 étapes.</h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Notre équipe vous accompagne pour une intégration complète en moins d'une semaine.
            </p>
          </div>
          <div className="space-y-8">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="flex gap-5 items-start">
                <div className="shrink-0 w-11 h-11 rounded-full bg-[var(--sw-primary)] text-white flex items-center justify-center font-bold text-lg shadow-md">
                  {n}
                </div>
                <div className="space-y-1.5 pt-1.5">
                  <h3 className="font-semibold text-[var(--sw-ink)] text-lg">{title}</h3>
                  <p className="text-[var(--sw-ink-2)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avantages clés ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Pourquoi Séné Wérr</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Des avantages concrets pour votre organisation.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {avantages.map(({ title, desc }) => (
              <div key={title} className="sw-card p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-[var(--sw-primary)]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[var(--sw-ink)]">{title}</h3>
                    <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Conformité ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Conformité</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Conforme aux exigences de régulation sénégalaise.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Séné Wérr est conçu pour respecter les contraintes réglementaires des organismes
              de couverture santé au Sénégal.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Données hébergées au Sénégal ou dans des datacenters certifiés',
              'Traçabilité complète de chaque acte et chaque remboursement',
              'Contrôle d\'accès par rôle : gestionnaires, superviseurs, auditeurs',
              'Export des données pour vos audits internes et déclarations réglementaires',
              'Signature numérique des ordonnances par les professionnels certifiés',
              'Journaux d\'activité horodatés et immuables',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)]">
                <Check className="w-5 h-5 text-[var(--sw-success)] shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--sw-ink-2)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Building className="w-10 h-10 text-white/60 mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Rejoignez le réseau de couverture santé numérique du Sénégal.
          </h2>
          <p className="text-white/80 text-lg">
            Intégration gratuite. Remboursements en 24 h. Réduction garantie de vos coûts de gestion.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription?profil=couverture">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon espace organisme
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Discuter avec l'équipe
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
