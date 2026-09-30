import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  Calendar, FileText, Pill, Shield, Bell, Users,
  Video, Package, BarChart3, CreditCard, FileCheck, Network,
  ArrowRight, Check
} from 'lucide-react'

export const metadata = {
  title: 'Fonctionnalités — Séné Wérr',
  description: 'Découvrez toutes les fonctionnalités de Séné Wérr : rendez-vous, ordonnances, médicaments, couverture santé, téléconsultation et plus encore.',
}

const categories = [
  {
    label: 'Pour les patients',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
    border: 'border-[var(--sw-primary-muted)]',
    href: '/patients',
    cta: 'Créer un compte patient',
    ctaHref: '/inscription?profil=patient',
    badge: '100 % Gratuit',
    badgeColor: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
    features: [
      { icon: Calendar, title: 'Rendez-vous en ligne', desc: 'Réservez un créneau chez un médecin ou spécialiste disponible, recevez une confirmation et un rappel automatique.' },
      { icon: FileText, title: 'Ordonnances numériques', desc: 'Toutes vos ordonnances sont archivées. Consultez-les, partagez-les avec votre pharmacie en un clic.' },
      { icon: Pill, title: 'Réservation de médicaments', desc: 'Cherchez un médicament, vérifiez sa disponibilité en pharmacie et réservez-le à distance.' },
      { icon: Shield, title: 'Couverture et prises en charge', desc: 'Déclarez votre mutuelle, suivez vos prises en charge et votre reste à charge en temps réel.' },
      { icon: Bell, title: 'Rappels et notifications', desc: 'Rappels de rendez-vous, statut de réservation, confirmations de prise en charge — tout en temps réel.' },
      { icon: Users, title: 'Espace famille', desc: 'Gérez la santé de vos proches (enfants, parents, conjoint) depuis votre compte, avec des dossiers séparés.' },
    ],
  },
  {
    label: 'Pour les professionnels & établissements',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
    border: 'border-blue-100',
    href: '/professionnels',
    cta: 'Créer un espace professionnel',
    ctaHref: '/inscription?profil=sante',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    features: [
      { icon: Calendar, title: 'Agenda intelligent', desc: 'Gérez vos créneaux, recevez des demandes de rendez-vous en ligne et évitez les doublons automatiquement.' },
      { icon: Video, title: 'Téléconsultation intégrée', desc: 'Proposez des consultations à distance sécurisées depuis votre espace, sans outil tiers.' },
      { icon: FileText, title: 'Ordonnances numériques', desc: 'Rédigez et transmettez vos ordonnances directement au patient et à sa pharmacie. Traçabilité complète.' },
      { icon: Users, title: 'Dossiers patients centralisés', desc: 'Historique complet de chaque patient : consultations, ordonnances, examens, résultats et notes.' },
      { icon: Shield, title: 'Prises en charge automatiques', desc: 'Les demandes sont transmises à la mutuelle du patient automatiquement. Moins de paperasse, paiements plus rapides.' },
      { icon: BarChart3, title: 'Statistiques d\'activité', desc: 'Consultations, revenus, patients actifs, délais — pilotez votre cabinet avec des données fiables.' },
    ],
  },
  {
    label: 'Pour les pharmacies',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
    border: 'border-green-100',
    href: '/pharmacies',
    cta: 'Rejoindre en tant que pharmacie',
    ctaHref: '/inscription?profil=pharmacie',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    features: [
      { icon: Package, title: 'Catalogue et gestion du stock', desc: 'Publiez vos médicaments, mettez à jour les stocks en temps réel et recevez des alertes de rupture.' },
      { icon: Calendar, title: 'Réservations automatiques', desc: 'Recevez les commandes des patients directement. Confirmez, préparez et délivrez avec un code de retrait.' },
      { icon: FileText, title: 'Ordonnances numériques', desc: 'Vérifiez l\'authenticité des ordonnances émises par les médecins du réseau et délivrez en sécurité.' },
      { icon: Shield, title: 'Prises en charge mutuelles', desc: 'Les demandes arrivent directement depuis la plateforme. Traitez-les sans paperasse.' },
      { icon: BarChart3, title: 'Tableaux de bord et rapports', desc: 'Analysez vos ventes, médicaments les plus demandés et performances mensuelles.' },
      { icon: CreditCard, title: 'Paiements intégrés', desc: 'Acceptez Orange Money, Wave et carte. Reversements automatiques chaque mois.' },
    ],
  },
  {
    label: 'Pour les mutuelles, IPM & assurances',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    href: '/mutuelles',
    cta: 'Rejoindre en tant qu\'organisme',
    ctaHref: '/inscription?profil=couverture',
    badge: 'Abonnement',
    badgeColor: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
    features: [
      { icon: Users, title: 'Gestion des adhérents', desc: 'Centralisez adhérents et bénéficiaires, gérez les contrats et niveaux de couverture.' },
      { icon: FileCheck, title: 'Prises en charge automatisées', desc: 'Les demandes arrivent structurées depuis les prestataires. Approuvez ou refusez en un clic.' },
      { icon: CreditCard, title: 'Remboursements directs', desc: 'Effectuez vos remboursements via Orange Money, Wave ou virement. Tout est tracé et auditable.' },
      { icon: BarChart3, title: 'Pilotage des dépenses', desc: 'Analyses par acte, prestataire, pathologie et période. Détectez les anomalies rapidement.' },
      { icon: Network, title: 'Réseau de prestataires', desc: 'Accédez au réseau de pharmacies et professionnels connectés. Proposez des soins sans avance de frais.' },
      { icon: Shield, title: 'Contrôle des règles métier', desc: 'Définissez plafonds, taux et exclusions. La plateforme les applique automatiquement.' },
    ],
  },
]

export default function FonctionnalitesPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-16 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-primary-subtle)] to-[var(--sw-surface)]">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Fonctionnalités</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight">
            Tout ce que fait<br />
            <span className="text-[var(--sw-primary)]">Séné Wérr.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto">
            Une plateforme unifiée pour les quatre acteurs de santé au Sénégal.
            Chaque espace est conçu pour les besoins spécifiques de son utilisateur.
          </p>
        </div>
      </section>

      {/* ── Catégories ── */}
      {categories.map(({ label, color, bg, border, href, cta, ctaHref, badge, badgeColor, features }) => (
        <section key={label} className="py-16 px-4 sm:px-6 border-t border-[var(--sw-line)] first:border-t-0">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className={`text-2xl font-bold text-[var(--sw-ink)]`}>{label}</h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                </div>
              </div>
              <Link href={ctaHref}>
                <Button size="sm" className="shrink-0">
                  {cta} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className={`p-5 rounded-xl border ${border} bg-[var(--sw-surface)] space-y-3`}>
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4.5 h-4.5 ${color}`} size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-[var(--sw-ink)] text-sm">{title}</h3>
                    <p className="text-xs text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── CTA Final ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">
            Prêt à commencer ?
          </h2>
          <p className="text-white/80 text-lg">
            Créez votre compte en 2 minutes et accédez immédiatement à tous les services Séné Wérr.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon compte gratuitement
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
