/**
 * LandingPage — BLOC 8
 * Réécriture complète : toutes les sections dans un seul fichier.
 * Pas de framer-motion. Animations via IntersectionObserver + CSS.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock, FileText, CreditCard, User, Stethoscope, Building2,
  Pill, Shield, Check, ChevronDown, ChevronUp, Menu, X,
  ArrowRight, Star, Lock, BadgeCheck, MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { supabase } from '@/lib/supabase'
import { cn, formatFCFA } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Testimonial {
  id: string
  author_name: string
  role: string
  content: string
  avatar_url?: string | null
}

interface Plan {
  id: string
  code: string
  name: string
  price_fcfa: number
  description: string
  features: string[]
  is_featured: boolean
  audience: 'patient' | 'professional' | 'establishment' | 'pharmacy' | 'insurance'
}

interface LiveStats {
  professionals: number
  pharmacies: number
  cities: number
}

// ─── Hook : useInView ──────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

// ─── Hook : useLiveStats ───────────────────────────────────────────────────

function useLiveStats() {
  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [profRes, pharmRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'professional'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('pharmacies').select('id', { count: 'exact', head: true }),
        ])
        const professionals = profRes.count ?? 0
        const pharmacies = pharmRes.count ?? 0
        // Approximation : villes = distinct cities from pharmacies
        setStats({ professionals, pharmacies, cities: Math.max(1, Math.floor(pharmacies / 3)) })
      } catch {
        setStats(null)
      }
    }
    load()
  }, [])

  return stats
}

// ─── Hook : useTestimonials ────────────────────────────────────────────────

function useTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])

  useEffect(() => {
    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('testimonials')
          .select('id, author_name, role, content, avatar_url')
          .eq('approved', true)
          .order('order_index', { ascending: true })
          .limit(6)
        if (Array.isArray(data)) setTestimonials(data as Testimonial[])
      } catch {
        // silent — section stays hidden
      }
    }
    load()
  }, [])

  return testimonials
}

// ─── Hook : usePlans ──────────────────────────────────────────────────────

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'patient-free',
    code: 'patient-gratuit',
    name: 'Patient · Gratuit',
    price_fcfa: 0,
    description: 'Pour tous les patients Séne Wérr',
    features: ['Rendez-vous illimités', 'Ordonnances numériques', 'Suivi de commande', 'Paiement Wave / Orange Money'],
    is_featured: true,
    audience: 'patient',
  },
  {
    id: 'pro-standard',
    code: 'pro-standard',
    name: 'Professionnel · Standard',
    price_fcfa: 9_900,
    description: 'Pour les praticiens indépendants',
    features: ['Agenda illimité', 'Ordonnances signées', 'Statistiques de base', 'Essai 14 jours'],
    is_featured: false,
    audience: 'professional',
  },
  {
    id: 'pro-premium',
    code: 'pro-premium',
    name: 'Professionnel · Premium',
    price_fcfa: 29_900,
    description: 'Cabinet & IA médicale inclus',
    features: ['Tout Standard +', 'Assistant IA', 'Transcription live', 'Multi-praticiens', 'Support prioritaire'],
    is_featured: false,
    audience: 'professional',
  },
  {
    id: 'etab-standard',
    code: 'etab-standard',
    name: 'Établissement · Standard',
    price_fcfa: 49_900,
    description: 'Clinique et cabinet de groupe',
    features: ['Agenda équipe', 'Statistiques avancées', 'Invitations 1 clic', 'Facturation intégrée'],
    is_featured: false,
    audience: 'establishment',
  },
  {
    id: 'pharma',
    code: 'pharma',
    name: 'Pharmacie',
    price_fcfa: 14_900,
    description: 'Gestion des commandes financées',
    features: ['Commandes pré-financées', 'Vérification ordonnance', 'Code retrait 4 chiffres', 'Dashboard commissions'],
    is_featured: false,
    audience: 'pharmacy',
  },
  {
    id: 'mutuelle',
    code: 'mutuelle',
    name: 'Mutuelle',
    price_fcfa: 0,
    description: 'Sur devis selon volume',
    features: ['Prises en charge 1 clic', 'Zéro papier', 'Rapprochement auto', 'API dédiée'],
    is_featured: false,
    audience: 'insurance',
  },
]

function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)

  useEffect(() => {
    async function load() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('subscription_plans')
          .select('id, code, name, price_fcfa, description, features, is_featured, audience')
          .eq('active', true)
          .order('sort_order', { ascending: true })
        if (Array.isArray(data) && data.length > 0) setPlans(data as Plan[])
      } catch {
        // fallback stays
      }
    }
    load()
  }, [])

  return plans
}

// ─── NavBar ────────────────────────────────────────────────────────────────

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Tarifs', to: '/tarifs' },
    { label: 'Blog', to: '/blog' },
    { label: 'Contact', to: '/contact' },
  ]

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-shadow duration-200',
        scrolled ? 'bg-surface shadow-1' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-s-4 px-s-4 py-s-3 sm:px-s-6">
        {/* Logo */}
        <Link to="/" className="font-display text-h3 font-bold text-primary" aria-label="Séne Wérr — accueil">
          Séne Wérr
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-s-2 md:flex" aria-label="Navigation principale">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="px-s-3 py-s-2 text-small font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-s-4 flex items-center gap-s-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth/connexion">Se connecter</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to="/auth/inscription">S'inscrire</Link>
            </Button>
          </div>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 md:hidden"
          onClick={() => setMenuOpen(v => !v)}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-line bg-surface px-s-4 pb-s-4 md:hidden">
          <nav className="flex flex-col gap-s-1 pt-s-3" aria-label="Menu mobile">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md px-s-3 py-s-3 text-body font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-s-3 flex flex-col gap-s-2">
              <Button variant="secondary" fullWidth asChild>
                <Link to="/auth/connexion" onClick={() => setMenuOpen(false)}>Se connecter</Link>
              </Button>
              <Button variant="primary" fullWidth asChild>
                <Link to="/auth/inscription" onClick={() => setMenuOpen(false)}>S'inscrire</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

// ─── Hero Section ──────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative overflow-hidden pt-[72px]"
      style={{ background: 'linear-gradient(160deg, var(--surface-1) 0%, #ffffff 100%)' }}
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-s-8 px-s-4 py-s-10 sm:px-s-6 md:grid-cols-2 md:py-s-16 lg:py-s-20">
        {/* Left: text */}
        <div className="flex flex-col gap-s-5">
          <h1
            id="hero-heading"
            className="font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.15] text-ink"
          >
            Votre parcours de santé,{' '}
            <span className="text-primary">au même endroit</span>
          </h1>
          <p className="max-w-prose text-body leading-relaxed text-ink-2">
            Rendez-vous, professionnels, ordonnances, pharmacies, mutuelle et paiements&nbsp;: Séne Wérr relie tout ce dont vous avez besoin, depuis un seul compte.
          </p>
          <div className="flex flex-wrap gap-s-3">
            <Button variant="primary" size="lg" asChild>
              <Link to="/auth/inscription">
                Je suis patient — c'est gratuit
                <ArrowRight className="ml-s-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link to="/auth/inscription?role=professional">Je suis professionnel</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-s-4 text-small text-ink-3" aria-label="Points forts">
            <li className="flex items-center gap-s-1"><Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Gratuit pour les patients</li>
            <li className="flex items-center gap-s-1"><Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Données chiffrées AES-256</li>
            <li className="flex items-center gap-s-1"><Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Sénégal · Afrique de l'Ouest</li>
          </ul>
        </div>

        {/* Right: inline SVG app mockup */}
        <div className="flex justify-center md:justify-end" aria-hidden="true">
          <svg
            viewBox="0 0 340 540"
            className="w-full max-w-[300px] drop-shadow-xl md:max-w-[340px]"
            role="img"
            aria-label="Aperçu de l'application Séne Wérr"
          >
            {/* Phone shell */}
            <rect x="10" y="10" width="320" height="520" rx="32" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
            {/* Status bar */}
            <rect x="10" y="10" width="320" height="48" rx="32" fill="var(--primary)" />
            <text x="30" y="33" fill="white" fontSize="11" fontWeight="600" fontFamily="system-ui">Séne Wérr</text>
            <text x="260" y="33" fill="white" fontSize="10" fontFamily="system-ui">09:41</text>
            {/* Notch */}
            <rect x="120" y="10" width="100" height="18" rx="0 0 12 12" fill="var(--primary)" />
            {/* Greeting */}
            <text x="30" y="84" fill="var(--ink)" fontSize="13" fontWeight="700" fontFamily="system-ui">Bonjour, Aminata 👋</text>
            <text x="30" y="100" fill="var(--ink-2)" fontSize="10" fontFamily="system-ui">Mercredi 17 sept. 2026</text>
            {/* Appointment card */}
            <rect x="20" y="114" width="300" height="90" rx="12" fill="var(--primary)" />
            <text x="36" y="137" fill="white" fontSize="10" fontWeight="600" fontFamily="system-ui">PROCHAIN RENDEZ-VOUS</text>
            <text x="36" y="157" fill="white" fontSize="13" fontWeight="700" fontFamily="system-ui">Dr. Sow · Médecin généraliste</text>
            <text x="36" y="174" fill="rgba(255,255,255,0.85)" fontSize="10" fontFamily="system-ui">Aujourd'hui à 14h30 · Cabinet Plateau</text>
            <rect x="36" y="183" width="80" height="14" rx="7" fill="rgba(255,255,255,0.2)" />
            <text x="46" y="193" fill="white" fontSize="9" fontFamily="system-ui">Confirmé ✓</text>
            {/* Reservation card */}
            <rect x="20" y="216" width="300" height="80" rx="12" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1" />
            <text x="36" y="237" fill="var(--ink-2)" fontSize="10" fontWeight="600" fontFamily="system-ui">RÉSERVATION EN COURS</text>
            <text x="36" y="255" fill="var(--ink)" fontSize="12" fontWeight="700" fontFamily="system-ui">Amoxicilline 500mg × 2 boîtes</text>
            <text x="36" y="271" fill="var(--ink-2)" fontSize="10" fontFamily="system-ui">Pharmacie Centrale · Code : 8 4 2 1</text>
            <rect x="240" y="221" width="68" height="22" rx="11" fill="var(--accent)" />
            <text x="252" y="235" fill="white" fontSize="9" fontWeight="600" fontFamily="system-ui">En attente</text>
            {/* Credits bar */}
            <rect x="20" y="308" width="300" height="64" rx="12" fill="var(--surface)" stroke="var(--line)" strokeWidth="1" />
            <text x="36" y="328" fill="var(--ink-2)" fontSize="10" fontWeight="600" fontFamily="system-ui">SOLDE MUTUELLE</text>
            <text x="36" y="350" fill="var(--ink)" fontSize="13" fontWeight="700" fontFamily="system-ui">32 500 FCFA restants</text>
            <rect x="36" y="358" width="200" height="6" rx="3" fill="var(--line)" />
            <rect x="36" y="358" width="130" height="6" rx="3" fill="var(--primary)" />
            {/* Quick actions */}
            <text x="30" y="398" fill="var(--ink)" fontSize="11" fontWeight="700" fontFamily="system-ui">Actions rapides</text>
            {[
              { x: 20, label: 'Médecin', color: 'var(--primary)' },
              { x: 95, label: 'Ordonnance', color: 'var(--accent)' },
              { x: 190, label: 'Pharmacie', color: '#10b981' },
              { x: 265, label: 'Mutuelle', color: '#8b5cf6' },
            ].map(({ x, label, color }) => (
              <g key={label}>
                <rect x={x} y={406} width="58" height="56" rx="12" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1" />
                <circle cx={x + 29} cy={424} r="10" fill={color} opacity="0.15" />
                <circle cx={x + 29} cy={424} r="5" fill={color} />
                <text x={x + 29} y={453} fill="var(--ink-2)" fontSize="8" textAnchor="middle" fontFamily="system-ui">{label}</text>
              </g>
            ))}
            {/* Bottom nav indicator */}
            <rect x="130" y="508" width="80" height="4" rx="2" fill="var(--line)" />
          </svg>
        </div>
      </div>
    </section>
  )
}

// ─── Pain Points ───────────────────────────────────────────────────────────

const PAIN_POINTS = [
  {
    icon: Clock,
    title: 'Trouver un médecin disponible prend des heures',
    desc: "Les agendas débordent, les appels restent sans réponse. Vous avancez à l'aveugle.",
  },
  {
    icon: FileText,
    title: "L'ordonnance papier, la tournée des pharmacies",
    desc: 'Rupture de stock, perte du document, deuxième déplacement : un parcours du combattant.',
  },
  {
    icon: CreditCard,
    title: "Avancer l'argent et attendre la mutuelle",
    desc: 'Dossiers papier, délais de remboursement, incertitude sur la prise en charge réelle.',
  },
]

function PainPointsSection() {
  const { ref, visible } = useInView()

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-s-12 bg-surface-1"
      aria-labelledby="pain-heading"
    >
      <div className="mx-auto max-w-7xl px-s-4 sm:px-s-6">
        <h2
          id="pain-heading"
          className={cn(
            'mb-s-8 text-center font-display text-h1 font-semibold text-ink transition-all duration-500',
            visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          Reconnaissez-vous cette situation&nbsp;?
        </h2>
        <div className="grid gap-s-4 sm:grid-cols-3">
          {PAIN_POINTS.map((p, i) => (
            <div
              key={p.title}
              className={cn(
                'flex flex-col gap-s-3 rounded-xl border border-[color:var(--status-warning)] bg-[color:var(--status-warning)]/5 p-s-5 transition-all duration-500',
                visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
              )}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--status-warning)]/15">
                <p.icon className="h-5 w-5 text-[color:var(--status-warning)]" aria-hidden="true" />
              </span>
              <h3 className="text-body font-semibold text-ink">{p.title}</h3>
              <p className="text-small leading-relaxed text-ink-2">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Solution — SVG Parcours Diagram ──────────────────────────────────────

const PARCOURS_NODES = [
  { id: 'patient', label: 'Patient', Icon: User },
  { id: 'medecin', label: 'Médecin', Icon: Stethoscope },
  { id: 'ordonnance', label: 'Ordonnance', Icon: FileText },
  { id: 'pharmacie', label: 'Pharmacie', Icon: Pill },
  { id: 'mutuelle', label: 'Mutuelle', Icon: Shield },
]

function ParcoursDiagram({ visible }: { visible: boolean }) {
  const W = 380
  const H = 200
  const nodeR = 28
  const spacing = W / (PARCOURS_NODES.length - 1)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[420px]"
      role="img"
      aria-label="Parcours Séne Wérr : Patient → Médecin → Ordonnance → Pharmacie → Mutuelle"
    >
      {/* Arrows */}
      {PARCOURS_NODES.slice(0, -1).map((_, i) => {
        const x1 = i * spacing + nodeR
        const x2 = (i + 1) * spacing - nodeR
        const y = H / 2 - 10
        return (
          <g key={i}>
            <line
              x1={x1} y1={y} x2={x2} y2={y}
              stroke="var(--ink-3)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className={cn('transition-opacity duration-500', visible && i < PARCOURS_NODES.length - 1 ? 'opacity-100' : 'opacity-0')}
              style={{ transitionDelay: `${(i + 1) * 150}ms` }}
            />
            <polygon
              points={`${x2},${y - 4} ${x2 + 7},${y} ${x2},${y + 4}`}
              fill="var(--ink-3)"
              className={cn('transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
              style={{ transitionDelay: `${(i + 1) * 150 + 80}ms` }}
            />
          </g>
        )
      })}

      {/* Nodes */}
      {PARCOURS_NODES.map((node, i) => {
        const cx = i * spacing
        const cy = H / 2 - 10
        const { Icon } = node
        return (
          <g
            key={node.id}
            className={cn('transition-all duration-500', visible ? 'opacity-100' : 'opacity-0')}
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            <circle cx={cx} cy={cy} r={nodeR} fill="var(--primary)" />
            {/* Icon placeholder as text — lucide can't render inside SVG directly */}
            <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="14" aria-hidden="true">
              {['👤', '⚕️', '📄', '💊', '🛡️'][i]}
            </text>
            <text
              x={cx}
              y={cy + nodeR + 18}
              textAnchor="middle"
              fill="var(--ink)"
              fontSize="10"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SolutionSection() {
  const { ref, visible } = useInView(0.1)

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-s-12 bg-surface"
      aria-labelledby="solution-heading"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-s-10 px-s-4 sm:px-s-6 md:grid-cols-2">
        {/* Left */}
        <div
          className={cn('flex flex-col gap-s-6 transition-all duration-600', visible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0')}
        >
          <h2 id="solution-heading" className="font-display text-h1 font-semibold text-ink">
            Un compte. Un dossier. Un parcours.
          </h2>
          <ul className="flex flex-col gap-s-4">
            {[
              { icon: User, text: 'Trouvez un professionnel vérifié en quelques secondes et réservez en temps réel.' },
              { icon: FileText, text: 'Votre ordonnance numérique arrive instantanément à la pharmacie de votre choix.' },
              { icon: Shield, text: 'Votre mutuelle valide sa part automatiquement. Vous ne payez que le reste à charge.' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-s-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <p className="text-body leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ul>
          <Button variant="primary" size="md" asChild>
            <Link to="/auth/inscription">Commencer gratuitement</Link>
          </Button>
        </div>

        {/* Right: animated SVG diagram */}
        <div
          className={cn('flex justify-center transition-all duration-600', visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0')}
          style={{ transitionDelay: '120ms' }}
        >
          <div className="flex flex-col items-center gap-s-4 rounded-2xl border border-line bg-surface-1 p-s-6 shadow-1">
            <p className="text-small font-semibold uppercase tracking-widest text-primary">Votre parcours</p>
            <ParcoursDiagram visible={visible} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Comment ça marche ────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    icon: MapPin,
    title: 'Trouver',
    desc: 'Cherchez un professionnel vérifié près de chez vous, consultez ses créneaux en temps réel.',
  },
  {
    n: '02',
    icon: FileText,
    title: 'Consulter',
    desc: 'Le médecin signe votre ordonnance directement depuis Séne Wérr. Elle est prête instantanément.',
  },
  {
    n: '03',
    icon: Shield,
    title: 'Réserver',
    desc: 'Sélectionnez votre pharmacie, votre mutuelle valide sa part. Vous ne payez que votre reste à charge.',
  },
  {
    n: '04',
    icon: Pill,
    title: 'Retirer',
    desc: 'Présentez votre code à 4 chiffres en pharmacie. Votre commande est prête, financée, vérifiée.',
  },
]

function HowItWorksSection() {
  const { ref, visible } = useInView(0.1)

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-s-12 bg-surface-2"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-7xl px-s-4 sm:px-s-6">
        <div className="mb-s-10 text-center">
          <p className="mb-s-2 text-small font-semibold uppercase tracking-[0.06em] text-primary">Simple</p>
          <h2 id="how-heading" className="font-display text-h1 font-semibold text-ink">Comment ça marche</h2>
        </div>
        <ol className="relative grid gap-s-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Étapes du parcours">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className={cn(
                'flex flex-col gap-s-3 rounded-xl bg-surface p-s-5 shadow-1 transition-all duration-500',
                visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
              )}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-s-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-h3 font-bold text-primary-fg">
                  {step.n}
                </span>
                <step.icon className="h-5 w-5 text-ink-3" aria-hidden="true" />
              </div>
              <h3 className="text-h3 font-semibold text-ink">{step.title}</h3>
              <p className="text-small leading-relaxed text-ink-2">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ─── Fonctionnalités par acteur ────────────────────────────────────────────

const ACTOR_TABS: Array<{
  value: string
  label: string
  icon: typeof User
  items: string[]
}> = [
  {
    value: 'patient',
    label: 'Patient',
    icon: User,
    items: [
      'Vous savez toujours où en est votre commande — suivi en temps réel des statuts',
      'Ordonnance signée, médicament réservé en 2 taps',
      'Votre famille sur un seul compte — ajout de bénéficiaires',
      'Payez seulement votre reste à charge, Wave ou Orange Money',
    ],
  },
  {
    value: 'professionnel',
    label: 'Professionnel',
    icon: Stethoscope,
    items: [
      "Un seul agenda pour tous vos lieux d'exercice",
      'Ordonnance signée en 30 secondes, envoyée instantanément',
      'Résumé pré-consultation généré par IA',
      'Transcription de consultation en temps réel',
      "Revenus et commissions en un coup d'œil",
    ],
  },
  {
    value: 'etablissement',
    label: 'Établissement',
    icon: Building2,
    items: [
      "Gérez l'agenda de toute votre équipe depuis un tableau de bord",
      'Invitez vos professionnels en 1 clic',
      'Statistiques de fréquentation en temps réel',
    ],
  },
  {
    value: 'pharmacie',
    label: 'Pharmacie',
    icon: Pill,
    items: [
      'Vous ne préparez que des commandes déjà financées',
      'Vérification ordonnance intégrée',
      'Code de retrait sécurisé à 4 chiffres',
      'Commission transparente sur votre tableau de bord',
    ],
  },
  {
    value: 'mutuelle',
    label: 'Mutuelle',
    icon: Shield,
    items: [
      'Des prises en charge traitées en 1 clic',
      'Zéro dossier papier',
      'Rapprochement automatique avec vos règles de couverture',
    ],
  },
]

function ActorTabsSection() {
  return (
    <section className="py-s-12 bg-surface" aria-labelledby="actor-heading">
      <div className="mx-auto max-w-7xl px-s-4 sm:px-s-6">
        <h2 id="actor-heading" className="mb-s-8 text-center font-display text-h1 font-semibold text-ink">
          Une solution pour chaque acteur
        </h2>
        <Tabs defaultValue="patient">
          <TabsList className="flex w-full flex-wrap justify-center gap-s-1" aria-label="Acteurs">
            {ACTOR_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-s-2">
                <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ACTOR_TABS.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              <div className="mx-auto mt-s-6 max-w-2xl rounded-xl border border-line bg-surface-1 p-s-6">
                <div className="mb-s-4 flex items-center gap-s-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <tab.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="text-h3 font-semibold text-ink">{tab.label}</h3>
                </div>
                <ul className="flex flex-col gap-s-3" role="list">
                  {tab.items.map(item => (
                    <li key={item} className="flex items-start gap-s-3 text-body text-ink-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

// ─── Preuves ───────────────────────────────────────────────────────────────

function ProofsSection() {
  const stats = useLiveStats()
  const testimonials = useTestimonials()
  const { ref, visible } = useInView()

  const STAT_THRESHOLD = 10

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-s-12 bg-surface-2"
      aria-labelledby="proof-heading"
    >
      <div className="mx-auto max-w-7xl px-s-4 sm:px-s-6">
        <h2 id="proof-heading" className="mb-s-8 text-center font-display text-h1 font-semibold text-ink">
          Ils font confiance à Séne Wérr
        </h2>

        {/* Live stats */}
        {stats && (
          <div className="mb-s-10 grid gap-s-4 sm:grid-cols-3">
            {[
              {
                value: stats.professionals >= STAT_THRESHOLD ? stats.professionals.toLocaleString('fr-FR') : null,
                label: 'Professionnels vérifiés',
              },
              {
                value: stats.pharmacies >= STAT_THRESHOLD ? stats.pharmacies.toLocaleString('fr-FR') : null,
                label: 'Pharmacies partenaires',
              },
              {
                value: stats.cities >= STAT_THRESHOLD ? stats.cities.toLocaleString('fr-FR') : null,
                label: 'Villes couvertes',
              },
            ].map(stat => (
              <div
                key={stat.label}
                className={cn(
                  'flex flex-col items-center gap-s-1 rounded-xl bg-surface p-s-6 shadow-1 transition-all duration-500',
                  visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
                )}
              >
                <span className="font-display text-h1 font-bold text-primary">
                  {stat.value ?? 'Bientôt disponible'}
                </span>
                <span className="text-small text-ink-2">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Placeholder partner logos */}
        <div className="mb-s-10">
          <p className="mb-s-4 text-center text-small font-semibold uppercase tracking-widest text-ink-3">Nos partenaires</p>
          <div className="flex flex-wrap justify-center gap-s-4" aria-label="Partenaires à venir">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className="flex h-14 w-36 items-center justify-center rounded-lg border border-line bg-surface text-micro font-medium text-ink-3"
              >
                Partenaire à venir
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials — rendered only if data exists */}
        {testimonials.length > 0 && (
          <div className="mb-s-10 grid gap-s-4 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map(t => (
              <article
                key={t.id}
                className="flex flex-col gap-s-3 rounded-xl bg-surface p-s-5 shadow-1"
              >
                <div className="flex gap-s-1" aria-label="5 étoiles">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[color:var(--accent)] text-[color:var(--accent)]" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="text-small leading-relaxed text-ink-2">"{t.content}"</blockquote>
                <footer className="mt-auto">
                  <p className="text-small font-semibold text-ink">{t.author_name}</p>
                  <p className="text-micro text-ink-3">{t.role}</p>
                </footer>
              </article>
            ))}
          </div>
        )}

        {/* Engagement badges */}
        <div className="grid gap-s-4 sm:grid-cols-3">
          {[
            { icon: BadgeCheck, title: 'Professionnels vérifiés', desc: "Diplôme et numéro d'ordre contrôlés par notre équipe sous 48h." },
            { icon: Lock, title: 'Données chiffrées AES-256', desc: 'Chiffrement au repos et en transit. Hébergement Union Européenne.' },
            { icon: Shield, title: 'Audit annuel', desc: 'Sécurité et conformité RGPD auditées chaque année par un tiers indépendant.' },
          ].map(badge => (
            <div key={badge.title} className="flex items-start gap-s-3 rounded-xl bg-surface p-s-5 shadow-1">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <badge.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="text-body font-semibold text-ink">{badge.title}</p>
                <p className="mt-s-1 text-small leading-relaxed text-ink-2">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Pricing Preview ───────────────────────────────────────────────────────

function PricingPreviewSection() {
  const plans = usePlans()
  // Show 3 patient-facing + 3 B2B
  const patientPlans = plans.filter(p => p.audience === 'patient').slice(0, 3)
  const b2bPlans = plans.filter(p => p.audience !== 'patient').slice(0, 3)
  const displayed = [...patientPlans, ...b2bPlans].slice(0, 6)

  return (
    <section className="py-s-12 bg-surface-1" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-7xl px-s-4 sm:px-s-6">
        <div className="mb-s-8 text-center">
          <p className="mb-s-2 text-small font-semibold uppercase tracking-[0.06em] text-primary">Tarification</p>
          <h2 id="pricing-heading" className="font-display text-h1 font-semibold text-ink">Simple et transparent</h2>
          <p className="mt-s-3 text-body text-ink-2">Gratuit pour les patients · Essai 14 jours sans engagement pour les professionnels</p>
        </div>

        <div className="grid gap-s-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map(plan => (
            <div
              key={plan.id}
              className={cn(
                'flex flex-col rounded-xl border bg-surface p-s-5 shadow-1',
                plan.is_featured ? 'border-primary ring-1 ring-primary' : 'border-line',
              )}
            >
              {plan.is_featured && (
                <span className="mb-s-3 inline-flex w-fit items-center rounded-full bg-primary/10 px-s-3 py-s-1 text-micro font-semibold text-primary">
                  Gratuit pour les patients
                </span>
              )}
              <h3 className="font-display text-h3 font-semibold text-ink">{plan.name}</h3>
              <p className="mt-s-1 text-small text-ink-3">{plan.description}</p>
              <div className="mt-s-4 flex items-baseline gap-s-1">
                {plan.price_fcfa === 0 ? (
                  <span className="font-display text-h1 font-bold text-ink">Gratuit</span>
                ) : plan.audience === 'insurance' ? (
                  <span className="font-display text-h2 font-bold text-ink">Sur devis</span>
                ) : (
                  <>
                    <span className="font-display text-h1 font-bold tabular-nums text-ink">{formatFCFA(plan.price_fcfa)}</span>
                    <span className="text-small text-ink-3">/mois</span>
                  </>
                )}
              </div>
              <ul className="my-s-5 flex flex-1 flex-col gap-s-2">
                {(plan.features ?? []).map((feat: string) => (
                  <li key={feat} className="flex items-start gap-s-2 text-small text-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Button variant={plan.is_featured ? 'primary' : 'secondary'} fullWidth asChild>
                <Link to={plan.audience === 'patient' ? '/auth/inscription' : '/auth/inscription?role=professional'}>
                  {plan.is_featured ? 'Créer mon compte gratuit' : 'Essai 14 jours'}
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-s-8 text-center">
          <Button variant="ghost" size="lg" asChild>
            <Link to="/tarifs">
              Voir tous les tarifs
              <ArrowRight className="ml-s-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Séne Wérr est-il gratuit ?',
    a: 'Oui, le compte patient est entièrement gratuit et le restera. Les professionnels de santé, établissements, pharmacies et mutuelles disposent de plans adaptés avec un essai de 14 jours sans engagement.',
  },
  {
    q: 'Comment mon ordonnance arrive-t-elle à la pharmacie ?',
    a: "Lorsque votre médecin signe l'ordonnance sur Séne Wérr, elle est immédiatement disponible dans votre espace patient. Vous la sélectionnez au moment de votre réservation en pharmacie, sans papier.",
  },
  {
    q: 'Qui peut voir mon dossier ?',
    a: 'Seuls vous, vos bénéficiaires autorisés, le médecin prescripteur et la pharmacie que vous avez choisie peuvent accéder à votre ordonnance — et seulement le temps de la réservation. Séne Wérr applique le principe du minimum nécessaire.',
  },
  {
    q: 'Comment payer ma part ?',
    a: 'Wave, Orange Money ou carte bancaire. Vous payez uniquement votre reste à charge après validation de votre mutuelle.',
  },
  {
    q: 'Ma mutuelle est-elle compatible ?',
    a: 'Si votre mutuelle utilise Séne Wérr, les prises en charge sont automatiques. Sinon, votre réservation reste possible et vous serez remboursé selon votre contrat mutuelle habituel.',
  },
  {
    q: 'Comment être vérifié en tant que professionnel ?',
    a: "Téléversez vos justificatifs (diplôme, numéro d'ordre) lors de l'inscription. Notre équipe valide sous 48 heures ouvrées.",
  },
  {
    q: 'Livrez-vous les médicaments ?',
    a: "Non — Séne Wérr ne livre pas à domicile. Vous retirez votre commande en pharmacie avec un code à 4 chiffres, une fois qu'elle est préparée.",
  },
  {
    q: 'Mes données sont-elles protégées ?',
    a: 'Vos données sont chiffrées (AES-256 au repos, TLS 1.3 en transit), hébergées en Union Européenne, et protégées conformément à la loi sénégalaise n° 2008-12 et au RGPD. Vos données de santé ne sont jamais utilisées à des fins publicitaires ni transmises sans votre consentement exprès.',
  },
]

function FAQAccordionItem({
  item,
  index,
  open,
  onToggle,
}: {
  item: typeof FAQ_ITEMS[0]
  index: number
  open: boolean
  onToggle: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(open ? contentRef.current.scrollHeight : 0)
    }
  }, [open])

  return (
    <div
      itemScope
      itemType="https://schema.org/Question"
      itemProp="mainEntity"
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`faq-answer-${index}`}
        id={`faq-question-${index}`}
        className="flex w-full items-center justify-between gap-s-4 px-s-5 py-s-4 text-left"
      >
        <span className="text-body font-medium text-ink" itemProp="name">{item.q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
        }
      </button>
      <div
        id={`faq-answer-${index}`}
        role="region"
        aria-labelledby={`faq-question-${index}`}
        style={{ height, overflow: 'hidden', transition: 'height 220ms ease' }}
        itemScope
        itemType="https://schema.org/Answer"
        itemProp="acceptedAnswer"
      >
        <div ref={contentRef} className="px-s-5 pb-s-5">
          <p className="text-small leading-relaxed text-ink-2" itemProp="text">{item.a}</p>
        </div>
      </div>
    </div>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = useCallback((i: number) => {
    setOpenIndex(prev => (prev === i ? null : i))
  }, [])

  return (
    <section
      className="py-s-12 bg-surface"
      aria-labelledby="faq-heading"
      itemScope
      itemType="https://schema.org/FAQPage"
    >
      <div className="mx-auto max-w-3xl px-s-4 sm:px-s-6">
        <h2 id="faq-heading" className="mb-s-8 text-center font-display text-h1 font-semibold text-ink">
          Questions fréquentes
        </h2>
        <div className="flex flex-col gap-s-3">
          {FAQ_ITEMS.map((item, i) => (
            <FAQAccordionItem
              key={i}
              item={item}
              index={i}
              open={openIndex === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Final ────────────────────────────────────────────────────────────

function CTAFinalSection() {
  return (
    <section
      className="py-s-16 text-center"
      style={{ background: 'linear-gradient(160deg, var(--primary) 0%, #1a56db 100%)' }}
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-2xl px-s-4 sm:px-s-6">
        <h2 id="cta-heading" className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-white">
          Commencez par&nbsp;: je cherche un médecin.
        </h2>
        <p className="mt-s-4 text-body text-white/80">
          Rejoignez des milliers de patients qui gèrent leur santé simplement avec Séne Wérr.
        </p>
        <div className="mt-s-8">
          <Button
            variant="accent"
            size="lg"
            asChild
            className="text-base font-bold shadow-lg"
          >
            <Link to="/auth/inscription">
              Créer mon compte patient gratuit
              <ArrowRight className="ml-s-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <p className="mt-s-4 text-small text-white/60">
          Aucune carte bancaire requise · Vérification en 2 minutes
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-line bg-surface" aria-label="Pied de page Séne Wérr">
      <div className="mx-auto max-w-7xl px-s-4 py-s-10 sm:px-s-6">
        <div className="grid gap-s-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1: Logo + tagline */}
          <div className="flex flex-col gap-s-3">
            <Link to="/" className="font-display text-h3 font-bold text-primary" aria-label="Séne Wérr — accueil">
              Séne Wérr
            </Link>
            <p className="text-small font-medium text-primary">Votre santé connectée et centralisée</p>
            <p className="text-small leading-relaxed text-ink-2">
              Plateforme de santé numérique au Sénégal — patients, professionnels, établissements, pharmacies et mutuelles réunis.
            </p>
            <div className="flex gap-s-3" aria-label="Réseaux sociaux">
              {['Twitter', 'LinkedIn', 'Facebook'].map(sn => (
                <a
                  key={sn}
                  href="#"
                  aria-label={sn}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-micro text-ink-3 transition-colors hover:border-primary hover:text-primary"
                >
                  {sn[0]}
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Produit */}
          <div>
            <h3 className="mb-s-3 text-small font-semibold text-ink">Produit</h3>
            <ul className="flex flex-col gap-s-2">
              {[
                { label: 'Tarifs', to: '/tarifs' },
                { label: 'Blog', to: '/blog' },
                { label: 'Contact', to: '/contact' },
                { label: 'Sécurité', to: '/securite' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-small text-ink-2 hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Légal */}
          <div>
            <h3 className="mb-s-3 text-small font-semibold text-ink">Légal</h3>
            <ul className="flex flex-col gap-s-2">
              {[
                { label: 'Mentions légales', to: '/mentions-legales' },
                { label: 'Confidentialité', to: '/confidentialite' },
                { label: 'CGU', to: '/cgu' },
                { label: 'CGV', to: '/cgv' },
                { label: 'Cookies', to: '/cookies' },
                { label: 'Remboursements', to: '/remboursements' },
              ].map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-small text-ink-2 hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Support */}
          <div>
            <h3 className="mb-s-3 text-small font-semibold text-ink">Support</h3>
            <ul className="flex flex-col gap-s-2">
              <li>
                <a href="mailto:contact@senewerr.com" className="text-small text-ink-2 hover:text-primary">
                  contact@senewerr.com
                </a>
              </li>
              <li>
                <a href="mailto:support@senewerr.com" className="text-small text-ink-2 hover:text-primary">
                  support@senewerr.com
                </a>
              </li>
              <li>
                <Link to="/faq" className="text-small text-ink-2 hover:text-primary">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-s-8 flex flex-col items-center justify-between gap-s-4 border-t border-line pt-s-6 sm:flex-row">
          <p className="text-micro text-ink-3">
            © 2026 Séne Wérr SAS · Tous droits réservés · 🇸🇳 Sénégal
          </p>
          {/* Language selector */}
          <div className="flex items-center gap-s-2 text-micro text-ink-3" aria-label="Sélecteur de langue">
            {['fr', 'wo', 'en'].map((lang, i, arr) => (
              <span key={lang}>
                <button
                  className={cn(
                    'transition-colors hover:text-primary',
                    lang === 'fr' ? 'font-semibold text-primary' : '',
                  )}
                  aria-label={`Langue : ${lang}`}
                >
                  {lang}
                </button>
                {i < arr.length - 1 && <span className="mx-s-1 text-line">|</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── LandingPage ──────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <PainPointsSection />
        <SolutionSection />
        <HowItWorksSection />
        <ActorTabsSection />
        <ProofsSection />
        <PricingPreviewSection />
        <FAQSection />
        <CTAFinalSection />
      </main>
      <Footer />
    </>
  )
}
