import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle, Calendar, FileText, Users,
  Stethoscope, Building2, Pill, Shield, User, Clock,
  CreditCard, Bell, HeartPulse, Zap, Star, ChevronDown, ChevronUp,
  MapPin, ShoppingBag, BarChart2, Lock, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTOR_HERO_STYLE = `
  .actor-hero-bg {
    background: linear-gradient(158deg, #F0FBFD 0%, #FFFFFF 40%, #F0FAF1 100%);
  }
  .dark .actor-hero-bg {
    background: linear-gradient(158deg, #071520 0%, #0c2130 40%, #061308 100%);
  }
`

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('py-16 lg:py-24', className)}>
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  )
}

function SectionTitle({ badge, title, sub }: { badge?: string; title: string; sub?: string }) {
  return (
    <div className="text-center mb-12">
      {badge && (
        <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">{badge}</p>
      )}
      <h2 className="font-display text-4xl font-bold text-ink leading-tight mb-3">{title}</h2>
      {sub && <p className="text-body text-ink-2 max-w-xl mx-auto">{sub}</p>}
    </div>
  )
}

function PricingCard({
  name,
  price,
  features,
  recommended,
  cta,
  role,
}: {
  name: string
  price: string | number
  features: string[]
  recommended?: boolean
  cta: string
  role: string
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border-2 bg-surface p-6 h-full',
        recommended ? 'border-primary shadow-lg' : 'border-line',
      )}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
          Recommandé
        </div>
      )}
      <h3 className="font-display text-xl font-bold text-ink">{name}</h3>
      <div className="my-4">
        {typeof price === 'number' ? (
          <>
            <span className="text-4xl font-bold text-ink">{price.toLocaleString('fr-FR')}</span>
            <span className="text-ink-2 ml-1">FCFA/mois</span>
          </>
        ) : (
          <span className="text-3xl font-bold text-ink">{price}</span>
        )}
      </div>
      <ul className="flex-1 space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink-2">
            <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={`/auth/inscription?role=${role}`}
        className={cn(
          'block w-full py-3 text-center text-sm font-semibold rounded-xl transition-colors',
          recommended
            ? 'bg-primary text-white hover:bg-[#17721F]'
            : 'border border-primary text-primary hover:bg-primary hover:text-white',
        )}
      >
        {cta}
      </Link>
    </div>
  )
}

function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section className="py-16 bg-surface">
      <div className="mx-auto max-w-3xl px-4">
        <SectionTitle badge="FAQ" title="Questions fréquentes" />
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="border border-line rounded-xl bg-bg overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left font-medium text-ink hover:bg-surface-2 transition-colors"
              >
                {item.q}
                {open === i ? (
                  <ChevronUp className="h-4 w-4 text-ink-3 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-ink-3 shrink-0" />
                )}
              </button>
              {open === i && (
                <div className="px-4 pb-4 text-sm text-ink-2 border-t border-line pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Marquee({ items }: { items: { initials: string; name: string; color: string; logo?: string }[] }) {
  return (
    <div className="overflow-hidden">
      <style>{`@keyframes marquee-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      <div style={{ display: 'flex', width: 'max-content', gap: '1.5rem', animation: 'marquee-scroll 30s linear infinite' }}>
        {[...items, ...items].map((item, i) => (
          <div key={i} className="h-24 w-28 rounded-xl border border-line bg-bg flex flex-col items-center justify-center gap-1.5 py-3 px-2 shrink-0 shadow-sm">
            {item.logo ? (
              <img
                src={item.logo}
                alt={item.name}
                className="h-9 w-20 rounded-md object-contain shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            <div className={cn('h-10 w-10 rounded-md flex items-center justify-center shrink-0', item.color, item.logo ? 'hidden' : '')}>
              <span className="text-xs font-bold text-ink">{item.initials}</span>
            </div>
            <span className="text-[10px] font-medium text-ink text-center leading-tight line-clamp-2">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TestimonialsSection({
  testimonials,
}: {
  testimonials: { initials: string; color: string; name: string; role: string; city: string; text: string }[]
}) {
  return (
    <section className="py-16 bg-bg">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle badge="Témoignages" title="Ce qu'ils en disent" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', t.color)}>
                  <span className="text-sm font-bold text-ink">{t.initials}</span>
                </div>
                <div>
                  <p className="font-semibold text-ink text-sm">{t.name}</p>
                  <p className="text-xs text-ink-2">{t.role} · {t.city}</p>
                </div>
              </div>
              <div className="text-primary text-base mb-3">★★★★★</div>
              <p className="text-sm text-ink-2">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProLandingPage() {
  const problems = [
    {
      icon: Calendar,
      title: 'Agenda surchargé',
      desc: "Files d'attente interminables, double réservation, no-shows sans prévenir.",
    },
    {
      icon: FileText,
      title: 'Ordonnances papier perdues',
      desc: 'Patients qui rappellent, pharmacies qui demandent des confirmations à répétition.',
    },
    {
      icon: MapPin,
      title: 'Patients sur plusieurs sites',
      desc: 'Informations éparpillées entre vos établissements, aucune vue globale.',
    },
    {
      icon: BarChart2,
      title: 'Statistiques invisibles',
      desc: 'Impossible de piloter votre activité sans données consolidées.',
    },
  ]

  const features = [
    {
      icon: Calendar,
      title: 'Agenda intelligent multi-sites',
      desc: 'Gérez plusieurs établissements depuis un seul écran, sans conflits.',
    },
    {
      icon: FileText,
      title: 'Ordonnances numériques',
      desc: 'Créez, envoyez et archivez vos ordonnances en quelques secondes.',
    },
    {
      icon: HeartPulse,
      title: 'Consultations en ligne',
      desc: 'Télémédecine intégrée, lien de consultation généré automatiquement.',
    },
    {
      icon: Users,
      title: 'Dossier patient centralisé',
      desc: 'Historique complet, documents, photos — tout au même endroit.',
    },
    {
      icon: Bell,
      title: 'Notifications automatiques',
      desc: 'Rappels SMS et push envoyés à vos patients sans intervention manuelle.',
    },
    {
      icon: BarChart2,
      title: "Statistiques d'activité",
      desc: "Taux de remplissage, revenus, temps moyen de consultation — pilotez tout.",
    },
  ]

  const steps = [
    {
      n: '01',
      title: 'Créez votre compte',
      desc: 'Inscription en 3 minutes, vérification de diplôme simple et rapide.',
    },
    {
      n: '02',
      title: 'Configurez votre agenda',
      desc: 'Définissez vos horaires, durées et types de consultations.',
    },
    {
      n: '03',
      title: 'Partagez votre profil',
      desc: 'Page publique générée automatiquement, lien de réservation prêt à diffuser.',
    },
    {
      n: '04',
      title: 'Gérez depuis partout',
      desc: 'Accès complet depuis le web et votre mobile, où que vous soyez.',
    },
  ]

  const faqItems = [
    {
      q: 'Mon agenda existant est-il compatible ?',
      a: "Oui, Séne Wérr permet l'import depuis Google Calendar et la plupart des agendas courants. La migration est guidée pas à pas.",
    },
    {
      q: 'Les patients peuvent-ils réserver directement ?',
      a: "Absolument. Votre profil public contient un lien de réservation que vous partagez librement. Vos patients réservent 24h/24 sans vous appeler.",
    },
    {
      q: 'Comment fonctionnent les ordonnances numériques ?',
      a: "L'ordonnance est générée en PDF signé électroniquement, avec un QR code sécurisé. Elle est transmise directement à la pharmacie partenaire choisie par le patient.",
    },
    {
      q: 'Puis-je avoir plusieurs établissements ?',
      a: "Oui. Le plan Solo permet 2 établissements, le plan Pro en permet un nombre illimité. Chaque site a son propre agenda et ses propres plages horaires.",
    },
    {
      q: 'Mes données sont-elles sécurisées ?',
      a: "Toutes les données sont hébergées sur des serveurs certifiés avec chiffrement bout en bout. Séne Wérr est conforme aux normes RGPD et APDP.",
    },
  ]

  const proLogos = [
    { initials: 'DD', name: 'Dr. Diallo', color: 'bg-accent-soft' },
    { initials: 'DN', name: 'Dr. Ndiaye', color: 'bg-primary-soft' },
    { initials: 'CP', name: 'Clinique Pasteur', color: 'bg-navy-soft', logo: '/logos/clinique-pasteur.svg' },
    { initials: 'DS', name: 'Dr. Sow', color: 'bg-accent-soft' },
    { initials: 'CS', name: 'Cabinet Santé Plus', color: 'bg-primary-soft', logo: '/logos/cabinet-sante-plus.svg' },
    { initials: 'DF', name: 'Dr. Fall', color: 'bg-navy-soft' },
    { initials: 'PD', name: 'Polyclinique Dakar', color: 'bg-accent-soft', logo: '/logos/polyclinique-dakar.svg' },
    { initials: 'DB', name: 'Dr. Ba', color: 'bg-primary-soft' },
    { initials: 'CN', name: 'Cabinet Médical Nord', color: 'bg-navy-soft', logo: '/logos/cabinet-medical-nord.svg' },
    { initials: 'DD', name: 'Dr. Diop', color: 'bg-accent-soft' },
  ]

  const proTestimonials = [
    {
      initials: 'AS',
      color: 'bg-primary-soft',
      name: 'Dr. Aminata Sall',
      role: 'Médecin généraliste',
      city: 'Dakar',
      text: "Depuis que j'utilise Séne Wérr, mes rendez-vous sont organisés sans effort. Mes patients apprécient les rappels automatiques et les confirmations instantanées.",
    },
    {
      initials: 'IC',
      color: 'bg-accent-soft',
      name: 'Dr. Ibrahima Cissé',
      role: 'Cardiologue',
      city: 'Saint-Louis',
      text: "La gestion multi-établissements m'a simplifié la vie. Je consulte dans trois structures différentes et tout est centralisé sur un seul écran.",
    },
    {
      initials: 'FD',
      color: 'bg-primary-soft',
      name: 'Dr. Fatou Diallo',
      role: 'Pédiatre',
      city: 'Thiès',
      text: "Les ordonnances numériques ont éliminé les appels répétitifs des pharmacies. Je gagne plus d'une heure par jour que je consacre maintenant à mes patients.",
    },
  ]

  return (
    <>
      <style>{ACTOR_HERO_STYLE}</style>
      <section className="actor-hero-bg relative py-24 overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.10) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary border border-primary/20">
            <Stethoscope className="h-4 w-4" />
            Pour les médecins &amp; spécialistes
          </div>
          <h1 className="font-display text-5xl font-bold text-ink leading-tight mb-4">
            Gérez votre cabinet,<br />concentrez-vous sur vos patients.
          </h1>
          <p className="text-lg text-ink-2 max-w-2xl mx-auto mb-8 leading-relaxed">
            Agenda intelligent, ordonnances numériques, multi-établissements, statistiques — tout depuis un seul espace sécurisé.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              to="/auth/inscription?role=professional"
              className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-[#17721F] transition-colors shadow-sm"
            >
              Créer mon espace gratuit
            </Link>
            <a
              href="#tarifs"
              className="px-6 py-3 border border-line text-ink-2 font-semibold rounded-xl hover:bg-surface-2 transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Users, label: '500+ médecins' },
              { icon: Clock, label: "14 jours d'essai" },
              { icon: Shield, label: 'Sans engagement' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm text-ink-3 uppercase tracking-widest mb-4">Ils utilisent déjà Séne Wérr</p>
          <Marquee items={proLogos} />
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Vos défis" title="Vos défis quotidiens" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-xl border border-line bg-bg p-5">
                <p.icon className="h-6 w-6 text-status-danger mb-3" />
                <h3 className="font-semibold text-ink mb-1">{p.title}</h3>
                <p className="text-sm text-ink-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section>
        <SectionTitle badge="Fonctionnalités" title="Tout ce dont vous avez besoin" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-soft mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-ink mb-2">{f.title}</h3>
              <p className="text-sm text-ink-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Démarrage" title="Comment ça marche" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-ink mb-2">{s.title}</h3>
                <p className="text-sm text-ink-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section id="tarifs">
        <SectionTitle
          badge="Tarifs"
          title="Tarifs simples et transparents"
          sub="14 jours d'essai gratuit sur tous les plans payants"
        />
        <div className="grid sm:grid-cols-3 gap-6 items-start">
          <PricingCard
            name="Découverte"
            price="Gratuit"
            role="professional"
            cta="Commencer gratuitement"
            features={[
              '50 rendez-vous par mois',
              '1 établissement',
              'Ordonnances de base',
              'Profil public',
            ]}
          />
          <PricingCard
            name="Solo"
            price={9900}
            role="professional"
            cta="Essayer 14 jours"
            recommended
            features={[
              'Rendez-vous illimités',
              '2 établissements',
              '50 crédits IA',
              'Statistiques avancées',
              'Support prioritaire',
            ]}
          />
          <PricingCard
            name="Pro"
            price={19900}
            role="professional"
            cta="Essayer 14 jours"
            features={[
              'Rendez-vous illimités',
              'Établissements illimités',
              '200 crédits IA',
              'Transcription IA',
              'Assistant inclus',
              'Support VIP',
            ]}
          />
        </div>
      </Section>

      <FAQ items={faqItems} />

      <TestimonialsSection testimonials={proTestimonials} />

      <section
        className="py-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B3549 0%, #153F54 50%, #0E2F44 100%)' }}
      >
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Rejoignez les médecins qui font confiance à Séne Wérr
          </h2>
          <p className="text-white/70 text-lg mb-8">Commencez gratuitement, sans carte bancaire.</p>
          <Link
            to="/auth/inscription?role=professional"
            className="inline-block px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-[#17721F] transition-colors shadow-lg"
          >
            Créer mon espace gratuit
          </Link>
        </div>
      </section>
    </>
  )
}

export function EstablishmentLandingPage() {
  const problems = [
    {
      icon: Calendar,
      title: 'Plannings qui se chevauchent',
      desc: "Conflits d'horaires entre praticiens, salles réservées deux fois, organisation chaotique.",
    },
    {
      icon: Phone,
      title: 'Secrétariat débordé',
      desc: "Appels incessants, prises de rendez-vous manuelles, erreurs de saisie qui s'accumulent.",
    },
    {
      icon: BarChart2,
      title: 'Statistiques introuvables',
      desc: "Impossible d'avoir une vue d'ensemble sur l'activité réelle de votre structure.",
    },
    {
      icon: Users,
      title: 'Coordination difficile',
      desc: 'Communication éparpillée entre praticiens, informations qui se perdent.',
    },
  ]

  const features = [
    {
      icon: Calendar,
      title: 'Planning multi-praticiens',
      desc: 'Visualisez et gérez les agendas de toute votre équipe depuis un seul écran.',
    },
    {
      icon: Users,
      title: 'Secrétariat centralisé',
      desc: 'Un espace dédié pour vos secrétaires, avec accès aux plannings de tous les praticiens.',
    },
    {
      icon: Building2,
      title: 'Gestion des salles',
      desc: 'Attribuez les salles par praticien et par plage horaire, sans conflit.',
    },
    {
      icon: BarChart2,
      title: 'Rapports de direction',
      desc: 'Tableaux de bord consolidés : activité, revenus, occupation des salles.',
    },
    {
      icon: Bell,
      title: "Notifications d'équipe",
      desc: "Alertes en temps réel pour les changements d'agenda et les absences.",
    },
    {
      icon: HeartPulse,
      title: 'Portail patient',
      desc: 'Vos patients accèdent à leurs dossiers, résultats et rendez-vous en ligne.',
    },
  ]

  const steps = [
    {
      n: '01',
      title: 'Créer la structure',
      desc: 'Enregistrez votre établissement en quelques minutes avec toutes ses informations.',
    },
    {
      n: '02',
      title: 'Inviter les praticiens',
      desc: 'Envoyez des invitations à vos médecins et spécialistes par email.',
    },
    {
      n: '03',
      title: 'Configurer les plannings',
      desc: 'Définissez les horaires, les salles et les types de consultations par praticien.',
    },
    {
      n: '04',
      title: 'Piloter depuis le tableau de bord',
      desc: 'Suivez toute votre activité en temps réel depuis votre espace de direction.',
    },
  ]

  const estabLogos = [
    { initials: 'HP', name: 'Hôpital Principal', color: 'bg-navy-soft', logo: '/logos/hopital-principal.svg' },
    { initials: 'CV', name: 'Clinique du Cap-Vert', color: 'bg-accent-soft', logo: '/logos/clinique-cap-vert.svg' },
    { initials: 'PE', name: "Polyclinique de l'Étoile", color: 'bg-primary-soft', logo: '/logos/polyclinique-etoile.svg' },
    { initials: 'PK', name: 'Centre de Santé Pikine', color: 'bg-navy-soft', logo: '/logos/centre-sante-pikine.svg' },
    { initials: 'LP', name: 'Laboratoire Pasteur', color: 'bg-accent-soft', logo: '/logos/laboratoire-pasteur.svg' },
    { initials: 'FA', name: 'Hôpital Fann', color: 'bg-primary-soft', logo: '/logos/hopital-fann.svg' },
    { initials: 'CM', name: 'Clinique Madeleine', color: 'bg-navy-soft', logo: '/logos/clinique-madeleine.svg' },
    { initials: 'TH', name: 'Centre Médical Thiès', color: 'bg-accent-soft', logo: '/logos/centre-medical-thies.svg' },
    { initials: 'ZG', name: 'CHR Ziguinchor', color: 'bg-primary-soft', logo: '/logos/chr-ziguinchor.svg' },
    { initials: 'AR', name: 'Hôpital Aristide', color: 'bg-navy-soft', logo: '/logos/hopital-aristide.svg' },
    { initials: 'SK', name: 'Clinique Sokhna', color: 'bg-accent-soft', logo: '/logos/clinique-sokhna.svg' },
    { initials: 'BS', name: 'Labo BioSanté', color: 'bg-primary-soft', logo: '/logos/labo-biosante.svg' },
  ]

  const estabTestimonials = [
    {
      initials: 'MT',
      color: 'bg-accent-soft',
      name: 'Moussa Traoré',
      role: 'Directeur de clinique',
      city: 'Dakar',
      text: "Séne Wérr a transformé la gestion de notre clinique. Les plannings ne se chevauchent plus et nos praticiens travaillent de façon beaucoup plus coordonnée.",
    },
    {
      initials: 'AN',
      color: 'bg-primary-soft',
      name: 'Adja Ndiaye',
      role: 'Secrétaire médicale',
      city: 'Rufisque',
      text: "Avant, je passais mes journées à répondre au téléphone. Aujourd'hui, 80 % des rendez-vous sont pris en ligne et je peux me concentrer sur l'accueil des patients.",
    },
    {
      initials: 'MB',
      color: 'bg-navy-soft',
      name: 'Mariama Baldé',
      role: 'Responsable RH',
      city: 'Kaolack',
      text: "La gestion des plannings de nos 15 praticiens est désormais fluide. Les absences sont signalées en temps réel et les remplacements s'organisent en quelques clics.",
    },
  ]

  return (
    <>
      <section className="actor-hero-bg relative py-24 overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.10) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary border border-primary/20">
            <Building2 className="h-4 w-4" />
            Pour les cabinets &amp; cliniques
          </div>
          <h1 className="font-display text-5xl font-bold text-ink leading-tight mb-4">
            Centralisez votre structure de santé.
          </h1>
          <p className="text-lg text-ink-2 max-w-2xl mx-auto mb-8 leading-relaxed">
            Planning multi-praticiens, secrétariat intégré, statistiques de structure — pilotez tout depuis un tableau de bord unique.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              to="/auth/inscription?role=establishment"
              className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-[#17721F] transition-colors shadow-sm"
            >
              Inscrire mon établissement
            </Link>
            <a
              href="#features"
              className="px-6 py-3 border border-line text-ink-2 font-semibold rounded-xl hover:bg-surface-2 transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Clock, label: "14 jours d'essai" },
              { icon: Users, label: 'Onboarding accompagné' },
              { icon: Zap, label: '100% en ligne' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm text-ink-3 uppercase tracking-widest mb-4">Ils utilisent déjà Séne Wérr</p>
          <Marquee items={estabLogos} />
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Vos défis" title="Les obstacles du quotidien" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-xl border border-line bg-bg p-5">
                <p.icon className="h-6 w-6 text-status-danger mb-3" />
                <h3 className="font-semibold text-ink mb-1">{p.title}</h3>
                <p className="text-sm text-ink-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Fonctionnalités" title="Tout ce dont votre structure a besoin" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-soft mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-ink mb-2">{f.title}</h3>
                <p className="text-sm text-ink-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Démarrage" title="Comment ça marche" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-ink mb-2">{s.title}</h3>
                <p className="text-sm text-ink-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            badge="Tarifs"
            title="Tarifs adaptés à votre structure"
            sub="14 jours d'essai gratuit sur tous les plans"
          />
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            <PricingCard
              name="Start"
              price={19900}
              role="establishment"
              cta="Essayer 14 jours"
              features={[
                '3 praticiens',
                '1 secrétaire',
                'Statistiques de base',
                'Portail patient',
              ]}
            />
            <PricingCard
              name="Cabinet"
              price={39900}
              role="establishment"
              cta="Essayer 14 jours"
              recommended
              features={[
                '10 praticiens',
                '3 secrétaires',
                '100 crédits IA',
                'Statistiques avancées',
                'Support prioritaire',
              ]}
            />
            <PricingCard
              name="Clinique"
              price={79900}
              role="establishment"
              cta="Essayer 14 jours"
              features={[
                'Praticiens illimités',
                'Secrétaires illimitées',
                '500 crédits IA',
                'Support dédié',
                'Accès API',
              ]}
            />
          </div>
        </div>
      </section>

      <TestimonialsSection testimonials={estabTestimonials} />

      <section
        className="py-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B3549 0%, #153F54 50%, #0E2F44 100%)' }}
      >
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Gérez votre structure de santé depuis un seul écran.
          </h2>
          <p className="text-white/70 text-lg mb-8">Commencez gratuitement, sans carte bancaire.</p>
          <Link
            to="/auth/inscription?role=establishment"
            className="inline-block px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-[#17721F] transition-colors shadow-lg"
          >
            Inscrire mon établissement
          </Link>
        </div>
      </section>
    </>
  )
}

export function PharmacyLandingPage() {
  const problems = [
    {
      icon: Phone,
      title: 'Appels répétitifs pour les stocks',
      desc: 'Les patients appellent sans arrêt pour vérifier si un médicament est disponible.',
    },
    {
      icon: FileText,
      title: 'Ordonnances illisibles',
      desc: "Déchiffrer une ordonnance manuscrite prend du temps et génère des erreurs.",
    },
    {
      icon: ShoppingBag,
      title: 'Clients qui vont ailleurs',
      desc: "Faute d'information sur vos disponibilités, vos clients se tournent vers la concurrence.",
    },
    {
      icon: BarChart2,
      title: 'Gestion des ruptures chronophage',
      desc: "Suivre les ruptures de stock manuellement est fastidieux et source d'oublis.",
    },
  ]

  const features = [
    {
      icon: ShoppingBag,
      title: 'Catalogue produits & disponibilités',
      desc: 'Publiez votre catalogue en ligne avec les niveaux de stock en temps réel.',
    },
    {
      icon: Calendar,
      title: 'Réservations en ligne',
      desc: 'Vos patients réservent leurs médicaments 24h/24 sans vous appeler.',
    },
    {
      icon: FileText,
      title: 'Vérification ordonnances numériques',
      desc: 'Recevez et validez les ordonnances numériques directement depuis la plateforme.',
    },
    {
      icon: Bell,
      title: 'Alertes rupture de stock',
      desc: "Soyez notifié avant d'être en rupture et gérez vos réapprovisionnements facilement.",
    },
    {
      icon: CreditCard,
      title: 'Tableau de bord paiements',
      desc: 'Suivez vos revenus, commissions et paiements depuis un tableau de bord clair.',
    },
    {
      icon: MapPin,
      title: 'Visibilité sur la carte',
      desc: 'Votre pharmacie apparaît sur la carte Séne Wérr, visible par tous les patients.',
    },
  ]

  const steps = [
    {
      n: '01',
      title: 'Créer votre espace',
      desc: 'Enregistrez votre pharmacie en quelques minutes avec vos informations officielles.',
    },
    {
      n: '02',
      title: 'Renseigner votre catalogue',
      desc: 'Ajoutez vos produits, leurs descriptions, prix et niveaux de stock.',
    },
    {
      n: '03',
      title: 'Recevoir les réservations',
      desc: 'Les patients réservent en ligne, vous recevez une notification immédiate.',
    },
    {
      n: '04',
      title: 'Suivre les paiements',
      desc: "Consultez vos revenus et l'historique de toutes vos transactions en temps réel.",
    },
  ]

  const pharmacyLogos = [
    { initials: 'PG', name: 'Pharmacie Guigon', color: 'bg-accent-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PE', name: "Pharmacie de l'Étoile", color: 'bg-primary-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PN', name: 'Pharmacie Nationale', color: 'bg-navy-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PP', name: 'Pharmacie du Plateau', color: 'bg-accent-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PD', name: 'PharmaPlus Dakar', color: 'bg-primary-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PM', name: 'Pharmacie Mbour', color: 'bg-navy-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'PT', name: 'Pharmacie Thiès', color: 'bg-accent-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'TO', name: 'Pharmacie Touba', color: 'bg-primary-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'SL', name: 'Pharmacie Saint-Louis', color: 'bg-navy-soft', logo: '/logos/chr-saint-louis.png' },
    { initials: 'ZI', name: 'Pharmacie Ziguinchor', color: 'bg-accent-soft', logo: '/logos/chr-saint-louis.png' },
  ]

  const pharmacyTestimonials = [
    {
      initials: 'OS',
      color: 'bg-accent-soft',
      name: 'Ousmane Seck',
      role: 'Pharmacien propriétaire',
      city: 'Dakar',
      text: "Le catalogue en ligne a réduit de 70 % les appels entrants. Nos clients vérifient les disponibilités eux-mêmes et réservent sans nous déranger.",
    },
    {
      initials: 'AD',
      color: 'bg-primary-soft',
      name: 'Aissatou Diop',
      role: 'Préparatrice',
      city: 'Ziguinchor',
      text: "Les ordonnances numériques arrivent directement sur notre interface. Plus d'erreurs de lecture, et la préparation est beaucoup plus rapide.",
    },
    {
      initials: 'RF',
      color: 'bg-navy-soft',
      name: 'Dr. Rokhaya Fall',
      role: 'Pharmacienne',
      city: 'Thiès',
      text: "Les alertes de rupture de stock nous permettent d'anticiper les réapprovisionnements. On ne se retrouve plus jamais à court de médicaments essentiels.",
    },
  ]

  return (
    <>
      <section className="actor-hero-bg relative py-24 overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.10) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary border border-primary/20">
            <Pill className="h-4 w-4" />
            Pour les pharmacies
          </div>
          <h1 className="font-display text-5xl font-bold text-ink leading-tight mb-4">
            Votre pharmacie visible et connectée.
          </h1>
          <p className="text-lg text-ink-2 max-w-2xl mx-auto mb-8 leading-relaxed">
            Catalogue en ligne, réservations patients, vérification d'ordonnances numériques, gestion des stocks — tout en un.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              to="/auth/inscription?role=pharmacy"
              className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-[#17721F] transition-colors shadow-sm"
            >
              Inscrire ma pharmacie
            </Link>
            <a
              href="#tarifs"
              className="px-6 py-3 border border-line text-ink-2 font-semibold rounded-xl hover:bg-surface-2 transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Star, label: '0% de commission (plan Premium)' },
              { icon: Clock, label: 'Réservations 24h/24' },
              { icon: FileText, label: 'Intégration ordonnances' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm text-ink-3 uppercase tracking-widest mb-4">Ils utilisent déjà Séne Wérr</p>
          <Marquee items={pharmacyLogos} />
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Vos défis" title="Les obstacles du quotidien" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-xl border border-line bg-bg p-5">
                <p.icon className="h-6 w-6 text-status-danger mb-3" />
                <h3 className="font-semibold text-ink mb-1">{p.title}</h3>
                <p className="text-sm text-ink-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section>
        <SectionTitle badge="Fonctionnalités" title="Tout ce dont votre pharmacie a besoin" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-soft mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-ink mb-2">{f.title}</h3>
              <p className="text-sm text-ink-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Démarrage" title="Comment ça marche" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-ink mb-2">{s.title}</h3>
                <p className="text-sm text-ink-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            badge="Tarifs"
            title="Tarifs adaptés à votre activité"
            sub="Débutez gratuitement, passez au premium quand vous êtes prêt"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            <PricingCard
              name="Découverte"
              price="Gratuit"
              role="pharmacy"
              cta="Commencer gratuitement"
              features={[
                'Profil public',
                'Réservations illimitées',
                'Catalogue de base',
                '7% de commission',
              ]}
            />
            <PricingCard
              name="Start"
              price={14900}
              role="pharmacy"
              cta="Essayer 14 jours"
              features={[
                'Tout Découverte inclus',
                '50 crédits IA',
                'Gestion de stock avancée',
                '5% de commission',
              ]}
            />
            <PricingCard
              name="Pro"
              price={29900}
              role="pharmacy"
              cta="Essayer 14 jours"
              recommended
              features={[
                'Tout Start inclus',
                '150 crédits IA',
                'Intégration ordonnances',
                '3% de commission',
              ]}
            />
            <PricingCard
              name="Premium"
              price={49900}
              role="pharmacy"
              cta="Essayer 14 jours"
              features={[
                'Tout Pro inclus',
                '0% de commission*',
                'Support VIP',
                'Mise en avant sur la carte',
              ]}
            />
          </div>
          <p className="text-xs text-ink-3 text-center mt-4">
            * 0% de commission sur les réservations directes via votre lien Séne Wérr.
          </p>
        </div>
      </section>

      <TestimonialsSection testimonials={pharmacyTestimonials} />

      <section
        className="py-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B3549 0%, #153F54 50%, #0E2F44 100%)' }}
      >
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Rejoignez le réseau de pharmacies Séne Wérr.
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Commencez gratuitement, développez votre clientèle en ligne.
          </p>
          <Link
            to="/auth/inscription?role=pharmacy"
            className="inline-block px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-[#17721F] transition-colors shadow-lg"
          >
            Inscrire ma pharmacie
          </Link>
        </div>
      </section>
    </>
  )
}

export function InsuranceLandingPage() {
  const problems = [
    {
      icon: FileText,
      title: 'Dossiers papier ingérables',
      desc: 'Des dizaines de milliers de dossiers physiques impossibles à retrouver rapidement.',
    },
    {
      icon: Clock,
      title: 'Délais de validation trop longs',
      desc: "Les demandes de prise en charge s'accumulent et les assurés attendent trop longtemps.",
    },
    {
      icon: Shield,
      title: 'Fraudes aux demandes PEC',
      desc: 'Détecter les demandes frauduleuses manuellement est chronophage et peu fiable.',
    },
    {
      icon: BarChart2,
      title: 'Reporting manuel et chronophage',
      desc: 'Consolider les données pour vos rapports de direction prend des jours entiers.',
    },
  ]

  const features = [
    {
      icon: Users,
      title: 'Gestion des adhérents',
      desc: 'Base centralisée de vos adhérents, contrats, niveaux de couverture et historiques.',
    },
    {
      icon: CheckCircle,
      title: 'Validation des demandes PEC',
      desc: 'Tableau de bord de validation avec workflow configurable selon vos règles métier.',
    },
    {
      icon: CreditCard,
      title: 'Paiements automatisés',
      desc: 'Déclenchez les remboursements automatiquement après validation, sans saisie manuelle.',
    },
    {
      icon: Zap,
      title: 'Détection de fraude IA',
      desc: "Notre IA analyse chaque demande et signale les anomalies avant qu'elles vous coûtent.",
    },
    {
      icon: BarChart2,
      title: 'Reporting & exports',
      desc: 'Générez vos rapports de direction en un clic, exportables en Excel ou PDF.',
    },
    {
      icon: User,
      title: 'Portail adhérent',
      desc: 'Vos adhérents suivent leurs remboursements et soumettent leurs demandes en ligne.',
    },
  ]

  const steps = [
    {
      n: '01',
      title: 'Configurer votre mutuelle',
      desc: "Renseignez vos informations, vos niveaux de garantie et vos règles de prise en charge.",
    },
    {
      n: '02',
      title: 'Importer vos adhérents',
      desc: "Importez votre base d'adhérents depuis un fichier CSV ou via notre API.",
    },
    {
      n: '03',
      title: 'Traiter les demandes',
      desc: 'Recevez, analysez et validez les demandes de prise en charge depuis votre tableau de bord.',
    },
    {
      n: '04',
      title: 'Générer les rapports',
      desc: "Exportez vos rapports d'activité, de sinistralité et de fraude en quelques secondes.",
    },
  ]

  const insuranceLogos = [
    { initials: 'IG', name: 'IGSAS', color: 'bg-accent-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'IP', name: 'IPM Sénégal', color: 'bg-primary-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'MS', name: 'Mutuelle MSF', color: 'bg-navy-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'LP', name: 'La Prévoyance', color: 'bg-accent-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'CSS', name: 'Caisse de Sécurité Sociale', color: 'bg-primary-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'CN', name: 'CNES Mutuelle', color: 'bg-navy-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'MF', name: 'Mutuelle Fonctionnaires', color: 'bg-accent-soft', logo: '/logos/ipm-mse.jpg' },
    { initials: 'SS', name: 'Solidarité Santé', color: 'bg-primary-soft', logo: '/logos/ipm-mse.jpg' },
  ]

  const insuranceTestimonials = [
    {
      initials: 'EM',
      color: 'bg-accent-soft',
      name: 'El Hadji Mbaye',
      role: 'Directeur de mutuelle',
      city: 'Dakar',
      text: "Séne Wérr a réduit notre délai moyen de traitement des demandes PEC de 8 jours à moins de 48 heures. Nos adhérents sont bien plus satisfaits.",
    },
    {
      initials: 'YN',
      color: 'bg-primary-soft',
      name: 'Yaye Ndoye',
      role: 'Chargée de clientèle',
      city: 'Saint-Louis',
      text: "Le portail adhérent a transformé notre relation client. Les gens suivent leurs remboursements en temps réel et nous appellent beaucoup moins pour des suivis.",
    },
    {
      initials: 'SC',
      color: 'bg-navy-soft',
      name: 'Dr. Seydou Coulibaly',
      role: 'Médecin-conseil',
      city: 'Kaolack',
      text: "La détection de fraude par IA m'a surpris par sa précision. En trois mois, nous avons identifié plusieurs dossiers suspects que nous aurions manqués manuellement.",
    },
  ]

  return (
    <>
      <section className="actor-hero-bg relative py-24 overflow-hidden">
        <div
          className="absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.10) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary border border-primary/20">
            <Shield className="h-4 w-4" />
            Pour les mutuelles &amp; assureurs santé
          </div>
          <h1 className="font-display text-5xl font-bold text-ink leading-tight mb-4">
            Pilotez vos assurés et vos prises en charge.
          </h1>
          <p className="text-lg text-ink-2 max-w-2xl mx-auto mb-8 leading-relaxed">
            Gestion des adhérents, validation des demandes de prise en charge, paiements automatisés, reporting — depuis un seul espace sécurisé.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              to="/auth/inscription?role=insurance"
              className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-[#17721F] transition-colors shadow-sm"
            >
              Inscrire ma mutuelle
            </Link>
            <a
              href="#tarifs"
              className="px-6 py-3 border border-line text-ink-2 font-semibold rounded-xl hover:bg-surface-2 transition-colors"
            >
              Voir les fonctionnalités
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Clock, label: "14 jours d'essai" },
              { icon: Lock, label: 'RGPD + APDP' },
              { icon: Zap, label: 'API disponible' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-ink-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-sm text-ink-3 uppercase tracking-widest mb-4">Ils utilisent déjà Séne Wérr</p>
          <Marquee items={insuranceLogos} />
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Vos défis" title="Les obstacles du quotidien" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {problems.map((p) => (
              <div key={p.title} className="rounded-xl border border-line bg-bg p-5">
                <p.icon className="h-6 w-6 text-status-danger mb-3" />
                <h3 className="font-semibold text-ink mb-1">{p.title}</h3>
                <p className="text-sm text-ink-2">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section>
        <SectionTitle badge="Fonctionnalités" title="Tout ce dont votre mutuelle a besoin" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-soft mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-ink mb-2">{f.title}</h3>
              <p className="text-sm text-ink-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle badge="Démarrage" title="Comment ça marche" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-ink mb-2">{s.title}</h3>
                <p className="text-sm text-ink-2">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            badge="Tarifs"
            title="Tarifs adaptés à votre taille"
            sub="14 jours d'essai gratuit sur tous les plans"
          />
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            <PricingCard
              name="PME"
              price={29900}
              role="insurance"
              cta="Essayer 14 jours"
              features={[
                "Jusqu'à 500 adhérents",
                '3 utilisateurs',
                'Statistiques de base',
                'Portail adhérent',
              ]}
            />
            <PricingCard
              name="Pro"
              price={59900}
              role="insurance"
              cta="Essayer 14 jours"
              recommended
              features={[
                "Jusqu'à 5 000 adhérents",
                '10 utilisateurs',
                '200 crédits IA',
                'Détection de fraude',
                'Reporting avancé',
              ]}
            />
            <PricingCard
              name="Entreprise"
              price={99900}
              role="insurance"
              cta="Essayer 14 jours"
              features={[
                'Adhérents illimités',
                'Utilisateurs illimités',
                '500 crédits IA',
                'Accès API complet',
                'Support dédié',
              ]}
            />
          </div>
        </div>
      </section>

      <TestimonialsSection testimonials={insuranceTestimonials} />

      <section
        className="py-20 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B3549 0%, #153F54 50%, #0E2F44 100%)' }}
      >
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            Modernisez la gestion de votre mutuelle.
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Commencez gratuitement, sans engagement.
          </p>
          <Link
            to="/auth/inscription?role=insurance"
            className="inline-block px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-[#17721F] transition-colors shadow-lg"
          >
            Inscrire ma mutuelle
          </Link>
        </div>
      </section>
    </>
  )
}
