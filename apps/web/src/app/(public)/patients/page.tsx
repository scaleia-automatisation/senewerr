import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  Calendar, FileText, Pill, Shield, Bell, Users,
  ArrowRight, Check, ChevronRight, Star, Clock, Heart,
  Smartphone, Lock, Zap
} from 'lucide-react'
import { ActorImage } from '@/components/ui/sw-image'

export const metadata = {
  title: 'Espace Patient — Gratuit',
  description: 'Gérez vos rendez-vous, ordonnances, médicaments et couverture santé depuis un seul espace. 100 % gratuit pour les patients.',
}

const features = [
  {
    icon: Calendar,
    title: 'Rendez-vous en ligne',
    desc: 'Trouvez un médecin ou spécialiste disponible, choisissez votre créneau et recevez une confirmation instantanée.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: FileText,
    title: 'Ordonnances numériques',
    desc: 'Vos ordonnances sont archivées automatiquement après chaque consultation. Partagez-les en un clic avec votre pharmacie.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
  {
    icon: Pill,
    title: 'Réservation de médicaments',
    desc: 'Recherchez un médicament, vérifiez sa disponibilité en pharmacie et réservez-le pour le retirer quand vous voulez.',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
  },
  {
    icon: Shield,
    title: 'Couverture et prises en charge',
    desc: 'Renseignez votre mutuelle ou assurance. Les demandes de prise en charge sont transmises automatiquement à chaque soin.',
    color: 'text-[var(--sw-warning)]',
    bg: 'bg-[var(--sw-warning-bg)]',
  },
  {
    icon: Bell,
    title: 'Rappels et notifications',
    desc: 'Ne manquez plus jamais un rendez-vous. Recevez des rappels 24 h avant et des alertes sur l\'état de vos réservations.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: Users,
    title: 'Espace famille',
    desc: 'Gérez la santé de vos proches depuis votre compte : enfants, parents, conjoint. Dossiers séparés, accès unifié.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
]

const problems = [
  {
    icon: FileText,
    title: 'Ordonnances perdues',
    desc: 'Vos ordonnances papier s\'accumulent ou disparaissent, rendant impossible le suivi de vos traitements.',
  },
  {
    icon: Pill,
    title: 'Médicaments introuvables',
    desc: 'Vérifier la disponibilité d\'un médicament nécessite plusieurs appels ou déplacements en pharmacie.',
  },
  {
    icon: Shield,
    title: 'Remboursements flous',
    desc: 'Difficile de savoir ce que votre mutuelle couvre, de suivre vos demandes et de connaître votre reste à charge.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Créez votre compte en 2 minutes',
    desc: 'Inscrivez-vous avec votre numéro de téléphone sénégalais. Aucune carte bancaire, aucun formulaire complexe.',
  },
  {
    n: '2',
    title: 'Complétez votre profil de santé',
    desc: 'Ajoutez vos informations médicales de base, votre couverture santé et vos bénéficiaires. Tout reste privé.',
  },
  {
    n: '3',
    title: 'Accédez à tous vos services',
    desc: 'Prenez rendez-vous, consultez vos ordonnances, réservez vos médicaments et suivez vos prises en charge.',
  },
]

const testimonials = [
  {
    name: 'Aminata D.',
    role: 'Employée de bureau, Dakar',
    text: 'Avant, je gardais mes ordonnances dans un sac. Maintenant tout est dans mon téléphone. Je peux réserver mes médicaments avant même de quitter le cabinet du médecin.',
    stars: 5,
  },
  {
    name: 'Moussa K.',
    role: 'Chef de famille, Thiès',
    text: 'Je gère la santé de mes 3 enfants et de ma femme depuis un seul compte. Les rappels de rendez-vous m\'ont sauvé plusieurs fois.',
    stars: 5,
  },
  {
    name: 'Fatou B.',
    role: 'Infirmière, Saint-Louis',
    text: 'Même en tant que professionnelle de santé, j\'utilise Séné Wérr pour ma propre santé. La réservation de médicaments est vraiment pratique.',
    stars: 5,
  },
]

export default function PatientsPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-primary-subtle)] to-[var(--sw-surface)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white border border-[var(--sw-primary-muted)] text-[var(--sw-primary)] px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[var(--sw-primary)] animate-pulse" />
            100 % gratuit pour les patients
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight tracking-tight">
            Votre santé,<br />
            <span className="text-[var(--sw-primary)]">organisée dans votre téléphone.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
            Rendez-vous, ordonnances, médicaments, couverture santé — tout en un seul endroit,
            accessible depuis n'importe quel appareil, sans frais.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/inscription?profil=patient">
              <Button size="xl" className="w-full sm:w-auto">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/comment-ca-marche#patient">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Comment ça marche
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            {[
              { icon: Lock, label: 'Données sécurisées' },
              { icon: Smartphone, label: 'Accès mobile' },
              { icon: Zap, label: 'Accès immédiat' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-[var(--sw-ink-2)]">
                <Icon className="w-4 h-4 text-[var(--sw-primary)]" />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 max-w-5xl mx-auto">
          <ActorImage
            src="https://images.unsplash.com/photo-1613186187553-0efb12fa0c90?w=1400&h=800&fit=crop&q=80"
            alt="Femme africaine consultant ses services de santé sur son smartphone"
            className="w-full aspect-[16/7]"
          />
        </div>
      </section>

      {/* ── Problèmes ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Le problème</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Gérer sa santé au Sénégal est souvent compliqué.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Entre les ordonnances papier, les médicaments épuisés et les remboursements opaques,
              le suivi de votre santé vous prend un temps précieux.
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
              Tout ce dont vous avez besoin, enfin réuni.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Six services de santé essentiels dans un seul espace, gratuit et accessible en 2 minutes.
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
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Démarrer</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">Prêt en 3 étapes.</h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Aucune paperasse. Votre compte patient est opérationnel en moins de 5 minutes.
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
          <div className="text-center">
            <Link href="/inscription?profil=patient">
              <Button size="lg">
                Créer mon compte maintenant
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Témoignages ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Ils témoignent</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Des milliers de patients font confiance à Séné Wérr.
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, stars }) => (
              <div key={name} className="sw-card p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[var(--sw-warning)] text-[var(--sw-warning)]" />
                  ))}
                </div>
                <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed italic">"{text}"</p>
                <div>
                  <p className="font-semibold text-sm text-[var(--sw-ink)]">{name}</p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sécurité ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Confidentialité</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Vos données médicales vous appartiennent.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Chez Séné Wérr, vos informations de santé ne sont jamais vendues ni partagées sans votre accord explicite.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Chiffrement de bout en bout de toutes vos données médicales',
              'Accès contrôlé : seuls les professionnels que vous choisissez peuvent consulter votre dossier',
              'Zéro revente de données personnelles ou de santé',
              'Traçabilité complète de chaque accès à vos informations',
              'Connexion sécurisée avec vérification par téléphone',
              'Partage de documents uniquement avec votre accord explicite',
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
          <div className="flex justify-center">
            <Heart className="w-10 h-10 text-white/60" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Prenez le contrôle de votre santé.
          </h2>
          <p className="text-white/80 text-lg">
            Rejoignez des milliers de patients sénégalais qui gèrent leur santé simplement.
            Gratuit, sans carte bancaire, pour toujours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/inscription?profil=patient">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon compte patient
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/comment-ca-marche#patient">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Comment ça marche
              </Button>
            </Link>
          </div>
          <p className="text-white/60 text-sm">Gratuit · Sans carte bancaire · Accès immédiat</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
