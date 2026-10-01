import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Server, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Fonctionnalités — Super Admin' }

// Spec 22.2 — activation / désactivation des fonctionnalités
type FeatureFlag = {
  key: string; label: string; description: string; category: string
  enabled: boolean; critical: boolean; updated_at: string | null
}

const DEFAULT_FLAGS: Omit<FeatureFlag, 'enabled' | 'updated_at'>[] = [
  // Modules métiers
  { key: 'feature_appointments', label: 'Rendez-vous', description: 'Prise et gestion de rendez-vous médicaux', category: 'modules', critical: true },
  { key: 'feature_prescriptions', label: 'Ordonnances', description: 'Création et partage d\'ordonnances numériques', category: 'modules', critical: true },
  { key: 'feature_reservations', label: 'Réservations pharmacie', description: 'Réservation de médicaments en pharmacie', category: 'modules', critical: true },
  { key: 'feature_coverage', label: 'Couverture maladie', description: 'Demandes de prise en charge par organisme', category: 'modules', critical: false },
  { key: 'feature_litiges', label: 'Litiges et réclamations', description: 'Ouverture et suivi de litiges', category: 'modules', critical: false },
  // Paiements
  { key: 'feature_payment_mobile_money', label: 'Mobile Money', description: 'Paiements Orange Money, Wave, Free Money', category: 'paiements', critical: false },
  { key: 'feature_payment_especes', label: 'Paiement en espèces', description: 'Règlement en espèces à la pharmacie', category: 'paiements', critical: false },
  // Notifications
  { key: 'feature_email_notifications', label: 'Notifications e-mail', description: 'Envoi d\'e-mails via la file de notifications', category: 'notifications', critical: false },
  { key: 'feature_inapp_notifications', label: 'Notifications in-app', description: 'Notifications dans l\'application', category: 'notifications', critical: true },
  // Langues (spec 22.2 — gestion des langues)
  { key: 'feature_lang_fr', label: 'Langue : Français', description: 'Interface disponible en français', category: 'langues', critical: true },
  { key: 'feature_lang_wo', label: 'Langue : Wolof', description: 'Interface disponible en wolof', category: 'langues', critical: false },
  { key: 'feature_lang_en', label: 'Langue : Anglais', description: 'Interface disponible en anglais', category: 'langues', critical: false },
  // Environnements (spec 22.2)
  { key: 'feature_test_mode', label: 'Mode test', description: 'Activer les paiements de simulation et les comptes de test', category: 'environnement', critical: false },
  { key: 'feature_maintenance_mode', label: 'Mode maintenance', description: 'Bloquer l\'accès et afficher une page de maintenance', category: 'environnement', critical: false },
]

const CATEGORY_LABELS: Record<string, string> = {
  modules: 'Modules métiers', paiements: 'Paiements', notifications: 'Notifications',
  langues: 'Langues', environnement: 'Environnements',
}

async function toggleFeature(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const key = formData.get('key') as string
  const enabled = formData.get('enabled') === 'true'

  type UpsertFn = { upsert: (v: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }> }
  await (supabase.from('drapeaux_fonctionnalites') as unknown as UpsertFn)
    .upsert({ key, enabled, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'key' })

  // Spec 22.5 — historisation
  type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('evenements_systeme') as unknown as InsertFn).insert({
    event_type: 'feature_flag.changed',
    actor_type: 'super_admin',
    object_type: 'feature_flag',
    object_id: key,
    result: 'success',
    category: 'admin',
    metadata: { key, enabled },
  })

  revalidatePath('/super-admin/fonctionnalites')
}

export default async function SuperAdminFonctionnalitesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  type FetchFn = { select: (q: string) => Promise<{ data: unknown[] | null }> }
  const { data: rawFlags } = await (supabase.from('drapeaux_fonctionnalites') as unknown as FetchFn)
    .select('key, enabled, updated_at')

  type DbFlag = { key: string; enabled: boolean; updated_at: string | null }
  const dbMap = Object.fromEntries(((rawFlags ?? []) as unknown as DbFlag[]).map(f => [f.key, f]))

  const flags: FeatureFlag[] = DEFAULT_FLAGS.map(d => ({
    ...d,
    enabled: dbMap[d.key]?.enabled ?? true,
    updated_at: dbMap[d.key]?.updated_at ?? null,
  }))

  const categories = Array.from(new Set(DEFAULT_FLAGS.map(f => f.category)))

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Fonctionnalités</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 22.2 — activation ou désactivation des modules</p>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const catFlags = flags.filter(f => f.category === cat)
          return (
            <section key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] flex items-center gap-2">
                <Server className="w-3 h-3" /> {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="sw-card overflow-hidden">
                <div className="divide-y divide-[var(--sw-line)]">
                  {catFlags.map(flag => (
                    <div key={flag.key} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[var(--sw-ink)]">{flag.label}</p>
                          {flag.critical && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]">Critique</span>
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${flag.enabled ? 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]'}`}>
                            {flag.enabled ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--sw-ink-3)]">{flag.description}</p>
                        {flag.updated_at && (
                          <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Modifié le {new Date(flag.updated_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <form action={toggleFeature} className="shrink-0">
                        <input type="hidden" name="key" value={flag.key} />
                        <input type="hidden" name="enabled" value={flag.enabled ? 'false' : 'true'} />
                        <button
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${flag.enabled ? 'bg-red-50 text-[var(--sw-danger)] border border-red-200' : 'bg-[var(--sw-success-bg)] text-[var(--sw-success)] border border-green-200'}`}
                          title={flag.critical && flag.enabled ? 'Attention — fonctionnalité critique' : undefined}>
                          {flag.enabled ? 'Désactiver' : 'Activer'}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
