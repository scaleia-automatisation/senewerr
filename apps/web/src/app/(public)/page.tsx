import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { MobileMenu } from '@/components/layout/mobile-menu'
import { AnimateIn } from '@/components/ui/animate-in'
import { HeroImage } from '@/components/ui/sw-image'
import {
  ArrowRight, Calendar, FileText, Pill, Shield,
  Check, ChevronRight, Users, Stethoscope, Building2, Package,
  Lock, Eye, BarChart3, Smartphone,
} from 'lucide-react'

/* ── Types ── */
type NavLink = { href: string; label: string }
const NAV: NavLink[] = [
  { href: '/patients',          label: 'Patients' },
  { href: '/pharmacies',        label: 'Pharmacies' },
  { href: '/professionnels',    label: 'Professionnels' },
  { href: '/mutuelles',         label: 'Mutuelles' },
  { href: '/fonctionnalites',   label: 'Fonctionnalités' },
  { href: '/tarifs',            label: 'Tarifs' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--sw-surface)] overflow-x-hidden">

      {/* ══ Navigation ══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-[var(--sw-line)] bg-[var(--sw-surface)]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-[60px] flex items-center justify-between gap-6">
          <Link href="/" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href}
                className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)] transition-colors duration-150">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/connexion">
                <Button variant="ghost" size="sm">Connexion</Button>
              </Link>
              <Link href="/inscription">
                <Button size="sm">S'inscrire</Button>
              </Link>
            </div>
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* ══ Hero ════════════════════════════════════════════════════════ */}
      <section className="relative pt-24 pb-20 px-5 overflow-hidden">
        {/* Fond dégradé très subtil */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--sw-primary-subtle)] via-transparent to-transparent" aria-hidden="true" />

        <div className="relative max-w-4xl mx-auto text-center space-y-7">

          <div className="sw-hero-1 inline-flex items-center gap-2 border border-[var(--sw-primary-muted)] bg-[var(--sw-primary-subtle)] text-[var(--sw-primary-dark)] px-4 py-1.5 rounded-full text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--sw-primary)] animate-pulse" />
            100 % gratuit pour les patients
          </div>

          <h1 className="sw-hero-2 text-[2.8rem] sm:text-[3.8rem] md:text-[4.5rem] font-extrabold text-[var(--sw-ink)] leading-[1.08] tracking-tight">
            Votre santé,<br />
            <span className="bg-gradient-to-r from-[var(--sw-primary)] to-[var(--sw-primary-light)] bg-clip-text text-transparent">
              enfin centralisée.
            </span>
          </h1>

          <p className="sw-hero-3 text-lg sm:text-xl text-[var(--sw-ink-2)] max-w-2xl mx-auto leading-relaxed">
            Dossier médical, rendez-vous, ordonnances, médicaments et tiers payant
            — connectés en un seul espace pour tous les acteurs de santé au Sénégal.
          </p>

          <div className="sw-hero-4 flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link href="/inscription">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base px-7 h-[48px]">
                Créer mon compte gratuitement
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/comment-ca-marche">
              <Button variant="ghost" size="lg" className="w-full sm:w-auto text-base h-[48px]">
                Comment ça marche
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <p className="sw-hero-5 text-xs text-[var(--sw-ink-3)] tracking-wide">
            Aucune carte bancaire · Accès immédiat · Données chiffrées
          </p>
        </div>

        {/* Image hero principale */}
        <div className="sw-hero-5 relative max-w-5xl mx-auto mt-14">
          <HeroImage
            src="/images/hero-landing.png"
            alt="Une patiente sénégalaise consulte ses services de santé sur son téléphone depuis chez elle"
            className="w-full aspect-[3/2] sm:aspect-[16/7]"
            priority
          />
        </div>

        {/* Strip de stats */}
        <div className="sw-hero-5 relative max-w-3xl mx-auto mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[var(--sw-line)] bg-[var(--sw-line)]">
          {[
            { v: '4', l: 'Acteurs connectés' },
            { v: '3', l: 'Langues' },
            { v: '0 F', l: 'Pour les patients' },
            { v: '100%', l: 'Données sécurisées' },
          ].map(({ v, l }) => (
            <div key={l} className="bg-[var(--sw-surface)] px-6 py-5 text-center">
              <p className="text-2xl font-bold text-[var(--sw-ink)]">{v}</p>
              <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Problèmes ═══════════════════════════════════════════════════ */}
      <section className="py-24 px-5 bg-[var(--sw-surface-2)]">
        <div className="max-w-5xl mx-auto space-y-14">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">Le constat</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)] leading-tight">
              La santé fragmentée,<br />ça coûte du temps et de l'argent.
            </h2>
          </AnimateIn>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                n: '01',
                icon: FileText,
                title: 'Documents éparpillés',
                desc: "Ordonnances chez le médecin, résultats à la maison, courrier de la mutuelle dans un tiroir. Retrouver le bon document prend du temps.",
              },
              {
                n: '02',
                icon: Shield,
                title: 'Prises en charge opaques',
                desc: "Impossible de savoir précisément ce que couvre votre mutuelle, comment faire valoir vos droits, ni où en est votre remboursement.",
              },
              {
                n: '03',
                icon: Pill,
                title: 'Médicaments indisponibles',
                desc: "Vérifier la disponibilité d'un médicament nécessite souvent plusieurs déplacements ou appels avant de trouver la bonne pharmacie.",
              },
            ].map(({ n, icon: Icon, title, desc }, i) => (
              <AnimateIn key={title} delay={i * 80} className="sw-card p-6 space-y-4 hover:shadow-md transition-shadow duration-300">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-3)] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--sw-ink-2)]" />
                  </div>
                  <span className="text-3xl font-black text-[var(--sw-line)] select-none">{n}</span>
                </div>
                <h3 className="font-semibold text-[var(--sw-ink)]">{title}</h3>
                <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Fonctionnalités ═════════════════════════════════════════════ */}
      <section id="fonctionnalites" className="py-24 px-5">
        <div className="max-w-5xl mx-auto space-y-14">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">La solution</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)] leading-tight">
              Tout ce dont vous avez besoin,<br />au même endroit.
            </h2>
          </AnimateIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: FileText,
                color: 'text-[var(--sw-primary)]',
                bg: 'bg-[var(--sw-primary-subtle)]',
                title: 'Dossier médical centralisé',
                desc: 'Consultations, ordonnances, résultats et documents réunis en un profil sécurisé.',
              },
              {
                icon: Calendar,
                color: 'text-[var(--sw-info)]',
                bg: 'bg-[var(--sw-info-bg)]',
                title: 'Rendez-vous intelligents',
                desc: 'Trouvez un professionnel disponible, réservez un créneau, recevez des rappels.',
              },
              {
                icon: Pill,
                color: 'text-[var(--sw-success)]',
                bg: 'bg-[var(--sw-success-bg)]',
                title: 'Réservation de médicaments',
                desc: 'Vérifiez le stock en temps réel, réservez et retirez avec un code unique.',
              },
              {
                icon: Shield,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
                title: 'Tiers payant automatique',
                desc: 'Votre mutuelle est facturée directement. Vous ne payez que votre quote-part.',
              },
              {
                icon: Users,
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                title: 'Espace famille',
                desc: 'Gérez les rendez-vous et ordonnances de toute votre famille depuis un seul compte.',
              },
              {
                icon: Smartphone,
                color: 'text-rose-600',
                bg: 'bg-rose-50',
                title: 'Paiement mobile',
                desc: 'Orange Money, Wave et carte bancaire — paiements adaptés à chaque situation.',
              },
            ].map(({ icon: Icon, color, bg, title, desc }, i) => (
              <AnimateIn key={title} delay={i * 60} className="sw-card p-5 space-y-4 hover:shadow-md transition-shadow duration-300">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-[var(--sw-ink)] text-sm">{title}</h3>
                  <p className="text-xs text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Comment ça marche ═══════════════════════════════════════════ */}
      <section id="comment-ca-marche" className="py-24 px-5 bg-[var(--sw-surface-2)]">
        <div className="max-w-3xl mx-auto space-y-14">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">Démarrer</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)]">Simple en 3 étapes.</h2>
          </AnimateIn>

          <div className="space-y-0 divide-y divide-[var(--sw-line)]">
            {[
              {
                step: '1',
                title: 'Créez votre compte gratuitement',
                desc: "Inscrivez-vous en quelques minutes avec votre numéro de téléphone. Aucune carte bancaire requise, accès immédiat.",
                cta: { label: "Créer mon compte", href: "/inscription" },
              },
              {
                step: '2',
                title: 'Complétez votre profil de santé',
                desc: "Ajoutez votre couverture, vos bénéficiaires et vos informations médicales de base. Vos données restent strictement privées.",
                cta: null,
              },
              {
                step: '3',
                title: 'Accédez à tous vos services',
                desc: "Rendez-vous, ordonnances, médicaments, tiers payant — tout est accessible depuis votre tableau de bord.",
                cta: null,
              },
            ].map(({ step, title, desc, cta }, i) => (
              <AnimateIn key={step} delay={i * 100} className="flex gap-7 py-8 items-start">
                <span className="shrink-0 text-5xl font-black text-[var(--sw-primary-muted)] leading-none select-none w-10 text-right">
                  {step}
                </span>
                <div className="space-y-2 pt-1 flex-1">
                  <h3 className="font-semibold text-[var(--sw-ink)] text-lg">{title}</h3>
                  <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{desc}</p>
                  {cta && (
                    <Link href={cta.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sw-primary)] hover:underline mt-1">
                      {cta.label} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Acteurs ═════════════════════════════════════════════════════ */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto space-y-14">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">Écosystème</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)] leading-tight">
              Une plateforme,<br />quatre espaces dédiés.
            </h2>
            <p className="text-[var(--sw-ink-2)] max-w-xl mx-auto">
              Chaque acteur dispose d'un espace conçu pour son activité, relié au même système.
            </p>
          </AnimateIn>

          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                href: '/inscription?profil=patient',
                icon: Users,
                label: 'Patient',
                color: 'border-t-[var(--sw-primary)] text-[var(--sw-primary)] bg-[var(--sw-primary-subtle)]',
                border: 'border-t-2 border-t-[var(--sw-primary)]',
                badge: 'Gratuit',
                badgeCls: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
                desc: 'Dossier médical, rendez-vous, ordonnances, médicaments et couverture santé.',
                features: ['Dossier de santé centralisé', 'Rendez-vous en ligne', 'Réservation médicaments', 'Espace famille'],
              },
              {
                href: '/inscription?profil=sante',
                icon: Stethoscope,
                label: 'Professionnel & Établissement',
                color: 'text-purple-600 bg-purple-50',
                border: 'border-t-2 border-t-purple-500',
                badge: 'Abonnement',
                badgeCls: 'bg-purple-50 text-purple-700',
                desc: 'Agenda, patients, ordonnances numériques et suivi des prises en charge.',
                features: ['Agenda intelligent', 'Dossiers patients partagés', 'Prescriptions numériques', 'Statistiques activité'],
              },
              {
                href: '/inscription?profil=pharmacie',
                icon: Package,
                label: 'Pharmacie',
                color: 'text-orange-600 bg-orange-50',
                border: 'border-t-2 border-t-orange-500',
                badge: 'Abonnement',
                badgeCls: 'bg-orange-50 text-orange-700',
                desc: 'Catalogue, stock en temps réel, réservations et retraits sécurisés.',
                features: ['Stock en temps réel', 'Traitement des réservations', 'Vérification ordonnances', 'Tableau de bord'],
              },
              {
                href: '/inscription?profil=couverture',
                icon: Building2,
                label: 'Mutuelle / IPM / Assurance',
                color: 'text-green-700 bg-green-50',
                border: 'border-t-2 border-t-green-600',
                badge: 'Abonnement',
                badgeCls: 'bg-green-50 text-green-700',
                desc: 'Adhérents, contrats, prises en charge et paiements des prestataires.',
                features: ['Gestion des adhérents', 'Traitement des demandes', 'Rapports et statistiques', 'Paiements automatisés'],
              },
            ].map(({ href, icon: Icon, label, color, border, badge, badgeCls, desc, features }, i) => (
              <AnimateIn key={label} delay={i * 80}>
                <Link href={href}
                  className={`sw-card p-6 space-y-5 block hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 ${border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeCls}`}>{badge}</span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-[var(--sw-ink)]">{label}</h3>
                    <p className="text-sm text-[var(--sw-ink-2)]">{desc}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-[var(--sw-ink-2)]">
                        <Check className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--sw-primary)]">
                    S'inscrire <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Sécurité ════════════════════════════════════════════════════ */}
      <section className="py-24 px-5 bg-[var(--sw-surface-2)]">
        <div className="max-w-3xl mx-auto space-y-12">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">Confiance</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)] leading-tight">
              Vos données médicales méritent<br />une protection exceptionnelle.
            </h2>
          </AnimateIn>

          <AnimateIn className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
            {[
              { icon: Lock,     text: 'Chiffrement AES-256 de toutes vos données de santé' },
              { icon: Eye,      text: 'Accès strictement limité à votre accord explicite' },
              { icon: Shield,   text: 'Conformité CDPD — réglementation sénégalaise' },
              { icon: BarChart3, text: 'Traçabilité complète des accès à votre dossier' },
              { icon: Lock,     text: 'Authentification à deux facteurs disponible' },
              { icon: Shield,   text: 'Aucune revente ni partage de données personnelles' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[var(--sw-success-bg)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-[var(--sw-success)]" />
                </div>
                <span className="text-sm text-[var(--sw-ink-2)] leading-relaxed">{text}</span>
              </div>
            ))}
          </AnimateIn>
        </div>
      </section>

      {/* ══ FAQ ═════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-5">
        <div className="max-w-2xl mx-auto space-y-10">
          <AnimateIn className="text-center space-y-3">
            <p className="text-xs font-semibold text-[var(--sw-primary)] uppercase tracking-widest">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--sw-ink)]">Questions fréquentes</h2>
          </AnimateIn>

          <AnimateIn className="space-y-2">
            {[
              {
                q: "Séné Wérr est-il gratuit pour les patients ?",
                a: "Oui, l'espace patient est entièrement gratuit — pour toujours. Créez votre compte, gérez vos rendez-vous, consultez vos ordonnances, cherchez des médicaments sans aucun frais.",
              },
              {
                q: "Comment réserver un médicament ?",
                a: "Recherchez le médicament, sélectionnez une pharmacie qui l'a en stock, ajoutez votre ordonnance si nécessaire, et confirmez. Vous recevez un code de retrait à présenter en pharmacie.",
              },
              {
                q: "Qui peut consulter mon dossier de santé ?",
                a: "Vous seul accédez à l'intégralité de votre dossier. Les professionnels voient uniquement ce qui est nécessaire à votre prise en charge, et seulement si vous les y autorisez.",
              },
              {
                q: "Comment suivre une prise en charge mutuelle ?",
                a: "Lors d'une réservation, sélectionnez votre organisme. La demande est transmise automatiquement. Vous êtes notifié dès que l'organisme répond, avec le détail des montants.",
              },
              {
                q: "Peut-on ajouter des membres de sa famille ?",
                a: "Oui. Dans \"Ma famille\", ajoutez vos proches et gérez leurs rendez-vous, ordonnances et réservations depuis votre espace.",
              },
            ].map(({ q, a }) => (
              <details key={q} className="sw-card group overflow-hidden">
                <summary className="flex cursor-pointer items-start justify-between gap-4 p-5 text-sm font-medium text-[var(--sw-ink)] list-none hover:bg-[var(--sw-surface-2)] transition-colors">
                  <span>{q}</span>
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--sw-surface-3)] flex items-center justify-center text-xs text-[var(--sw-ink-3)] group-open:bg-[var(--sw-primary)] group-open:text-white transition-colors mt-0.5">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-2 text-sm text-[var(--sw-ink-2)] leading-relaxed border-t border-[var(--sw-line)]">
                  {a}
                </div>
              </details>
            ))}
          </AnimateIn>

          <AnimateIn className="text-center">
            <Link href="/faq" className="text-sm text-[var(--sw-primary)] font-medium hover:underline">
              Voir toutes les questions →
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* ══ CTA Final ═══════════════════════════════════════════════════ */}
      <section className="py-24 px-5">
        <AnimateIn>
          <div className="max-w-2xl mx-auto rounded-3xl bg-[var(--sw-primary)] p-12 text-center space-y-7">
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              Prêt à simplifier<br />votre parcours de santé ?
            </h2>
            <p className="text-white/60 text-lg">
              Rejoignez les patients, professionnels et pharmacies<br />qui font confiance à Séné Wérr.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/inscription">
                <Button size="lg" className="bg-white text-[var(--sw-ink)] hover:bg-white/90 px-7 h-[48px] text-base font-semibold w-full sm:w-auto">
                  Commencer gratuitement
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="ghost" size="lg" className="text-white/70 hover:text-white hover:bg-white/10 h-[48px] text-base w-full sm:w-auto border border-white/15">
                  Nous contacter
                </Button>
              </Link>
            </div>
            <p className="text-xs text-white/30">
              Aucune carte bancaire · Gratuit pour les patients · Données hébergées au Sénégal
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* ══ Footer ══════════════════════════════════════════════════════ */}
      <footer className="border-t border-[var(--sw-line)] bg-[var(--sw-surface-2)] py-14 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            <div className="lg:col-span-2 space-y-4">
              <Logo size="sm" />
              <p className="text-sm text-[var(--sw-ink-2)] leading-relaxed max-w-xs">
                Plateforme de santé connectée pour les patients, professionnels, pharmacies
                et organismes de couverture au Sénégal.
              </p>
            </div>
            {[
              {
                title: 'Acteurs',
                links: [
                  { href: '/patients', label: 'Patients' },
                  { href: '/pharmacies', label: 'Pharmacies' },
                  { href: '/professionnels', label: 'Professionnels' },
                  { href: '/mutuelles', label: 'Mutuelles & Assurances' },
                ],
              },
              {
                title: 'Plateforme',
                links: [
                  { href: '/fonctionnalites', label: 'Fonctionnalités' },
                  { href: '/comment-ca-marche', label: 'Comment ça marche' },
                  { href: '/tarifs', label: 'Tarifs' },
                  { href: '/a-propos', label: 'À propos' },
                ],
              },
              {
                title: 'Légal',
                links: [
                  { href: '/mentions-legales', label: 'Mentions légales' },
                  { href: '/politique-confidentialite', label: 'Confidentialité' },
                  { href: '/cgu', label: 'CGU' },
                  { href: '/contact', label: 'Contact' },
                ],
              },
            ].map(({ title, links }) => (
              <div key={title} className="space-y-4">
                <h4 className="text-xs font-semibold text-[var(--sw-ink)] uppercase tracking-wider">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)] transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-[var(--sw-line)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--sw-ink-3)]">
              © 2026 Séné Wérr — Tous droits réservés
            </p>
            <div className="flex items-center gap-5">
              {[
                { href: '/?locale=fr', label: 'Français' },
                { href: '/?locale=wo', label: 'Wolof' },
                { href: '/?locale=en', label: 'English' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="text-xs text-[var(--sw-ink-3)] hover:text-[var(--sw-ink)] transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
