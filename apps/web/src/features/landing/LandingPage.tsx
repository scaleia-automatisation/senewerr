/**
 * LandingPage — Séne Wérr
 * Landing SaaS santé premium — multi-acteurs, orientée conversion.
 * Animations via IntersectionObserver. Pas de framer-motion.
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { supabase } from '@/lib/supabase'
import {
  Search, Menu, X, ArrowRight, ChevronDown, ChevronUp,
  Stethoscope, Building2, Pill, Shield, User, Clock,
  FileText, CreditCard, Check, MapPin, Zap, Link2,
  Layers, CheckCircle, Calendar, Star, Bell, HeartPulse,
  ShoppingBag, Sun, Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

// ─── useInView ─────────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ─── NavBar ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Professionnels', href: '#acteurs' },
  { label: 'Médicaments', href: '#medicament' },
  { label: 'Comment ça marche', href: '#comment' },
  { label: 'Tarifs', href: '#gratuit-patients' },
]

function NavBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { toggle } = useTheme()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 64)
    h()
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = (href: string) => {
    setOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header className={cn(
      'fixed inset-x-0 top-0 z-50 transition-all duration-300 bg-surface/94 backdrop-blur-md',
      scrolled ? 'border-b border-line shadow-1' : 'border-b border-line/40',
    )}>
      <div className="mx-auto flex max-w-container items-center justify-between px-s-5 h-14">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-s-2 shrink-0" aria-label="Séne Wérr — accueil">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-sm">
            <HeartPulse className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-h3 font-bold text-ink leading-none">Séne Wérr</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-s-1" aria-label="Navigation principale">
          {NAV_LINKS.map(l => (
            l.href
              ? <button key={l.label} onClick={() => scrollTo(l.href!)}
                  className="px-s-3 py-s-2 text-small font-medium text-ink-2 hover:text-ink hover:bg-surface-2 rounded-md transition-colors">
                  {l.label}
                </button>
              : <Link key={l.label} to={l.to!}
                  className="px-s-3 py-s-2 text-small font-medium text-ink-2 hover:text-ink hover:bg-surface-2 rounded-md transition-colors">
                  {l.label}
                </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-s-2">
          <button onClick={toggle} aria-label="Basculer le thème"
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 transition-colors">
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="hidden h-5 w-5 dark:block" />
          </button>
          <div className="h-5 w-px bg-line mx-s-1" />
          <Link to="/auth/connexion"
            className="px-s-4 py-s-2 text-small font-medium text-ink-2 hover:text-ink hover:bg-surface-2 rounded-md transition-colors">
            Se connecter
          </Link>
          <Link to="/auth/inscription"
            className="px-s-4 py-s-2 text-small font-semibold text-white bg-primary hover:bg-primary-hover rounded-md transition-colors shadow-sm">
            Créer mon compte
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex lg:hidden items-center gap-s-1">
          <button onClick={toggle} aria-label="Basculer le thème"
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 transition-colors">
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="hidden h-5 w-5 dark:block" />
          </button>
          <Link to="/recherche-publique" aria-label="Recherche"
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 transition-colors">
            <Search className="h-5 w-5" />
          </Link>
          <button onClick={() => setOpen(v => !v)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 transition-colors">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu déroulant */}
      <div className={cn(
        'lg:hidden overflow-hidden transition-all duration-300',
        open ? 'max-h-screen' : 'max-h-0',
      )}>
        <div className="bg-surface border-t border-line px-s-5 pb-s-5">
          <nav className="flex flex-col gap-s-1 pt-s-3">
            {NAV_LINKS.map(l => (
              l.href
                ? <button key={l.label} onClick={() => scrollTo(l.href!)}
                    className="text-left px-s-3 py-s-3 text-body font-medium text-ink-2 hover:text-ink hover:bg-surface-2 rounded-md transition-colors">
                    {l.label}
                  </button>
                : <Link key={l.label} to={l.to!} onClick={() => setOpen(false)}
                    className="px-s-3 py-s-3 text-body font-medium text-ink-2 hover:text-ink hover:bg-surface-2 rounded-md transition-colors">
                    {l.label}
                  </Link>
            ))}
          </nav>
          <div className="mt-s-3 flex flex-col gap-s-2 pt-s-3 border-t border-line">
            <Link to="/auth/connexion" onClick={() => setOpen(false)}
              className="w-full py-s-3 text-center text-body font-medium text-ink border border-line rounded-md hover:bg-surface-2 transition-colors">
              Se connecter
            </Link>
            <Link to="/auth/inscription" onClick={() => setOpen(false)}
              className="w-full py-s-3 text-center text-body font-semibold text-white bg-primary hover:bg-primary-hover rounded-md transition-colors">
              Créer mon compte gratuitement
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Bouton scroll-to-top ───────────────────────────────────────────────────

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const h = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut de la page"
      className={cn(
        'fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full bg-primary text-white shadow-lg',
        'flex items-center justify-center',
        'hover:bg-primary-hover hover:shadow-xl hover:-translate-y-0.5',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none',
      )}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function HeroSection() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'med' | 'pro'>('med')
  const [query, setQuery] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tab === 'med') navigate(`/recherche-publique?q=${encodeURIComponent(query)}&type=medicament`)
    else navigate(`/recherche-publique?q=${encodeURIComponent(query)}&type=pro`)
  }

  return (
    <section className="sw-hero-bg relative min-h-screen flex flex-col justify-center overflow-hidden pt-20 pb-16 lg:pb-24">
      <style>{`
        .sw-hero-bg {
          background: linear-gradient(158deg, #F0FBFD 0%, #FFFFFF 38%, #F0FAF1 72%, #EAF7F9 100%);
        }
        .dark .sw-hero-bg {
          background: linear-gradient(158deg, #071520 0%, #0c2130 38%, #061308 72%, #081828 100%);
        }
      `}</style>
      {/* Couches décoratives */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -right-24 w-[640px] h-[640px] rounded-full blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(28,134,40,0.13) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-[520px] h-[520px] rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgba(20,126,134,0.11) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(28,134,40,0.07) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'linear-gradient(rgba(21,63,84,.25) 1px,transparent 1px),linear-gradient(90deg,rgba(21,63,84,.25) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      <div className="relative mx-auto max-w-container px-s-5 text-center">
        {/* Pill badge */}
        <div className="mb-s-6 inline-flex items-center gap-s-2 rounded-pill bg-primary-soft px-s-4 py-s-2 text-small text-primary border border-primary/20">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          Plateforme de santé sénégalaise
        </div>

        {/* H1 */}
        <h1 className="font-display text-display font-bold text-ink leading-tight tracking-tight mb-s-5 max-w-4xl mx-auto">
          Votre santé{' '}
          <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            connectée
          </span>{' '}
          et centralisée.
        </h1>

        {/* Sous-titre */}
        <p className="text-body text-ink-2 max-w-2xl mx-auto mb-s-8 leading-relaxed">
          Trouvez un professionnel, prenez rendez-vous, retrouvez vos ordonnances,
          localisez vos médicaments et gérez votre mutuelle — depuis un seul espace.
        </p>

        {/* Moteur de recherche */}
        <div className="mx-auto max-w-2xl mb-s-6">
          <div className="bg-white dark:bg-white rounded-xl border border-line shadow-2 overflow-hidden">
            {/* Onglets */}
            <div className="flex border-b border-line">
              {(['med', 'pro'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-s-3 text-small font-semibold transition-all duration-200',
                    tab === t
                      ? 'text-white bg-accent'
                      : 'text-accent bg-white dark:bg-white hover:bg-accent/10',
                  )}>
                  {t === 'med' ? '💊 Trouver un médicament' : '🩺 Trouver un professionnel'}
                </button>
              ))}
            </div>
            {/* Champ */}
            <form onSubmit={submit} className="flex items-center gap-s-3 p-s-3">
              <Search className="ml-s-2 h-5 w-5 text-ink-3 dark:text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={tab === 'med' ? 'Ex: Doliprane 1000 mg…' : 'Ex: Cardiologue Dakar…'}
                className="flex-1 text-body text-ink dark:text-gray-900 placeholder:text-ink-3 dark:placeholder:text-gray-400 bg-transparent outline-none"
                aria-label={tab === 'med' ? 'Rechercher un médicament' : 'Rechercher un professionnel'}
              />
              <button type="submit"
                className="shrink-0 px-s-5 py-s-3 bg-primary hover:bg-primary-hover text-white text-small font-semibold rounded-lg transition-colors">
                {tab === 'med' ? 'Trouver' : 'Rechercher'}
              </button>
            </form>
          </div>
        </div>

        {/* Réassurance inline */}
        <p className="text-micro text-ink-3">
          Recherche gratuite · Sans inscription · Disponibilités locales · Réseau de pharmacies
        </p>

        {/* Stats */}
        <div className="mt-s-10 grid grid-cols-2 gap-s-4 sm:grid-cols-4 max-w-2xl mx-auto">
          {[
            { n: '500+', label: 'Professionnels' },
            { n: '120+', label: 'Pharmacies' },
            { n: '5', label: "Types d'acteurs" },
            { n: '100%', label: 'Gratuit patients' },
          ].map(({ n, label }) => (
            <div key={label} className="rounded-xl bg-surface border border-line px-s-4 py-s-4 shadow-1">
              <p className="font-display text-h1 font-bold text-ink leading-none">{n}</p>
              <p className="mt-s-1 text-micro text-ink-2">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-s-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-s-1 text-ink-3/60">
        <span className="text-micro">Découvrir</span>
        <ChevronDown className="h-4 w-4 animate-bounce" />
      </div>
    </section>
  )
}

// ─── Logos acteurs ──────────────────────────────────────────────────────────

function EcosystemBar() {
  const actors = [
    { icon: User,        label: 'Patients',         color: 'text-primary',  bg: 'bg-primary-soft' },
    { icon: Stethoscope, label: 'Médecins',          color: 'text-accent',   bg: 'bg-accent-soft'  },
    { icon: Building2,   label: 'Établissements',    color: 'text-navy',     bg: 'bg-navy-soft'    },
    { icon: Pill,        label: 'Pharmacies',        color: 'text-cyan',     bg: 'bg-accent-soft'  },
    { icon: Shield,      label: 'Mutuelles',         color: 'text-primary',  bg: 'bg-primary-soft' },
  ]
  return (
    <section className="bg-surface border-b border-line py-s-6">
      <div className="mx-auto max-w-container px-s-5">
        <p className="text-center text-small text-ink-3 mb-s-5 uppercase tracking-widest font-medium">
          Tous connectés au même écosystème
        </p>
        <div className="flex flex-wrap justify-center gap-s-3 sm:gap-s-5">
          {actors.map(a => (
            <div key={a.label} className="flex items-center gap-s-2 px-s-4 py-s-2 rounded-pill border border-line bg-bg">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', a.bg)}>
                <a.icon className={cn('h-3.5 w-3.5', a.color)} />
              </span>
              <span className="text-small font-medium text-ink">{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Logos partenaires ──────────────────────────────────────────────────────

function TrustedBySection() {
  const logos = [
    { initials: 'HP',  name: 'Hôpital Principal de Dakar',          bg: 'bg-accent-soft',  dot: 'text-accent',   logo: '/logos/hopital-principal.svg' },
    { initials: 'CCV', name: 'Clinique du Cap-Vert',                 bg: 'bg-primary-soft', dot: 'text-primary',  logo: '/logos/clinique-cap-vert.svg' },
    { initials: 'IG',  name: 'IGSAS',                               bg: 'bg-accent-soft',  dot: 'text-accent',   logo: '/logos/ipm-mse.jpg' },
    { initials: 'IPM', name: 'IPM Sénégal',                         bg: 'bg-primary-soft', dot: 'text-primary',  logo: '/logos/ipm-mse.jpg' },
    { initials: 'KMS', name: 'Keur Massar Santé',                    bg: 'bg-accent-soft',  dot: 'text-accent',   logo: '/logos/keur-massar-sante.svg' },
    { initials: 'PG',  name: 'Pharmacie Guigon',                     bg: 'bg-primary-soft', dot: 'text-primary',  logo: '/logos/chr-saint-louis.png' },
    { initials: 'LP',  name: 'Laboratoire Pasteur',                  bg: 'bg-accent-soft',  dot: 'text-accent',   logo: '/logos/laboratoire-pasteur.svg' },
    { initials: 'PE',  name: "Polyclinique de l'Étoile",             bg: 'bg-primary-soft', dot: 'text-primary',  logo: '/logos/polyclinique-etoile.svg' },
    { initials: 'MSF', name: 'Mutuelle de Santé des Fonctionnaires', bg: 'bg-accent-soft',  dot: 'text-accent',   logo: '/logos/ipm-mse.jpg' },
    { initials: 'CMR', name: 'Centre Médical de Rufisque',           bg: 'bg-primary-soft', dot: 'text-primary',  logo: '/logos/centre-medical-rufisque.svg' },
  ]
  const track = [...logos, ...logos]
  return (
    <section className="bg-surface border-y border-line py-s-4 overflow-hidden">
      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <p className="text-center text-small text-ink-3 mb-s-5 uppercase tracking-widest font-medium">
        Ils nous font déjà confiance
      </p>
      <div className="relative">
        <div
          className="flex gap-s-5"
          style={{ animation: 'marquee-scroll 28s linear infinite', width: 'max-content' }}
        >
          {track.map((l, i) => (
            <div
              key={i}
              title={l.name}
              className="h-24 w-28 rounded-xl border border-line bg-bg flex flex-col items-center justify-center gap-1.5 py-3 px-2 shrink-0 shadow-sm"
            >
              {l.logo && (
                <img
                  src={l.logo}
                  alt={l.name}
                  className="h-9 w-20 rounded-md object-contain shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                    const fb = (e.target as HTMLImageElement).nextElementSibling
                    if (fb) fb.classList.remove('hidden')
                  }}
                />
              )}
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-md flex-shrink-0', l.bg, l.dot, l.logo ? 'hidden' : '')}>
                <span className="text-micro font-bold leading-none">{l.initials.slice(0, 2)}</span>
              </span>
              <span className="text-[10px] font-semibold text-ink text-center leading-tight line-clamp-2">{l.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section Problème ───────────────────────────────────────────────────────

function ProblemSection() {
  const { ref, visible } = useInView()
  const cards = [
    { icon: MapPin,    color: 'text-accent bg-accent-soft',   title: 'Trouver un professionnel',  desc: 'Disponibilités difficiles à connaître, informations éparpillées.' },
    { icon: FileText,  color: 'text-primary bg-primary-soft', title: 'Gérer ses ordonnances',     desc: 'Documents perdus, difficiles à retrouver ou à transmettre.' },
    { icon: Pill,      color: 'text-cyan bg-accent-soft',     title: 'Localiser un médicament',   desc: 'Appels à répétition dans plusieurs pharmacies sans résultat.' },
    { icon: CreditCard,color: 'text-navy bg-navy-soft',       title: 'Suivre sa mutuelle',        desc: 'Prises en charge et remboursements impossibles à piloter.' },
  ]
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <div className={cn('text-center mb-s-8 transition-all duration-700', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}>
          <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Le constat</p>
          <h2 className="font-display text-h1 font-bold text-ink max-w-2xl mx-auto">
            Votre parcours de santé est encore trop dispersé.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-s-4">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <div className="group h-full rounded-xl border border-line bg-surface p-s-5 hover:shadow-2 transition-shadow">
                <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg mb-s-4', c.color)}>
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-h3 font-semibold text-ink mb-s-2">{c.title}</h3>
                <p className="text-small text-ink-2 leading-relaxed">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-s-8 rounded-xl bg-gradient-to-r from-navy to-accent p-px">
            <div className="rounded-[11px] bg-surface px-s-6 py-s-5 text-center">
              <p className="font-display text-h2 font-bold text-ink">
                Séne Wérr réunit tout cela{' '}
                <span className="text-primary">au même endroit.</span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Solution — Timeline ────────────────────────────────────────────────────

function SolutionSection() {
  const steps = [
    { n: '01', label: 'Trouver',         icon: Search },
    { n: '02', label: 'Réserver',        icon: Calendar },
    { n: '03', label: 'Consulter',       icon: Stethoscope },
    { n: '04', label: 'Ordonnance',      icon: FileText },
    { n: '05', label: 'Médicament',      icon: Pill },
    { n: '06', label: 'Réservation',     icon: ShoppingBag },
    { n: '07', label: 'Mutuelle',        icon: Shield },
    { n: '08', label: 'Paiement',        icon: CreditCard },
    { n: '09', label: 'Retrait',         icon: Check },
  ]
  return (
    <section id="comment" className="bg-surface py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-16">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">La solution</p>
            <h2 className="font-display text-h1 font-bold text-ink">Un seul espace pour tout votre parcours.</h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-xl mx-auto">
              De la prise de rendez-vous jusqu'au retrait en pharmacie, Séne Wérr connecte chaque étape.
            </p>
          </div>
        </Reveal>

        {/* Timeline desktop */}
        <div className="hidden lg:block relative">
          <div className="absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-primary/20 via-accent to-primary/20" />
          <div className="grid grid-cols-9 gap-s-2">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 50}>
                <div className="flex flex-col items-center text-center">
                  <div className={cn(
                    'relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 mb-s-3 transition-all duration-300',
                    i < 3
                      ? 'border-primary bg-primary-soft'
                      : i < 6
                        ? 'border-accent bg-accent-soft'
                        : 'border-navy bg-navy-soft',
                  )}>
                    <s.icon className={cn('h-6 w-6', i < 3 ? 'text-primary' : i < 6 ? 'text-accent' : 'text-navy')} />
                  </div>
                  <span className="text-micro font-bold text-ink-3">{s.n}</span>
                  <span className="text-micro font-semibold text-ink mt-s-1 leading-tight">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Timeline mobile — vertical */}
        <div className="lg:hidden space-y-s-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 40}>
              <div className="flex items-center gap-s-4 rounded-lg border border-line bg-bg px-s-4 py-s-3">
                <span className="font-display text-h3 font-bold text-primary/30 w-8 shrink-0">{s.n}</span>
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  i < 3 ? 'bg-primary-soft' : i < 6 ? 'bg-accent-soft' : 'bg-navy-soft',
                )}>
                  <s.icon className={cn('h-4 w-4', i < 3 ? 'text-primary' : i < 6 ? 'text-accent' : 'text-navy')} />
                </span>
                <span className="text-body font-medium text-ink">{s.label}</span>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-s-8 text-center">
            <Link to="/auth/inscription"
              className="inline-flex items-center gap-s-2 px-s-6 py-s-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors shadow-sm">
              Commencer gratuitement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Patient Features ───────────────────────────────────────────────────────

function PatientSection() {
  const features = [
    { icon: Search,      color: 'text-accent bg-accent-soft',   title: 'Trouver un professionnel',  desc: 'Par spécialité, localisation, disponibilité ou établissement.' },
    { icon: Calendar,    color: 'text-primary bg-primary-soft', title: 'Prendre rendez-vous',        desc: 'Choisissez votre créneau et confirmez en quelques secondes.' },
    { icon: FileText,    color: 'text-cyan bg-accent-soft',     title: 'Mes ordonnances',            desc: 'Retrouvez toutes vos ordonnances au même endroit.' },
    { icon: Pill,        color: 'text-accent bg-accent-soft',   title: 'Trouver un médicament',     desc: 'Localisez les pharmacies où votre médicament est disponible.' },
    { icon: ShoppingBag, color: 'text-primary bg-primary-soft', title: 'Réserver en pharmacie',     desc: 'Réservez votre médicament depuis votre espace patient.' },
    { icon: Shield,      color: 'text-navy bg-navy-soft',       title: 'Ma mutuelle',               desc: 'Retrouvez votre couverture et vos prises en charge.' },
    { icon: CreditCard,  color: 'text-primary bg-primary-soft', title: 'Mes paiements',             desc: 'Suivez vos paiements et vos remboursements en temps réel.' },
    { icon: Clock,       color: 'text-accent bg-accent-soft',   title: 'Mon historique',            desc: "Votre parcours de santé complet, toujours accessible." },
  ]
  return (
    <section id="patient" className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-16">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Pour les patients</p>
            <h2 className="font-display text-h1 font-bold text-ink">Tout ce dont vous avez besoin,<br className="hidden sm:block" /> au même endroit.</h2>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-s-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="h-full rounded-xl border border-line bg-surface p-s-5 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-200">
                <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg mb-s-4', f.color)}>
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-small font-semibold text-ink mb-s-1">{f.title}</h3>
                <p className="text-small text-ink-2 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={300}>
          <div className="mt-s-8 text-center">
            <Link to="/auth/inscription"
              className="inline-flex items-center gap-s-2 px-s-6 py-s-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors">
              Créer mon compte gratuitement
            </Link>
            <p className="mt-s-2 text-micro text-ink-3">Aucune carte bancaire requise.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Les 5 acteurs ──────────────────────────────────────────────────────────

function ActorsSection() {
  const actors = [
    {
      icon: User,
      color: 'text-primary', bg: 'bg-primary-soft', border: 'border-primary/20',
      title: 'Patients',
      desc: 'Accédez gratuitement à toutes les fonctionnalités de suivi de votre santé.',
      features: ['Rendez-vous en ligne', 'Ordonnances numériques', 'Réservations pharmacie', 'Suivi mutuelle'],
      cta: 'Créer mon compte gratuitement',
      role: 'patient',
    },
    {
      icon: Stethoscope,
      color: 'text-accent', bg: 'bg-accent-soft', border: 'border-accent/20',
      title: 'Professionnels de santé',
      desc: 'Gérez votre agenda, vos consultations, vos ordonnances et vos patients depuis un seul espace.',
      features: ['Agenda intelligent multi-sites', 'Consultations & ordonnances', "Statistiques d'activité", 'Plusieurs établissements'],
      cta: 'Créer mon espace professionnel',
      role: 'professional',
    },
    {
      icon: Building2,
      color: 'text-primary', bg: 'bg-primary-soft', border: 'border-primary/20',
      title: 'Cabinets & établissements',
      desc: 'Centralisez vos professionnels, vos plannings, vos rendez-vous et vos statistiques.',
      features: ["Gestion d'équipe", 'Planning multi-praticiens', 'Secrétariat intégré', 'Statistiques avancées'],
      cta: 'Inscrire mon établissement',
      role: 'establishment',
    },
    {
      icon: Pill,
      color: 'text-cyan', bg: 'bg-accent-soft', border: 'border-cyan/20',
      title: 'Pharmacies',
      desc: 'Soyez visible, gérez vos stocks, recevez des réservations et suivez vos paiements.',
      features: ['Catalogue & disponibilités', 'Réservations patients', 'Vérification ordonnances', 'Tableau de bord paiements'],
      cta: 'Inscrire ma pharmacie',
      role: 'pharmacy',
    },
    {
      icon: Shield,
      color: 'text-navy', bg: 'bg-navy-soft', border: 'border-navy/20',
      title: 'Mutuelles',
      desc: 'Simplifiez la gestion de vos assurés, vos prises en charge et vos paiements.',
      features: ['Gestion des assurés', 'Prises en charge', 'Validation & paiements', 'Reporting & historique'],
      cta: 'Inscrire ma mutuelle',
      role: 'insurance',
    },
  ]

  const renderCard = (a: typeof actors[number], i: number) => (
    <Reveal key={a.title} delay={i * 70}>
      <div className={cn('h-full rounded-xl border bg-bg p-s-6 hover:shadow-2 transition-all duration-200 flex flex-col', a.border)}>
        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl mb-s-4', a.bg)}>
          <a.icon className={cn('h-5 w-5', a.color)} />
        </span>
        <h3 className="font-display text-h3 font-bold text-ink mb-s-2">{a.title}</h3>
        <p className="text-small text-ink-2 mb-s-4 leading-relaxed">{a.desc}</p>
        <ul className="space-y-s-2 mb-s-5 flex-1">
          {a.features.map(f => (
            <li key={f} className="flex items-start gap-s-2 text-small text-ink-2">
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
        <Link to={`/auth/inscription?role=${a.role}`}
          className="w-full py-s-3 px-s-4 text-center text-small font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-sm">
          {a.cta}
        </Link>
      </div>
    </Reveal>
  )

  return (
    <section id="acteurs" className="bg-surface py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-16">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">L'écosystème</p>
            <h2 className="font-display text-h1 font-bold text-ink">Un écosystème de santé<br className="hidden sm:block" /> enfin connecté.</h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-xl mx-auto">
              Chaque acteur dispose de son propre espace, ses outils et les bonnes informations au bon moment.
            </p>
          </div>
        </Reveal>
        {/* Ligne 1 : 3 premières cartes */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-s-4">
          {actors.slice(0, 3).map((a, i) => renderCard(a, i))}
        </div>
        {/* Ligne 2 : 2 dernières cartes centrées */}
        <div className="grid sm:grid-cols-2 gap-s-4 mt-s-4 lg:w-2/3 lg:mx-auto">
          {actors.slice(3).map((a, i) => renderCard(a, i + 3))}
        </div>
      </div>
    </section>
  )
}

// ─── Section Professionnel ──────────────────────────────────────────────────

function ProfessionalSection() {
  return (
    <section id="pro" className="bg-bg py-s-8 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-container px-s-5">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          <Reveal>
            <div>
              <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Pour les professionnels</p>
              <h2 className="font-display text-h1 font-bold text-ink mb-s-4">
                Votre activité de santé,<br /> enfin centralisée.
              </h2>
              <p className="text-body text-ink-2 mb-s-6 leading-relaxed">
                Que vous exerciez dans un cabinet, une clinique, un hôpital ou plusieurs établissements,
                Séne Wérr vous permet de gérer toute votre activité depuis un seul espace.
              </p>
              <ul className="space-y-s-3 mb-s-7">
                {[
                  "Agenda intelligent adapté à vos lieux d'exercice",
                  'Consultations, ordonnances et documents centralisés',
                  "Statistiques d'activité en temps réel",
                  'Collaboration avec les pharmacies et mutuelles',
                ].map(f => (
                  <li key={f} className="flex items-start gap-s-3 text-body text-ink-2">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/inscription?role=professional"
                className="inline-flex items-center gap-s-2 px-s-6 py-s-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors">
                Créer mon espace professionnel <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          {/* Mockup agenda multi-sites */}
          <Reveal delay={150}>
            <div className="mt-s-8 lg:mt-0 rounded-2xl border border-line bg-surface shadow-2 overflow-hidden">
              {/* Header mockup */}
              <div className="bg-[#153F54] px-s-5 py-s-4 flex items-center justify-between">
                <span className="text-small font-semibold text-white">Mon agenda — Lundi 18 sept.</span>
                <span className="text-micro text-white/50">3 lieux</span>
              </div>
              {/* Créneaux */}
              <div className="p-s-4 space-y-s-3">
                {[
                  { time: '09:00 – 12:00', lieu: 'Clinique Pasteur', badge: 'bg-accent-soft text-accent', nb: '4 RDV' },
                  { time: '14:00 – 17:00', lieu: 'Hôpital Principal', badge: 'bg-primary-soft text-primary', nb: '3 RDV' },
                  { time: '18:00 – 20:00', lieu: 'Cabinet privé', badge: 'bg-navy-soft text-navy', nb: '2 RDV' },
                ].map(s => (
                  <div key={s.lieu} className="flex items-center gap-s-3 rounded-lg border border-line bg-bg p-s-3">
                    <div className="text-right shrink-0">
                      <p className="text-micro font-bold text-ink">{s.time}</p>
                    </div>
                    <div className="w-px h-8 bg-line shrink-0" />
                    <div className="flex-1">
                      <p className="text-small font-semibold text-ink">{s.lieu}</p>
                    </div>
                    <span className={cn('text-micro font-semibold px-s-2 py-1 rounded-pill', s.badge)}>
                      {s.nb}
                    </span>
                  </div>
                ))}
                <p className="text-center text-micro font-semibold text-primary py-s-1">
                  Un seul agenda · Tous vos lieux d'exercice.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── Section Médicament ─────────────────────────────────────────────────────

function MedicineSection() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [showModal, setShowModal] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/recherche-publique?q=${encodeURIComponent(q)}&type=medicament`)
  }

  return (
    <section id="medicament" className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-12">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Recherche médicament</p>
            <h2 className="font-display text-h1 font-bold text-ink">
              Trouvez rapidement où votre<br className="hidden sm:block" /> médicament est disponible.
            </h2>
            <p className="mt-s-3 text-body text-ink-2">Recherche gratuite et sans inscription.</p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="mx-auto max-w-2xl">
            {/* Barre de recherche */}
            <form onSubmit={submit} className="flex items-center gap-s-3 rounded-xl border border-line bg-surface p-s-3 shadow-2 mb-s-6">
              <Search className="ml-s-2 h-5 w-5 text-ink-3 shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Ex : Doliprane 1000 mg, Amoxicilline…"
                className="flex-1 text-body text-ink placeholder:text-ink-3 bg-transparent outline-none" />
              <button type="submit"
                className="shrink-0 px-s-5 py-s-3 bg-primary hover:bg-primary-hover text-white text-small font-semibold rounded-lg transition-colors">
                Trouver
              </button>
            </form>

            {/* Résultat exemple */}
            <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-1">
              <div className="px-s-5 py-s-3 border-b border-line bg-bg flex items-center justify-between">
                <span className="text-small font-semibold text-ink">Doliprane 1000 mg — 3 pharmacies trouvées</span>
                <span className="text-micro text-ink-3">Exemple de résultat</span>
              </div>
              {[
                { name: 'Pharmacie Mermoz', zone: 'Mermoz, Dakar', dist: '8 min', open: true },
                { name: 'Pharmacie Almadies', zone: 'Almadies, Dakar', dist: '14 min', open: true },
                { name: 'Pharmacie Plateau', zone: 'Plateau, Dakar', dist: '22 min', open: false },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between px-s-5 py-s-4 border-b border-line last:border-0 gap-s-3">
                  <div>
                    <p className="text-body font-semibold text-ink">{p.name}</p>
                    <p className="text-micro text-ink-3">{p.zone} · {p.dist}</p>
                  </div>
                  <div className="flex items-center gap-s-2 shrink-0">
                    <span className={cn('text-micro font-semibold px-s-2 py-1 rounded-pill', p.open ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-3')}>
                      {p.open ? '● Ouvert' : '○ Fermé'}
                    </span>
                    <button onClick={() => setShowModal(true)}
                      className="px-s-3 py-s-2 text-micro font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent-soft transition-colors">
                      Voir le prix
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-s-3 text-center text-micro text-ink-3">
              Recherche gratuite · Prix disponible après connexion · Réservation depuis votre compte
            </p>
          </div>
        </Reveal>
      </div>

      {/* Modale prix */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-s-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-surface p-s-6 shadow-2 text-center" onClick={e => e.stopPropagation()}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft mx-auto mb-s-4">
              <Pill className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-h2 font-bold text-ink mb-s-2">Le prix est dans votre espace</h3>
            <p className="text-small text-ink-2 mb-s-5 leading-relaxed">
              Créez gratuitement votre compte Séne Wérr pour voir le prix et réserver votre médicament.
            </p>
            <div className="flex flex-col gap-s-2">
              <Link to="/auth/inscription" onClick={() => setShowModal(false)}
                className="w-full py-s-3 bg-primary hover:bg-primary-hover text-white text-small font-semibold rounded-lg transition-colors">
                Créer mon compte gratuitement
              </Link>
              <Link to="/auth/connexion" onClick={() => setShowModal(false)}
                className="w-full py-s-3 border border-line text-small font-semibold text-ink-2 rounded-lg hover:bg-surface-2 transition-colors">
                Se connecter
              </Link>
            </div>
            <p className="mt-s-4 text-micro text-ink-3">Aucun abonnement patient.</p>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Dashboard Preview ──────────────────────────────────────────────────────

function DashboardPreview() {
  return (
    <section className="bg-surface py-s-8 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-12">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Votre espace</p>
            <h2 className="font-display text-h1 font-bold text-ink">Votre santé, toujours avec vous.</h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-lg mx-auto">
              Tout ce dont vous avez besoin, accessible depuis votre espace personnel.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-bg shadow-2 overflow-hidden">
            {/* Top bar */}
            <div className="bg-[#153F54] px-s-5 py-s-4 flex items-center justify-between">
              <div className="flex items-center gap-s-3">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-small font-semibold text-white">Bonjour, Aminata 👋</p>
                  <p className="text-micro text-white/50">Patient · Dakar</p>
                </div>
              </div>
              <Bell className="h-5 w-5 text-white/40" />
            </div>
            {/* Cards grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-s-3 p-s-4">
              {[
                { label: 'Prochain RDV', value: 'Dr. Ndiaye', sub: '18 sept. — 15h00', badge: 'Confirmé', badgeColor: 'bg-primary-soft text-primary', icon: Calendar, iconColor: 'text-accent bg-accent-soft' },
                { label: 'Ma réservation', value: 'Pharmacie Mermoz', sub: 'Doliprane 1000 mg', badge: 'En préparation', badgeColor: 'bg-amber-50 text-amber-700', icon: ShoppingBag, iconColor: 'text-primary bg-primary-soft' },
                { label: 'Mon ordonnance', value: 'ORD-458721', sub: 'Dr. Ndiaye · 15 sept.', badge: 'Active', badgeColor: 'bg-accent-soft text-accent', icon: FileText, iconColor: 'text-accent bg-accent-soft' },
                { label: 'Ma mutuelle', value: 'IPMCAS', sub: 'Couverture famille', badge: 'Valide', badgeColor: 'bg-primary-soft text-primary', icon: Shield, iconColor: 'text-navy bg-navy-soft' },
                { label: 'Mon paiement', value: '4 000 FCFA', sub: 'Réservation pharmacie', badge: 'Réglé', badgeColor: 'bg-primary-soft text-primary', icon: CreditCard, iconColor: 'text-primary bg-primary-soft' },
                { label: 'Mon historique', value: '12 consultations', sub: 'Depuis janvier 2026', badge: 'À jour', badgeColor: 'bg-surface-2 text-ink-3', icon: Clock, iconColor: 'text-ink-3 bg-surface-2' },
              ].map(c => (
                <div key={c.label} className="rounded-xl border border-line bg-surface p-s-4">
                  <div className="flex items-start justify-between mb-s-3">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', c.iconColor)}>
                      <c.icon className="h-4 w-4" />
                    </span>
                    <span className={cn('text-micro font-semibold px-s-2 py-0.5 rounded-pill', c.badgeColor)}>
                      {c.badge}
                    </span>
                  </div>
                  <p className="text-micro text-ink-3 mb-s-1">{c.label}</p>
                  <p className="text-small font-bold text-ink leading-tight">{c.value}</p>
                  <p className="text-micro text-ink-3 mt-s-1">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={200}>
          <div className="mt-s-7 text-center">
            <Link to="/auth/inscription"
              className="inline-flex items-center gap-s-2 px-s-6 py-s-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors">
              Créer mon espace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Sécurité ───────────────────────────────────────────────────────────────

function SecuritySection() {
  const items = [
    'Accès contrôlé selon votre rôle',
    'Documents médicaux privés et protégés',
    'Historique complet des actions',
    'Chaque acteur voit uniquement ses données',
    'Gestion fine des permissions',
  ]
  return (
    <section id="securite" className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          <Reveal>
            <div className="rounded-2xl border border-line bg-surface p-s-6 shadow-2">
              <div className="flex items-center gap-s-3 mb-s-5">
                <div className="h-10 w-10 rounded-xl bg-primary-soft flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-small font-bold text-ink">Protection des données</p>
                  <p className="text-micro text-ink-3">Conforme aux standards</p>
                </div>
              </div>
              <div className="space-y-s-3">
                {items.map(it => (
                  <div key={it} className="flex items-center gap-s-3 rounded-lg bg-bg border border-line px-s-4 py-s-3">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-small text-ink">{it}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-s-8 lg:mt-0">
              <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Sécurité & confidentialité</p>
              <h2 className="font-display text-h1 font-bold text-ink mb-s-4">
                Vos informations méritent une protection particulière.
              </h2>
              <p className="text-body text-ink-2 leading-relaxed">
                Séne Wérr est conçu avec des accès contrôlés selon le rôle de chaque utilisateur.
                Chaque acteur ne voit que les informations nécessaires à son activité.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── Pourquoi Séne Wérr ─────────────────────────────────────────────────────

function WhySection() {
  const cards = [
    { icon: Zap,   color: 'text-primary bg-primary-soft', title: 'Simple',     desc: "Une seule application au lieu de plusieurs services dispersés." },
    { icon: Link2, color: 'text-accent bg-accent-soft',   title: 'Connecté',   desc: "Les bons acteurs travaillent autour du même parcours patient." },
    { icon: MapPin,color: 'text-navy bg-navy-soft',       title: 'Local',      desc: "Pensé pour les réalités du système de santé sénégalais." },
    { icon: Layers,color: 'text-cyan bg-accent-soft',     title: 'Centralisé', desc: "Rendez-vous, ordonnances, pharmacies, mutuelle réunis au même endroit." },
  ]
  return (
    <section className="bg-surface py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-12">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Nos engagements</p>
            <h2 className="font-display text-h1 font-bold text-ink">Pourquoi choisir Séne Wérr ?</h2>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-s-4">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              <div className="h-full rounded-xl border border-line bg-bg p-s-6 text-center hover:shadow-2 transition-shadow">
                <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-s-4', c.color)}>
                  <c.icon className="h-6 w-6" />
                </span>
                <h3 className="font-display text-h3 font-bold text-ink mb-s-2">{c.title}</h3>
                <p className="text-small text-ink-2 leading-relaxed">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Témoignages ────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      initials: 'AF', bg: 'bg-primary-soft', color: 'text-primary',
      name: 'Aminata Fall', role: 'Patiente, Dakar', stars: 5,
      text: "Grâce à Séne Wérr, j'ai trouvé un cardiologue disponible le lendemain et pris rendez-vous en deux minutes. Mon ordonnance était directement dans mon espace après la consultation. Je n'ai plus besoin de courir partout.",
    },
    {
      initials: 'MN', bg: 'bg-accent-soft', color: 'text-accent',
      name: 'Dr. Moussa Ndiaye', role: 'Médecin généraliste, Thiès', stars: 5,
      text: "Gérer mon agenda sur trois sites différents était un cauchemar. Depuis que j'utilise Séne Wérr, je vois tous mes rendez-vous en un seul endroit et je peux générer les ordonnances directement depuis la consultation. Un gain de temps énorme.",
    },
    {
      initials: 'SO', bg: 'bg-navy-soft', color: 'text-navy',
      name: 'Seydou Ouédraogo', role: 'Patient, Saint-Louis', stars: 4,
      text: "J'avais du mal à trouver la Metformine dans ma ville. Avec Séne Wérr, j'ai localisé la pharmacie qui l'avait en stock en quelques secondes et j'ai réservé sans même me déplacer inutilement.",
    },
    {
      initials: 'RD', bg: 'bg-primary-soft', color: 'text-primary',
      name: 'Rokhaya Diallo', role: 'Pharmacienne, Almadies', stars: 5,
      text: "Notre pharmacie reçoit maintenant des réservations en ligne et nos clients arrivent en sachant que leur médicament est prêt. La gestion des ordonnances numériques a simplifié tout notre flux de travail quotidien.",
    },
    {
      initials: 'IB', bg: 'bg-accent-soft', color: 'text-accent',
      name: 'Ibrahima Ba', role: 'Patient, Ziguinchor', stars: 5,
      text: "Ma mutuelle est maintenant liée à mon compte Séne Wérr. Je vois en temps réel ce qui est pris en charge et ce que je dois payer. Fini les mauvaises surprises à la caisse de la clinique.",
    },
    {
      initials: 'FT', bg: 'bg-navy-soft', color: 'text-navy',
      name: 'Dr. Fatou Touré', role: 'Pédiatre, Hôpital de Fann', stars: 5,
      text: "La plateforme est vraiment pensée pour le contexte sénégalais. Je peux suivre mes patients entre plusieurs consultations, voir leur historique complet et collaborer facilement avec les pharmacies du quartier.",
    },
  ]
  return (
    <section className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-8 lg:mb-12">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">Témoignages</p>
            <h2 className="font-display text-h1 font-bold text-ink">Ce qu'ils en disent.</h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-xl mx-auto">
              Patients, médecins et pharmaciens partagent leur expérience avec Séne Wérr.
            </p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-s-4">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 70}>
              <div className="h-full flex flex-col rounded-xl border border-line bg-surface p-s-5 hover:shadow-2 transition-shadow">
                <div className="flex items-center gap-s-3 mb-s-4">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-full font-bold text-small flex-shrink-0', t.bg, t.color)}>
                    {t.initials}
                  </span>
                  <div>
                    <p className="text-body font-semibold text-ink leading-tight">{t.name}</p>
                    <p className="text-micro text-ink-3">{t.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-s-1 mb-s-3">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className={cn('h-3.5 w-3.5', s < t.stars ? 'fill-primary text-primary' : 'fill-surface-2 text-line')} />
                  ))}
                </div>
                <p className="text-small text-ink-2 leading-relaxed flex-1">{t.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "L'inscription patient est-elle gratuite ?",          r: "Oui, la création d'un compte patient est entièrement gratuite, sans carte bancaire." },
  { q: "Puis-je rechercher un médicament sans compte ?",     r: "Oui, la recherche est accessible sans inscription. Seuls le prix et la réservation nécessitent un compte." },
  { q: "Pourquoi le prix est-il masqué sans compte ?",       r: "Le prix est affiché après connexion ou création de compte gratuite. Cela vous permet de réserver directement." },
  { q: "Puis-je prendre rendez-vous en ligne ?",             r: "Oui, depuis votre espace patient une fois votre compte créé." },
  { q: "Les professionnels peuvent-ils exercer en plusieurs endroits ?", r: "Oui, leur agenda gère plusieurs lieux d'exercice simultanément depuis un seul espace." },
  { q: "Comment fonctionne la réservation en pharmacie ?",   r: "Vous trouvez votre médicament, réservez depuis votre compte, et le retirez en pharmacie avec un code de retrait." },
  { q: "Les pharmacies et mutuelles ont-elles leur propre espace ?", r: "Oui, chaque acteur professionnel dispose d'un espace adapté à son activité et ses outils spécifiques." },
  { q: "Comment les ordonnances sont-elles transmises ?",    r: "Après la consultation, le patient retrouve son ordonnance dans son espace et peut l'utiliser pour sa réservation en pharmacie." },
]

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section id="faq" className="bg-bg py-s-8 lg:py-24">
      <div className="mx-auto max-w-2xl px-s-5">
        <Reveal>
          <div className="text-center mb-s-8">
            <p className="text-small font-semibold text-primary uppercase tracking-widest mb-s-2">FAQ</p>
            <h2 className="font-display text-h1 font-bold text-ink">Questions fréquentes</h2>
          </div>
        </Reveal>
        <div className="space-y-s-2">
          {FAQS.map((f, i) => (
            <Reveal key={i} delay={i * 30}>
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between px-s-5 py-s-4 text-left gap-s-4"
                  aria-expanded={open === i}
                >
                  <span className="text-body font-semibold text-ink">{f.q}</span>
                  {open === i
                    ? <ChevronUp className="h-4 w-4 text-primary shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-ink-3 shrink-0" />
                  }
                </button>
                {open === i && (
                  <div className="px-s-5 pb-s-4">
                    <p className="text-body text-ink-2 leading-relaxed">{f.r}</p>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Final ──────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-[#0B3549] py-s-8 lg:py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-container px-s-5 text-center">
        <Reveal>
          <p className="text-small font-semibold text-white/50 uppercase tracking-widest mb-s-3">Rejoignez Séne Wérr</p>
          <h2 className="font-display text-display font-bold text-white mb-s-4 max-w-3xl mx-auto leading-tight">
            Votre santé mérite<br /> un espace unique.
          </h2>
          <p className="text-body text-white/60 mb-s-2 max-w-xl mx-auto leading-relaxed">
            Recherchez, prenez rendez-vous, retrouvez vos ordonnances et suivez votre parcours depuis Séne Wérr.
          </p>
          <p className="font-display text-h3 font-semibold text-white/80 mb-s-8">
            Une seule plateforme. Un seul espace. Tout votre parcours de santé.
          </p>
          <div className="flex flex-col sm:flex-row gap-s-3 justify-center">
            <Link to="/auth/inscription"
              className="px-s-7 py-s-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors shadow-lg text-body">
              Commencer gratuitement
            </Link>
            <Link to="/recherche-publique?type=medicament"
              className="px-s-7 py-s-4 border border-white/30 text-white hover:bg-white/10 font-semibold rounded-xl transition-colors text-body">
              Trouver un médicament
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Rejoindre acteurs ──────────────────────────────────────────────────────

function JoinSection() {
  const actors = [
    { icon: Stethoscope, color: 'text-accent', bg: 'bg-accent-soft', label: 'Professionnel de santé',         cta: 'Créer mon espace',          role: 'professional' },
    { icon: Building2,   color: 'text-primary', bg: 'bg-primary-soft', label: 'Cabinet / Clinique / Hôpital', cta: 'Inscrire mon établissement', role: 'establishment' },
    { icon: Pill,        color: 'text-cyan',    bg: 'bg-accent-soft',  label: 'Pharmacie',                    cta: 'Inscrire ma pharmacie',     role: 'pharmacy' },
    { icon: Shield,      color: 'text-navy',    bg: 'bg-navy-soft',    label: 'Mutuelle',                     cta: 'Inscrire ma mutuelle',      role: 'insurance' },
  ]
  return (
    <section className="bg-surface py-s-8 lg:py-16 border-t border-line">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center mb-s-7">
            <h2 className="font-display text-h1 font-bold text-ink">Vous êtes un acteur de santé ?</h2>
            <p className="mt-s-2 text-body text-ink-2">Rejoignez l'écosystème Séne Wérr.</p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-s-4">
          {actors.map((a, i) => (
            <Reveal key={a.label} delay={i * 60}>
              <div className="h-full flex flex-col items-center text-center rounded-xl border border-line bg-bg p-s-5 hover:shadow-2 transition-shadow">
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl mb-s-3', a.bg)}>
                  <a.icon className={cn('h-6 w-6', a.color)} />
                </span>
                <p className="text-body font-semibold text-ink mb-s-4 flex-1">{a.label}</p>
                <Link to={`/auth/inscription?role=${a.role}`}
                  className="w-full py-s-2 px-s-4 text-small font-semibold text-primary border border-primary/30 hover:bg-primary hover:text-white rounded-lg transition-all duration-200">
                  {a.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 100% Gratuit pour les patients ─────────────────────────────────────────

function PatientFreeSection() {
  const perks = [
    'Accès illimité',
    'Aucune carte bancaire requise',
    'Aucun abonnement',
  ]
  return (
    <section id="gratuit-patients" className="bg-primary-soft py-s-8 lg:py-24">
      <div className="mx-auto max-w-container px-s-5">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-s-2 rounded-pill bg-surface border border-primary/20 px-s-4 py-s-2 text-small text-primary font-semibold mb-s-5">
              ✅ Zéro frais, zéro abonnement
            </span>
            <h2 className="font-display text-h1 font-bold text-ink mb-s-4 leading-tight">
              La plateforme est 100% gratuite pour les patients.
            </h2>
            <p className="text-body text-ink-2 leading-relaxed mb-s-8">
              Trouvez un professionnel, prenez rendez-vous, gérez vos ordonnances et localisez vos médicaments — sans jamais payer un centime.
            </p>
          </div>
        </Reveal>
        <div className="flex flex-col sm:flex-row gap-s-4 justify-center mb-s-8">
          {perks.map((p, i) => (
            <Reveal key={p} delay={i * 80}>
              <div className="flex items-center gap-s-3 rounded-xl border border-primary/20 bg-surface px-s-5 py-s-4 shadow-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </span>
                <span className="text-body font-semibold text-ink">{p}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <div className="text-center">
            <Link to="/auth/inscription"
              className="inline-flex items-center gap-s-2 px-s-7 py-s-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-colors shadow-lg text-body">
              Créer mon compte gratuit <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── LandingPage ────────────────────────────────────────────────────────────

const ROLE_DESTINATIONS: Record<string, string> = {
  patient:              '/patient',
  professional:         '/pro',
  establishment_admin:  '/etablissement',
  establishment_staff:  '/etablissement',
  pharmacy_admin:       '/pharmacie',
  pharmacy_staff:       '/pharmacie',
  mutual_admin:         '/mutuelle',
  mutual_staff:         '/mutuelle',
  platform_admin:       '/admin',
  super_admin:          '/admin',
}

export default function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()
      const dest = (profile?.role && ROLE_DESTINATIONS[profile.role]) ?? null
      if (dest) navigate(dest, { replace: true })
    })
  }, [navigate])

  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <EcosystemBar />
        <TrustedBySection />
        <ProblemSection />
        <SolutionSection />
        <PatientSection />
        <ActorsSection />
        <ProfessionalSection />
        <MedicineSection />
        <DashboardPreview />
        <SecuritySection />
        <WhySection />
        <TestimonialsSection />
        <FAQSection />
        <FinalCTA />
        <JoinSection />
        <PatientFreeSection />
      </main>
      <PublicFooter />
      <ScrollToTop />
    </>
  )
}

