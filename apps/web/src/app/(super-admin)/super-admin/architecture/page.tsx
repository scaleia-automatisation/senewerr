import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Layers, Database, Shield, Bell, CreditCard, Smartphone,
  Zap, GitBranch, Wifi, CheckCircle2, AlertCircle, Server
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Architecture technique — Super Admin' }

// Spec 28.3 — 11 modules fonctionnels
const MODULES = [
  { key: 'identity',       label: 'Identité et authentification',        icon: Shield },
  { key: 'patients',       label: 'Gestion des patients',                icon: Layers },
  { key: 'professionals',  label: 'Gestion des professionnels et établissements', icon: Server },
  { key: 'appointments',   label: 'Rendez-vous',                         icon: Bell },
  { key: 'consultations',  label: 'Consultations',                       icon: CheckCircle2 },
  { key: 'prescriptions',  label: 'Ordonnances',                         icon: GitBranch },
  { key: 'pharmacy',       label: 'Pharmacies et stocks',                icon: Database },
  { key: 'coverage',       label: 'Couverture santé',                    icon: Shield },
  { key: 'payments',       label: 'Paiements',                           icon: CreditCard },
  { key: 'notifications',  label: 'Notifications',                       icon: Bell },
  { key: 'administration', label: 'Administration',                      icon: Layers },
]

// Spec 28.2 — table des technologies envisageables
const TECH_STACK = [
  { layer: 'Frontend',                         solution: 'React / Next.js' },
  { layer: 'Interface et composants',          solution: 'Tailwind CSS' },
  { layer: 'Backend',                          solution: 'API centralisée' },
  { layer: 'Base de données',                  solution: 'PostgreSQL / Supabase' },
  { layer: 'Authentification',                 solution: 'Supabase Auth ou équivalent' },
  { layer: 'Stockage',                         solution: 'Stockage privé compatible S3' },
  { layer: 'Notifications',                    solution: 'Service e-mail et push' },
  { layer: 'Paiement',                         solution: 'Prestataire compatible moyens de paiement sénégalais' },
  { layer: 'Hébergement',                      solution: 'Infrastructure sécurisée adaptée aux données de santé' },
  { layer: 'Mobile ultérieur',                 solution: 'Capacitor ou développement natif' },
]

// Spec 28.5 — règles de performance
const PERF_RULES = [
  { label: 'Réduire le poids des images',                                   done: false },
  { label: 'Charger les données progressivement',                            done: true  },
  { label: 'Éviter les requêtes inutiles',                                   done: true  },
  { label: 'Afficher les erreurs réseau de façon compréhensible',            done: true  },
  { label: "Préserver les saisies non envoyées lorsque cela est possible",   done: false },
  {
    label: "Ne jamais confirmer une réservation ou un paiement sans confirmation du serveur",
    done: true,
  },
]

// Spec 28.1 — couches d'architecture
const ARCH_LAYERS = [
  {
    id: 'frontend',
    label: 'Interface (PWA / Web responsive)',
    detail: 'Interface commune adaptée aux quatre acteurs',
    color: 'bg-[var(--sw-primary-subtle)] border-[var(--sw-primary)]',
    textColor: 'text-[var(--sw-primary)]',
    icon: Smartphone,
  },
  {
    id: 'backend',
    label: 'Backend & API centrale',
    detail: 'Règles métier, permissions et événements',
    color: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)]',
    textColor: 'text-[var(--sw-ink)]',
    icon: Server,
  },
  {
    id: 'db',
    label: 'Base de données PostgreSQL',
    detail: 'Données centrales — relations, contraintes, RLS',
    color: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)]',
    textColor: 'text-[var(--sw-ink)]',
    icon: Database,
  },
  {
    id: 'storage',
    label: 'Stockage sécurisé',
    detail: 'Documents et ordonnances',
    color: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)]',
    textColor: 'text-[var(--sw-ink)]',
    icon: Layers,
  },
  {
    id: 'notif',
    label: 'Notifications',
    detail: 'E-mail, push, SMS',
    color: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)]',
    textColor: 'text-[var(--sw-ink)]',
    icon: Bell,
  },
  {
    id: 'payments',
    label: 'Paiements',
    detail: 'Connecteurs PSP',
    color: 'bg-[var(--sw-surface-2)] border-[var(--sw-line)]',
    textColor: 'text-[var(--sw-ink)]',
    icon: CreditCard,
  },
]

export default async function ArchitecturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin')
    redirect('/connexion')

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Architecture technique</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 28 — architecture recommandée, modules, évolutivité mobile</p>
      </div>

      {/* ── Spec 28.1 — Architecture en couches ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Architecture recommandée (spec 28.1)
        </h2>
        <div className="space-y-2">
          {ARCH_LAYERS.map(layer => {
            const Icon = layer.icon
            return (
              <div
                key={layer.id}
                className={`flex items-start gap-3 p-3 rounded-xl border ${layer.color}`}
              >
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${layer.textColor}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${layer.textColor}`}>{layer.label}</p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{layer.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-[var(--sw-ink-3)] italic">
          Application web responsive / PWA — interface commune adaptée aux quatre acteurs (patient, professionnel, pharmacie, organisme de couverture).
        </p>
      </section>

      {/* ── Spec 28.2 — Technologies envisageables ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Server className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Technologies envisageables (spec 28.2)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            <div className="grid grid-cols-2 px-4 py-2 bg-[var(--sw-surface-2)]">
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Couche</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Solution envisageable</p>
            </div>
            {TECH_STACK.map(row => (
              <div key={row.layer} className="grid grid-cols-2 px-4 py-2.5">
                <p className="text-sm text-[var(--sw-ink)]">{row.layer}</p>
                <p className="text-sm text-[var(--sw-ink-2)]">{row.solution}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
          <AlertCircle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[var(--sw-ink-3)]">
            Ces technologies sont des propositions d'implémentation, pas des obligations fonctionnelles (spec 28.2).
          </p>
        </div>
      </section>

      {/* ── Spec 28.3 — Séparation des modules ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Séparation des modules (spec 28.3)
        </h2>
        <p className="text-xs text-[var(--sw-ink-2)]">
          Chaque module peut évoluer indépendamment sans reconstruire l'application entière.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODULES.map((mod, i) => {
            const Icon = mod.icon
            return (
              <div key={mod.key} className="flex items-center gap-2.5 p-3 sw-card">
                <span className="w-5 h-5 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <Icon className="w-3.5 h-3.5 text-[var(--sw-ink-3)] shrink-0" aria-hidden="true" />
                <p className="text-sm text-[var(--sw-ink)]">{mod.label}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Spec 28.4 — Évolutivité mobile ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Évolutivité mobile (spec 28.4)
        </h2>
        <div className="sw-card p-4 space-y-3">
          {[
            {
              title: "V1 — navigateur mobile",
              detail: "La première version doit fonctionner parfaitement sur navigateur mobile (PWA).",
            },
            {
              title: "API réutilisable",
              detail: "L'API doit être réutilisable par une future application Android et iOS sans modification.",
            },
            {
              title: "Règles métier côté backend",
              detail: "Les données et les règles métier restent côté backend — les applications web et mobiles utilisent les mêmes règles et les mêmes dossiers.",
            },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[var(--sw-ink)]">{item.title}</p>
                <p className="text-xs text-[var(--sw-ink-3)]">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Spec 28.5 — Performances et connectivité ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Performances et connectivité (spec 28.5)
        </h2>
        <p className="text-xs text-[var(--sw-ink-2)]">
          Optimisée pour les connexions mobiles parfois lentes.
        </p>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {PERF_RULES.map(rule => (
              <div key={rule.label} className="flex items-center gap-3 px-4 py-3">
                {rule.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)] shrink-0" aria-label="Implémenté" />
                ) : (
                  <Zap className="w-4 h-4 text-[var(--sw-warning)] shrink-0" aria-label="À implémenter" />
                )}
                <p className="text-sm text-[var(--sw-ink)] flex-1">{rule.label}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  rule.done
                    ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]'
                    : 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]'
                }`}>
                  {rule.done ? 'En place' : 'À prévoir'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
          <AlertCircle className="w-4 h-4 text-[var(--sw-danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[var(--sw-danger)] font-medium">
            Règle critique (spec 28.5) — ne jamais confirmer une réservation ou un paiement
            sans confirmation du serveur, quelle que soit la qualité de la connexion.
          </p>
        </div>
      </section>
    </div>
  )
}
