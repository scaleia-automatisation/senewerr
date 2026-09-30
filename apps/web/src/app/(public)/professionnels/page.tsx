import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/layout/public-header'
import { PublicFooter } from '@/components/layout/public-footer'
import {
  Calendar, FileText, Video, Users, BarChart3, Shield,
  ArrowRight, Check, Star, TrendingUp, Clock, Building2,
  AlertCircle, Stethoscope, Smartphone
} from 'lucide-react'
import { ActorImage } from '@/components/ui/sw-image'

export const metadata = {
  title: 'Espace Professionnel & Établissement de santé',
  description: 'Gérez votre agenda, vos patients, vos ordonnances et vos consultations en ligne avec Séné Wérr.',
}

const features = [
  {
    icon: Calendar,
    title: 'Agenda intelligent',
    desc: 'Gérez votre agenda de consultations, définissez vos créneaux disponibles et recevez des demandes de rendez-vous directement depuis la plateforme.',
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: Video,
    title: 'Téléconsultation intégrée',
    desc: 'Proposez des consultations à distance sécurisées, directement depuis votre espace. Idéal pour les suivis, les zones reculées ou les patients mobiles.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
  {
    icon: FileText,
    title: 'Ordonnances numériques',
    desc: 'Rédigez et transmettez vos ordonnances directement au patient et à sa pharmacie. Plus de papier perdu, traçabilité complète.',
    color: 'text-[var(--sw-success)]',
    bg: 'bg-[var(--sw-success-bg)]',
  },
  {
    icon: Users,
    title: 'Dossiers patients centralisés',
    desc: "Accédez à l'historique complet de vos patients : consultations, ordonnances, examens, résultats. Tout est centralisé et accessible en un clic.",
    color: 'text-[var(--sw-warning)]',
    bg: 'bg-[var(--sw-warning-bg)]',
  },
  {
    icon: Shield,
    title: 'Prises en charge mutuelles',
    desc: "Les prises en charge sont transmises automatiquement à l'organisme de couverture du patient. Vous êtes payé plus vite, sans paperasse.",
    color: 'text-[var(--sw-primary)]',
    bg: 'bg-[var(--sw-primary-subtle)]',
  },
  {
    icon: BarChart3,
    title: 'Statistiques et activité',
    desc: 'Suivez votre activité : consultations, revenus, patients actifs, délais moyens. Prenez de meilleures décisions avec des données fiables.',
    color: 'text-[var(--sw-info)]',
    bg: 'bg-[var(--sw-info-bg)]',
  },
]

const problems = [
  {
    icon: AlertCircle,
    title: 'Agenda papier désorganisé',
    desc: 'La gestion manuelle des rendez-vous génère des oublis, des doublons et des créneaux vides difficiles à combler en dernière minute.',
  },
  {
    icon: FileText,
    title: 'Ordonnances non tracées',
    desc: 'Chaque ordonnance papier peut être perdue ou falsifiée. Sans archivage numérique, le suivi des traitements devient impossible.',
  },
  {
    icon: Shield,
    title: 'Prises en charge laborieuses',
    desc: 'La coordination avec les mutuelles et assurances mobilise un temps précieux qui devrait être consacré aux patients.',
  },
]

const steps = [
  {
    n: '1',
    title: 'Créez votre profil professionnel',
    desc: 'Renseignez votre spécialité, vos diplômes, votre localisation et vos horaires. Votre profil est vérifié par nos équipes sous 48 h.',
  },
  {
    n: '2',
    title: 'Configurez votre agenda',
    desc: 'Définissez vos créneaux disponibles, la durée de vos consultations et vos tarifs. Les patients peuvent immédiatement réserver en ligne.',
  },
  {
    n: '3',
    title: 'Gérez vos patients depuis votre tableau de bord',
    desc: 'Consultez les dossiers, rédigez des ordonnances, réalisez des téléconsultations et suivez vos prises en charge, tout depuis un seul écran.',
  },
]

const stats = [
  { value: '48 h', label: 'Pour être opérationnel' },
  { value: '+30%', label: 'Taux de remplissage agenda' },
  { value: '100%', label: 'Ordonnances traçables' },
  { value: '0 min', label: 'De paperasse mutuelle' },
]

const plans = [
  {
    name: 'Praticien',
    price: '20 000',
    period: 'FCFA / mois',
    desc: 'Pour les médecins, infirmiers et praticiens libéraux.',
    features: [
      'Agenda en ligne illimité',
      'Dossiers patients',
      'Ordonnances numériques',
      'Téléconsultation (jusqu\'à 50 / mois)',
      'Intégration prises en charge',
    ],
    cta: 'Commencer',
    highlighted: false,
  },
  {
    name: 'Établissement',
    price: '75 000',
    period: 'FCFA / mois',
    desc: 'Pour les cliniques, polycliniques et établissements multi-praticiens.',
    features: [
      'Plusieurs praticiens sur un compte',
      'Agenda partagé et gestion du personnel',
      'Statistiques par praticien et par service',
      'Téléconsultation illimitée',
      'Support dédié et onboarding',
    ],
    cta: 'Choisir Établissement',
    highlighted: true,
  },
]

const testimonials = [
  {
    name: 'Dr Oumar S.',
    role: 'Médecin généraliste, Dakar',
    text: 'Mon agenda est maintenant rempli à 90% en permanence. Les patients apprécient de réserver depuis leur téléphone et je passe moins de temps au téléphone.',
    stars: 5,
  },
  {
    name: 'Dr Mariama D.',
    role: 'Pédiatre, Thiès',
    text: "Les ordonnances numériques ont changé ma pratique. Les parents récupèrent directement les médicaments à la pharmacie avec le code — plus d'ordonnances perdues.",
    stars: 5,
  },
  {
    name: 'Dr Ibrahima F.',
    role: 'Directeur médical, Polyclinique de Ziguinchor',
    text: 'Pour notre établissement avec 8 praticiens, Séné Wérr a simplifié toute notre gestion. Le plan Établissement vaut vraiment l\'investissement.',
    stars: 5,
  },
]

export default function ProfessionnelsPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)]">
      <PublicHeader />

      {/* ── Hero ── */}
      <section className="pt-20 pb-24 px-4 sm:px-6 bg-gradient-to-b from-[var(--sw-info-bg)] to-[var(--sw-surface)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-white border border-blue-200 text-[var(--sw-info)] px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
            <Stethoscope className="w-4 h-4" />
            Professionnels & Établissements de santé
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sw-ink)] leading-tight tracking-tight">
            Gérez votre agenda<br />
            <span className="text-[var(--sw-primary)]">et vos patients en ligne.</span>
          </h1>
          <p className="text-lg text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
            Agenda intelligent, dossiers patients, ordonnances numériques, téléconsultation
            et prises en charge mutuelles — tout ce qu'il vous faut pour exercer sereinement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/inscription?profil=sante">
              <Button size="xl" className="w-full sm:w-auto">
                Créer mon espace
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
            Profil vérifié sous 48 h · Sans engagement · Support inclus
          </p>
        </div>
        <div className="mt-14 max-w-5xl mx-auto">
          <ActorImage
            src="https://images.unsplash.com/photo-1631217868204-db1ed6bdd224?w=1400&h=800&fit=crop&q=80"
            alt="Médecin africain en consultation avec sa patiente"
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
              Exercer sans outil numérique, c'est travailler deux fois plus.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              La gestion papier de votre cabinet vous coûte du temps précieux chaque jour.
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
              Un cabinet numérique complet, clé en main.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Six outils essentiels conçus par et pour les professionnels de santé sénégalais.
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
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">Opérationnel en 48 h.</h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Notre équipe vous accompagne à chaque étape de la configuration de votre espace.
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
              Des plans adaptés à votre structure.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Praticien individuel ou établissement multi-praticiens, choisissez l'offre qui vous correspond.
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
                    <Building2 className="w-3 h-3" /> Multi-praticiens
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
                <Link href="/inscription?profil=sante" className="block">
                  <Button className="w-full" variant={highlighted ? 'primary' : 'outline'}>
                    {cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--sw-ink-3)]">
            Premier mois offert · Voir les{' '}
            <Link href="/tarifs" className="text-[var(--sw-primary)] hover:underline">tarifs complets</Link>
          </p>
        </div>
      </section>

      {/* ── Témoignages ── */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--sw-surface-2)]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-[var(--sw-primary)] uppercase tracking-widest">Ils témoignent</p>
            <h2 className="text-3xl font-bold text-[var(--sw-ink)]">
              Des professionnels qui ont transformé leur pratique.
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

      {/* ── CTA Final ── */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--sw-primary)]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Stethoscope className="w-10 h-10 text-white/60 mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Rejoignez le réseau de santé numérique du Sénégal.
          </h2>
          <p className="text-white/80 text-lg">
            Premier mois offert. Profil vérifié sous 48 h.
            Aucun engagement, résiliation possible à tout moment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/inscription?profil=sante">
              <Button size="xl" className="bg-white text-[var(--sw-primary)] hover:bg-white/90 w-full sm:w-auto">
                Créer mon espace professionnel
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="xl" variant="ghost" className="text-white border-white/30 hover:bg-white/10 w-full sm:w-auto">
                Contacter l'équipe
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
