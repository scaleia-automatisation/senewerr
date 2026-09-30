import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  Package, Calendar, FileText, Shield, BarChart3, CreditCard,
  ArrowRight, Check, Star, TrendingUp, Clock, Users,
  AlertCircle, Pill, Smartphone
} from 'lucide-react'
import { ActorImage } from '@/components/ui/sw-image'

export const metadata = {
  title: 'Espace Pharmacie — Gérez vos réservations en ligne',
  description: 'Rejoignez le réseau Séné Wérr. Recevez des réservations de médicaments en ligne, gérez votre stock et traitez les ordonnances numériques.',
}

const features = [
  {
    icon: Package,
    title: 'Gestion du catalogue et du stock',
    desc: 'Publiez votre catalogue de médicaments, mettez à jour les disponibilités en temps réel et recevez des alertes de rupture de stock.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: Calendar,
    title: 'Réservations en ligne',
    desc: 'Les patients réservent leurs médicaments via la plateforme. Vous confirmez, préparez et attribuez un code de retrait.',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
  },
  {
    icon: FileText,
    title: 'Ordonnances numériques',
    desc: 'Recevez les ordonnances directement depuis les médecins. Vérifiez leur authenticité et délivrez en toute sécurité.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
  {
    icon: Shield,
    title: 'Prises en charge automatisées',
    desc: 'Les demandes de prise en charge mutuelles sont traitées directement via la plateforme. Moins de paperasse, plus de fluidité.',
    color: 'text-[var(--sw-warning)]',
    bg: 'bg-[var(--sw-warning-bg)]',
  },
  {
    icon: BarChart3,
    title: 'Statistiques et rapports',
    desc: 'Analysez vos ventes, médicaments les plus demandés, pics d\'activité et performances mensuelles depuis votre tableau de bord.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: CreditCard,
    title: 'Paiements simplifiés',
    desc: 'Acceptez les paiements Orange Money, Wave et carte bancaire. Commission transparente, reversements automatiques chaque mois.',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
  },
]

const problems = [
  {
    icon: AlertCircle,
    title: 'Gestion manuelle épuisante',
    desc: 'Les appels téléphoniques, les files d\'attente et les réservations orales sont difficiles à gérer et sources d\'erreurs.',
  },
  {
    icon: Pill,
    title: 'Ruptures de stock mal gérées',
    desc: 'Les patients viennent pour des médicaments indisponibles. Pas de visibilité anticipée sur les niveaux de stock.',
  },
  {
    icon: FileText,
    title: 'Ordonnances papier contraignantes',
    desc: 'Vérification manuelle, ordonnances illisibles, risque de fraude — sans système numérique, chaque délivrance est un risque.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Inscrivez votre pharmacie',
    desc: 'Créez votre compte pharmacie en renseignant vos informations : raison sociale, localisation, horaires et documents de conformité.',
  },
  {
    n: '2',
    title: 'Publiez votre catalogue',
    desc: 'Importez ou saisissez votre liste de médicaments. Renseignez les stocks et les prix. Tout est mis à jour en temps réel sur la plateforme.',
  },
  {
    n: '3',
    title: 'Recevez et gérez vos réservations',
    desc: 'Les patients réservent via la plateforme. Vous recevez une notification, confirmez et préparez la commande. Le patient retire avec son code.',
  },
]

const stats = [
  { value: '2 min', label: 'Temps d\'inscription' },
  { value: '+40%', label: 'Clients potentiels supplémentaires' },
  { value: '0 %', label: 'Commission sur les premiers 3 mois' },
  { value: '24/7', label: 'Réservations automatiques' },
]

const plans = [
  {
    name: 'Starter',
    price: '15 000',
    period: 'FCFA / mois',
    desc: 'Pour les petites pharmacies qui débutent en ligne.',
    features: ['Catalogue jusqu\'à 500 produits', 'Réservations en ligne illimitées', 'Ordonnances numériques', 'Tableau de bord basique'],
    cta: 'Commencer',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '35 000',
    period: 'FCFA / mois',
    desc: 'Pour les pharmacies qui veulent maximiser leurs ventes.',
    features: ['Catalogue illimité', 'Prises en charge mutuelles', 'Rapports avancés', 'Priorité dans les résultats de recherche', 'Support prioritaire'],
    cta: 'Choisir Pro',
    highlighted: true,
  },
]

export default function PharmaciesPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-success-bg)] to-[var(--sw-surface)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white border border-green-200 text-[var(--sw-success)] px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
            <Package className="w-4 h-4" />
            Espace Pharmacie
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight tracking-tight">
            Augmentez vos ventes<br />
            <span className="text-[var(--sw-primary)]">avec les réservations en ligne.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
            Rejoignez le réseau Séné Wérr et recevez des réservations de médicaments automatiquement,
            gérez votre stock en temps réel et traitez les ordonnances numériques.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/inscription?profil=pharmacie">
              <Button size="xl" className="w-full sm:w-auto">
                Rejoindre gratuitement
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                Voir les tarifs
              </Button>
            </Link>
          </div>
          <p className="text-sm text-[var(--sw-ink-3)]">
            Sans engagement · 3 mois d'essai gratuit · Résiliation possible à tout moment
          </p>
        </div>
        <div className="mt-14 max-w-5xl mx-auto">
          <ActorImage
            src="https://images.unsplash.com/photo-1739289696449-cba3a5ef085d?w=1400&h=800&fit=crop&q=80"
            alt="Pharmacien africain conseillant un client dans sa pharmacie"
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
              Gérer une pharmacie sans outil numérique, c'est perdre du temps et des clients.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Séné Wérr résout les trois problèmes majeurs des pharmacies sénégalaises.
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
              Une plateforme complète, pensée pour les pharmacies.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Chaque fonctionnalité a été conçue pour simplifier votre quotidien et augmenter votre chiffre d'affaires.
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
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Démarrage</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">Opérationnel en 3 étapes.</h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              L'intégration prend moins d'une journée. Pas de développement, pas de matériel supplémentaire.
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

      {/* ── Tarifs ── */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Tarifs</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Un abonnement simple, transparent.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Pas de frais cachés, pas de commission sur les ventes. Vous payez un abonnement mensuel fixe.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {plans.map(({ name, price, period, desc, features: planFeatures, cta, highlighted }) => (
              <div
                key={name}
                className={`sw-card p-7 space-y-6 ${highlighted ? 'border-[var(--sw-primary)] ring-2 ring-[var(--sw-primary)] ring-offset-2' : ''}`}
              >
                {highlighted && (
                  <div className="inline-flex items-center gap-1 bg-[var(--sw-primary)] text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-white" /> Recommandé
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-[var(--sw-ink)]">{name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-[var(--sw-ink)]">{price}</span>
                    <span className="text-sm text-[var(--sw-ink-2)] ml-1">{period}</span>
                  </div>
                  <p className="text-sm text-[var(--sw-ink-2)] mt-2">{desc}</p>
                </div>
                <ul className="space-y-2.5">
                  {planFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--sw-ink-2)]">
                      <Check className="w-4 h-4 text-[var(--sw-success)] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/inscription?profil=pharmacie" className="block">
                  <Button
                    className="w-full"
                    variant={highlighted ? 'primary' : 'outline'}
                  >
                    {cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--sw-ink-3)]">
            Tous les plans incluent 3 mois d'essai gratuit. Voir les{' '}
            <Link href="/tarifs" className="text-[var(--sw-primary)] hover:underline">tarifs complets</Link>.
          </p>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <TrendingUp className="w-10 h-10 text-white/60 mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Développez votre pharmacie avec Séné Wérr.
          </h2>
          <p className="text-white/80 text-lg">
            Rejoignez le réseau de pharmacies connectées du Sénégal.
            Commencez gratuitement, sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription?profil=pharmacie">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon espace pharmacie
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
