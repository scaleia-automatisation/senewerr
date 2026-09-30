// Spec 30 — Tests, déploiement et critères de validation
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/security/audit'
import {
  CheckCircle2, Circle, AlertTriangle, ShieldCheck, PlayCircle,
  XCircle, FlaskConical, Rocket, BookOpen
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Validation & Déploiement — Super Admin' }

// ── Spec 30.1 — Tests fonctionnels ──────────────────────────────────────────
const FUNCTIONAL_TESTS = [
  { module: 'Inscription',      test: 'Création et validation de chaque type de compte' },
  { module: 'Connexion',        test: 'Accès conforme au rôle' },
  { module: 'Recherche',        test: 'Résultats selon les filtres' },
  { module: 'Rendez-vous',      test: 'Réservation et prévention des doublons' },
  { module: 'Planning',         test: 'Gestion des absences et conflits' },
  { module: 'Consultation',     test: 'Création et clôture' },
  { module: 'Ordonnance',       test: 'Création, partage et contrôle d\'accès' },
  { module: 'Pharmacie',        test: 'Catalogue, stock et réservation' },
  { module: 'Couverture',       test: 'Validation, refus et calcul du reste à charge' },
  { module: 'Paiements',        test: 'Confirmation, échec et rapprochement' },
  { module: 'Retrait',          test: 'Contrôle du code et absence de double retrait' },
  { module: 'Notifications',    test: 'Destinataires et contenu corrects' },
  { module: 'Administration',   test: 'Permissions et traçabilité' },
  { module: 'Multilingue',      test: 'Traduction de tous les écrans et messages' },
]

// ── Spec 30.2 — Parcours bout en bout n°1 ───────────────────────────────────
const E2E_STEPS = [
  { n: 1,  actor: 'Patient',    step: 'Le patient se connecte' },
  { n: 2,  actor: 'Patient',    step: 'Il choisit un médicament disponible' },
  { n: 3,  actor: 'Patient',    step: 'Il sélectionne sa pharmacie' },
  { n: 4,  actor: 'Patient',    step: "Il transmet son ordonnance si nécessaire" },
  { n: 5,  actor: 'Pharmacie',  step: 'La pharmacie confirme la réservation' },
  { n: 6,  actor: 'Couverture', step: "L'organisme valide la prise en charge" },
  { n: 7,  actor: 'Patient',    step: 'Le patient règle son reste à charge' },
  { n: 8,  actor: 'Pharmacie',  step: 'La pharmacie confirme le financement requis' },
  { n: 9,  actor: 'Pharmacie',  step: 'La pharmacie prépare la réservation' },
  { n: 10, actor: 'Patient',    step: 'Le patient reçoit la notification de disponibilité' },
  { n: 11, actor: 'Pharmacie',  step: 'La pharmacie vérifie le code de retrait' },
  { n: 12, actor: 'Système',    step: "Le retrait est enregistré et l'historique est actualisé" },
]

const ACTOR_COLORS: Record<string, string> = {
  Patient:    'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  Pharmacie:  'bg-yellow-50 text-yellow-700',
  Couverture: 'bg-purple-50 text-purple-700',
  Système:    'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

// ── Spec 30.3 — Cas d'erreur ─────────────────────────────────────────────────
const ERROR_CASES = [
  'Téléphone déjà utilisé lors de l\'inscription',
  'Compte non validé tentant de se connecter',
  'Créneau déjà réservé (prévention des doublons)',
  'Stock devenu insuffisant entre réservation et retrait',
  'Ordonnance non valide ou expirée',
  'Couverture expirée lors de la validation',
  'Plafond de remboursement dépassé',
  'Paiement refusé par le prestataire',
  'Paiement confirmé plusieurs fois par le prestataire (idempotence)',
  'Réservation expirée non collectée',
  'Code de retrait incorrect',
  'Retrait déjà enregistré (double retrait)',
  "Tentative d'accès à un dossier non autorisé",
]

// ── Spec 30.4 — Tests de sécurité ───────────────────────────────────────────
const SECURITY_TESTS = [
  "Un patient ne peut pas consulter le dossier d'un autre patient",
  "Une pharmacie ne peut pas accéder aux données d'une autre pharmacie",
  "Un professionnel ne peut pas consulter les dossiers sans justification d'accès",
  "Un organisme ne peut pas accéder aux informations des adhérents d'un autre organisme",
  "Un admin ne peut pas effectuer une action hors de ses permissions",
  "Les documents sensibles ne sont pas accessibles publiquement",
  "Les actions sensibles sont historisées dans system_events",
]

// ── Spec 30.5 — Checklist de lancement ──────────────────────────────────────
const LAUNCH_ITEMS: { id: string; label: string }[] = [
  { id: 'espaces_fonctionnels', label: 'Les quatre espaces métiers sont fonctionnels' },
  { id: 'comptes_roles',        label: 'Les comptes et rôles sont correctement configurés' },
  { id: 'rdv_testes',           label: 'Les parcours de rendez-vous sont testés' },
  { id: 'ordo_testes',          label: "Les parcours d'ordonnance sont testés" },
  { id: 'reservations_ok',      label: 'Les réservations et retraits sont opérationnels' },
  { id: 'tiers_payant_ok',      label: 'Le tiers payant et les remboursements sont testés' },
  { id: 'notifs_ok',            label: 'Les notifications sont vérifiées' },
  { id: 'donnees_separees',     label: 'Les données de test sont séparées de la production' },
  { id: 'securite_ok',          label: 'Les contrôles d\'accès et la sécurité sont testés' },
  { id: 'sauvegardes_ok',       label: 'Les sauvegardes et restaurations sont vérifiées' },
  { id: 'traductions_ok',       label: 'Les traductions françaises, wolof et anglaises sont relues' },
  { id: 'conformite_ok',        label: 'Les formalités réglementaires et contractuelles sont validées' },
]

// ── Spec 30 synthèse — Décisions structurantes ──────────────────────────────
const STRUCTURAL_DECISIONS = [
  "Le patient reste entièrement gratuit, sans achat de médicaments en ligne ni livraison.",
  "Les quatre acteurs utilisent un socle commun, mais chaque espace possède ses propres menus, permissions et fonctionnalités.",
  "Le tiers payant doit éviter l'avance de frais pour la part couverte, lorsque la convention le permet.",
  "Les établissements et les professionnels indépendants sont regroupés dans le même espace Santé, avec des fonctions adaptées à leurs activités.",
  "Les mutuelles, MSAE, IPM et assurances privées partagent un espace Couverture, tout en conservant leurs propres contrats et règles.",
  "L'admin et le super admin pilotent la plateforme, sans intervenir inutilement dans les décisions médicales ou financières des organismes.",
  "L'interface doit rester simple, même si le fonctionnement technique est plus élaboré.",
  "La version web doit être conçue pour évoluer vers Android et iOS, sans dupliquer les règles métier.",
]

// ── Server action : cocher/décocher un item de la checklist ─────────────────
async function toggleLaunchItem(formData: FormData) {
  'use server'
  const itemId = formData.get('item_id') as string
  const currentDone = formData.get('current_done') === 'true'
  if (!itemId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Lire l'état actuel depuis platform_settings
  type PlatformRow = { key: string; value: unknown }
  type QueryFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => Promise<{ data: unknown[] | null }>
    }
  }
  const { data: existing } = await (supabase.from('platform_settings') as unknown as QueryFn)
    .select('key, value')
    .eq('key', 'launch_checklist_v1')

  const rows = (existing ?? []) as PlatformRow[]
  const current: Record<string, boolean> = (rows[0]?.value as Record<string, boolean>) ?? {}
  current[itemId] = !currentDone

  type UpsertFn = { upsert: (v: unknown, opts: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('platform_settings') as unknown as UpsertFn).upsert(
    { key: 'launch_checklist_v1', value: current, category: 'deploiement', updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )

  await logAudit({
    action: 'platform.checklist_update',
    result: 'success',
    category: 'systeme',
    metadata: { item_id: itemId, done: !currentDone },
  })

  revalidatePath('/super-admin/validation')
}

export default async function ValidationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase
    .from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin')
    redirect('/connexion')

  // Lire l'état de la checklist depuis platform_settings
  type PlatformRow = { value: unknown }
  type QueryFn = {
    select: (q: string) => {
      eq: (c: string, v: string) => Promise<{ data: unknown[] | null }>
    }
  }
  const { data: settingsData } = await (supabase.from('platform_settings') as unknown as QueryFn)
    .select('value')
    .eq('key', 'launch_checklist_v1')

  const rows = (settingsData ?? []) as PlatformRow[]
  const checklist: Record<string, boolean> = (rows[0]?.value as Record<string, boolean>) ?? {}
  const doneCount = LAUNCH_ITEMS.filter(item => checklist[item.id]).length
  const total = LAUNCH_ITEMS.length
  const pct = Math.round((doneCount / total) * 100)
  const allDone = doneCount === total

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Tests & Validation</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 30 — tests fonctionnels, parcours, sécurité, critères de mise en production</p>
      </div>

      {/* ── Spec 30.1 — Tests fonctionnels ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Tests fonctionnels par module (spec 30.1)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            <div className="grid grid-cols-5 px-4 py-2 bg-[var(--sw-surface-2)]">
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide col-span-2">Module</p>
              <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide col-span-3">Test obligatoire</p>
            </div>
            {FUNCTIONAL_TESTS.map(row => (
              <div key={row.module} className="grid grid-cols-5 px-4 py-2.5 items-start">
                <p className="text-sm font-medium text-[var(--sw-ink)] col-span-2">{row.module}</p>
                <p className="text-sm text-[var(--sw-ink-2)] col-span-3">{row.test}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Spec 30.2 — Parcours bout en bout ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Parcours bout en bout — Patient couvert avec tiers payant (spec 30.2)
        </h2>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {E2E_STEPS.map(s => (
              <div key={s.n} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 h-6 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-bold flex items-center justify-center shrink-0">
                  {s.n}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${ACTOR_COLORS[s.actor] ?? ''}`}>
                  {s.actor}
                </span>
                <p className="text-sm text-[var(--sw-ink)]">{s.step}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-primary-subtle)]">
          <CheckCircle2 className="w-4 h-4 text-[var(--sw-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-[var(--sw-primary)]">
            Résultat attendu : chaque acteur voit uniquement les informations qui le concernent et les statuts sont cohérents.
          </p>
        </div>
      </section>

      {/* ── Spec 30.3 — Cas d'erreur ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <XCircle className="w-4 h-4 text-[var(--sw-danger)]" aria-hidden="true" />
          Tests des cas d'erreur (spec 30.3)
        </h2>
        <div className="sw-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ERROR_CASES.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[var(--sw-warning)] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-[var(--sw-ink-2)]">{c}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Spec 30.4 — Sécurité ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Tests de sécurité (spec 30.4)
        </h2>
        <div className="sw-card p-4 space-y-2">
          {SECURITY_TESTS.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--sw-success)] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-[var(--sw-ink-2)]">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Spec 30.5 — Checklist de lancement ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
          Checklist de mise en production (spec 30.5)
        </h2>
        {/* Barre de progression */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--sw-ink-3)]">
            <span>Progression</span>
            <span className={allDone ? 'text-[var(--sw-success)] font-medium' : ''}>{doneCount}/{total}</span>
          </div>
          <div className="h-2 bg-[var(--sw-surface-2)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allDone ? 'bg-[var(--sw-success)]' : 'bg-[var(--sw-primary)]'}`}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={total}
            />
          </div>
        </div>

        {allDone && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-success-bg)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--sw-success)]">
              Tous les critères sont validés — l'application est prête pour la mise en production.
            </p>
          </div>
        )}

        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {LAUNCH_ITEMS.map(item => {
              const done = checklist[item.id] ?? false
              return (
                <form key={item.id} action={toggleLaunchItem} className="flex items-center gap-3 px-4 py-3">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="current_done" value={String(done)} />
                  <button
                    type="submit"
                    className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary)] rounded"
                    aria-label={done ? `Décocher : ${item.label}` : `Cocher : ${item.label}`}
                  >
                    {done
                      ? <CheckCircle2 className="w-5 h-5 text-[var(--sw-success)]" />
                      : <Circle className="w-5 h-5 text-[var(--sw-ink-3)]" />
                    }
                  </button>
                  <p className={`text-sm flex-1 ${done ? 'line-through text-[var(--sw-ink-3)]' : 'text-[var(--sw-ink)]'}`}>
                    {item.label}
                  </p>
                </form>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Synthèse — Architecture finale ── */}
      <section className="space-y-4">
        <div className="border-t border-[var(--sw-line)] pt-6">
          <h2 className="text-base font-bold text-[var(--sw-ink)] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--sw-primary)]" aria-hidden="true" />
            Synthèse — Architecture finale de Séné Wérr
          </h2>
          <p className="text-xs text-[var(--sw-ink-2)] mt-1">
            Une seule plateforme, quatre espaces métiers — un dossier patient centralisé et des parcours interconnectés.
          </p>
        </div>

        {/* 4 acteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Patient',     detail: 'Gratuit',                            color: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]' },
            { label: 'Pharmacie',   detail: 'Abonnement et commission',           color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Santé',       detail: 'Professionnels et établissements',   color: 'bg-green-50 text-green-700' },
            { label: 'Couverture',  detail: 'Mutuelles, IPM, assurances',         color: 'bg-purple-50 text-purple-700' },
          ].map(actor => (
            <div key={actor.label} className={`rounded-xl p-3 text-center ${actor.color}`}>
              <p className="text-sm font-bold">{actor.label}</p>
              <p className="text-xs mt-0.5 opacity-80">{actor.detail}</p>
            </div>
          ))}
        </div>

        {/* Socle central */}
        <div className="p-3 rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface-2)] text-center">
          <p className="text-xs font-semibold text-[var(--sw-ink)]">Socle central Séné Wérr</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
            Dossiers · Rendez-vous · Ordonnances · Réservations · Couverture · Paiements · Notifications
          </p>
        </div>

        <div className="p-3 rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface-2)] text-center">
          <p className="text-xs font-semibold text-[var(--sw-ink)]">Admin et Super Admin</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">Gestion, contrôle et supervision du SaaS</p>
        </div>

        {/* 8 décisions structurantes */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--sw-ink)]">Décisions structurantes à conserver</h3>
          <div className="sw-card p-4 space-y-3">
            {STRUCTURAL_DECISIONS.map((d, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-[var(--sw-ink-2)]">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Objectif final */}
        <div className="p-4 rounded-xl bg-[var(--sw-primary-subtle)]">
          <p className="text-xs font-semibold text-[var(--sw-primary)] mb-1">Objectif final</p>
          <p className="text-sm text-[var(--sw-primary)]">
            Permettre à un patient de commencer son parcours en recherchant un professionnel de santé,
            de poursuivre avec une consultation, une ordonnance et une réservation, puis de bénéficier
            de sa couverture et de retirer ses médicaments, tout en retrouvant l'ensemble de son parcours
            dans un seul espace.
          </p>
        </div>
      </section>
    </div>
  )
}
