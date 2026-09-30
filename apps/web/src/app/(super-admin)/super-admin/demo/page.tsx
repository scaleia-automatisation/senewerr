import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  FlaskConical, User, Stethoscope, Building2, Pill, Shield, ShieldAlert,
  CheckCircle2, AlertTriangle, Package, PlayCircle, Database
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Démonstration — Super Admin' }

// Spec 29.2 — comptes de test principaux
const DEMO_ACCOUNTS = [
  {
    role: 'Patient',        name: 'Awa Diop',                       email: 'patient@test.senewerr.sn',
    actor_type: 'patient',  icon: User,        color: 'text-[var(--sw-primary)]',
  },
  {
    role: 'Professionnel',  name: 'Dr Mamadou Ndiaye',              email: 'medecin@test.senewerr.sn',
    actor_type: 'sante',    icon: Stethoscope, color: 'text-[var(--sw-success)]',
  },
  {
    role: 'Établissement',  name: 'Clinique de démonstration',      email: 'clinique@test.senewerr.sn',
    actor_type: 'sante',    icon: Building2,   color: 'text-[var(--sw-success)]',
  },
  {
    role: 'Pharmacie',      name: 'Pharmacie du Centre',            email: 'pharmacie@test.senewerr.sn',
    actor_type: 'pharmacie',icon: Pill,        color: 'text-yellow-600',
  },
  {
    role: 'Couverture',     name: 'Mutuelle de démonstration',      email: 'mutuelle@test.senewerr.sn',
    actor_type: 'couverture',icon: Shield,     color: 'text-purple-600',
  },
  {
    role: 'Admin',          name: 'Administrateur de test',         email: 'admin@test.senewerr.sn',
    actor_type: 'admin',    icon: ShieldAlert, color: 'text-[var(--sw-warning)]',
  },
  {
    role: 'Super Admin',    name: 'Super administrateur de test',   email: 'superadmin@test.senewerr.sn',
    actor_type: 'super_admin', icon: ShieldAlert, color: 'text-[var(--sw-danger)]',
  },
]

// Spec 29.3 — médicaments fictifs
const DEMO_MEDS = [
  { ref: 'TEST-MED-001', name: 'Médicament Démo A', dosage: '500 mg',    stock: 30  },
  { ref: 'TEST-MED-002', name: 'Médicament Démo B', dosage: '250 mg',    stock: 15  },
  { ref: 'TEST-MED-003', name: 'Médicament Démo C', dosage: '1 000 mg',  stock: 0   },
  { ref: 'TEST-MED-004', name: 'Médicament Démo D', dosage: '100 mg',    stock: 50  },
  { ref: 'TEST-MED-005', name: 'Médicament Démo E', dosage: '10 mg',     stock: 20  },
]

// Spec 29.4 — données de test complémentaires
const COMPLEMENTARY_DATA = [
  'Patients fictifs (Ibrahima Fall, Fatou Sall)',
  'Professionnels fictifs (Dr Aissatou Ba)',
  'Établissements de chaque catégorie (cabinet, clinique, hôpital)',
  'Pharmacies avec différents niveaux de stock',
  'Organismes avec plusieurs formules (mutuelle, IPM)',
  'Ordonnances de test (actives, expirées, partiellement servies)',
  'Réservations dans tous les statuts (en attente, confirmée, collectée, annulée)',
  'Paiements simulés (validés, en attente, remboursés)',
  'Demandes de prise en charge validées et refusées',
]

// Spec 29.5 — scénarios de démonstration
const DEMO_SCENARIOS = [
  {
    n: 1,
    label: 'Patient sans couverture qui réserve et retire un médicament',
    accounts: ['patient@test.senewerr.sn', 'pharmacie@test.senewerr.sn'],
    tags: ['pharmacie', 'paiement'],
  },
  {
    n: 2,
    label: 'Patient couvert avec prise en charge intégrale',
    accounts: ['patient@test.senewerr.sn', 'mutuelle@test.senewerr.sn'],
    tags: ['couverture', 'tiers payant'],
  },
  {
    n: 3,
    label: 'Patient couvert avec reste à charge',
    accounts: ['patient@test.senewerr.sn', 'mutuelle@test.senewerr.sn'],
    tags: ['couverture', 'paiement partiel'],
  },
  {
    n: 4,
    label: "Patient dont la demande de prise en charge est refusée",
    accounts: ['patient@test.senewerr.sn', 'mutuelle@test.senewerr.sn'],
    tags: ['couverture', 'refus'],
  },
  {
    n: 5,
    label: "Pharmacie qui refuse une réservation faute de stock",
    accounts: ['patient@test.senewerr.sn', 'pharmacie@test.senewerr.sn'],
    tags: ['pharmacie', 'stock 0 — Médicament Démo C'],
  },
  {
    n: 6,
    label: "Professionnel qui crée une ordonnance et la partage",
    accounts: ['medecin@test.senewerr.sn', 'patient@test.senewerr.sn'],
    tags: ['ordonnance', 'partage'],
  },
  {
    n: 7,
    label: "Établissement qui invite un professionnel",
    accounts: ['clinique@test.senewerr.sn', 'medecin2@test.senewerr.sn'],
    tags: ['établissement', 'invitation'],
  },
  {
    n: 8,
    label: "Organisme qui demande un complément d'information",
    accounts: ['mutuelle@test.senewerr.sn', 'patient@test.senewerr.sn'],
    tags: ['couverture', 'complement'],
  },
  {
    n: 9,
    label: "Admin qui valide un compte professionnel",
    accounts: ['admin@test.senewerr.sn', 'medecin2@test.senewerr.sn'],
    tags: ['administration', 'vérification'],
  },
  {
    n: 10,
    label: "Super admin qui crée un admin et limite ses permissions",
    accounts: ['superadmin@test.senewerr.sn'],
    tags: ['super admin', 'permissions'],
  },
]

export default async function DemoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin')
    redirect('/connexion')

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Environnement de démonstration</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 29 — comptes, données fictives et scénarios de test</p>
      </div>

      {/* Spec 29.1 — avertissement environnement */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--sw-warning-bg)]">
        <FlaskConical className="w-5 h-5 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--sw-warning)]">Environnement de test uniquement (spec 29.1)</p>
          <p className="text-xs text-[var(--sw-warning)]">
            Données entièrement fictives. Aucun véritable dossier médical ni paiement réel.
            Ne jamais appliquer le seed de démonstration en production.
          </p>
          <p className="text-xs text-[var(--sw-warning)] font-mono mt-1">
            Seed : supabase/seeds/demo_seed.sql · Mot de passe commun : Demo2024!
          </p>
        </div>
      </div>

      {/* Spec 29.2 — comptes de test */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <User className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Comptes de démonstration (spec 29.2)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            <div className="grid grid-cols-3 px-4 py-2 bg-[var(--sw-surface-2)]">
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Rôle</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Nom fictif</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">E-mail de test</p>
            </div>
            {DEMO_ACCOUNTS.map(acc => {
              const Icon = acc.icon
              return (
                <div key={acc.email} className="grid grid-cols-3 px-4 py-2.5 items-center">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${acc.color}`} aria-hidden="true" />
                    <span className="text-sm text-[var(--sw-ink)]">{acc.role}</span>
                  </div>
                  <p className="text-sm text-[var(--sw-ink-2)]">{acc.name}</p>
                  <p className="text-xs font-mono text-[var(--sw-ink-3)] truncate">{acc.email}</p>
                </div>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-[var(--sw-ink-3)]">
          Des comptes supplémentaires sont inclus dans le seed : patient2, patient3, medecin2, pharmacie2, mutuelle2.
        </p>
      </section>

      {/* Spec 29.3 — médicaments fictifs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Pill className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Médicaments fictifs (spec 29.3)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            <div className="grid grid-cols-4 px-4 py-2 bg-[var(--sw-surface-2)]">
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Référence</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Nom fictif</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Dosage</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Stock démo</p>
            </div>
            {DEMO_MEDS.map(med => (
              <div key={med.ref} className="grid grid-cols-4 px-4 py-2.5 items-center">
                <code className="text-xs font-mono text-[var(--sw-ink-3)]">{med.ref}</code>
                <p className="text-sm text-[var(--sw-ink)]">{med.name}</p>
                <p className="text-sm text-[var(--sw-ink-2)]">{med.dosage}</p>
                <span className={`text-xs font-medium ${
                  med.stock === 0
                    ? 'text-[var(--sw-danger)]'
                    : med.stock < 20
                      ? 'text-[var(--sw-warning)]'
                      : 'text-[var(--sw-success)]'
                }`}>
                  {med.stock === 0 ? 'Rupture' : `${med.stock} unités`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
          <AlertTriangle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[var(--sw-ink-3)]">
            Ces produits servent uniquement à tester les écrans, les stocks et les réservations.
            Ils ne doivent pas être présentés comme des médicaments réellement disponibles (spec 29.3).
          </p>
        </div>
      </section>

      {/* Spec 29.4 — données complémentaires */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Database className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Données de test complémentaires (spec 29.4)
        </h2>
        <div className="sw-card p-4 space-y-2">
          {COMPLEMENTARY_DATA.map(item => (
            <div key={item} className="flex items-start gap-2">
              <Package className="w-3.5 h-3.5 text-[var(--sw-ink-3)] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-[var(--sw-ink-2)]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Spec 29.5 — scénarios de démonstration */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Scénarios de démonstration (spec 29.5)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {DEMO_SCENARIOS.map(scenario => (
              <div key={scenario.n} className="flex items-start gap-3 px-4 py-3">
                <span className="w-6 h-6 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {scenario.n}
                </span>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm text-[var(--sw-ink)]">{scenario.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {scenario.accounts.map(acc => (
                      <span key={acc} className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] font-mono">
                        {acc}
                      </span>
                    ))}
                    {scenario.tags.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Note finale */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
        <CheckCircle2 className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Le seed complet est dans <code className="font-mono">supabase/seeds/demo_seed.sql</code>.
          À appliquer via <code className="font-mono">supabase db reset --linked</code> (environnement de test uniquement).
        </p>
      </div>
    </div>
  )
}
