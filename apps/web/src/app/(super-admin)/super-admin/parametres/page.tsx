import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Settings, Clock, History } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paramétrage central — Super Admin' }

// Spec 22.5 — configuration globale historisée, ancienne et nouvelle valeur
type SettingRow = {
  key: string; value: string; category: string; description: string | null
  updated_at: string | null; updated_by: string | null; previous_value: string | null
}

// Valeurs par défaut si la table est vide
const DEFAULT_SETTINGS: Omit<SettingRow, 'updated_at' | 'updated_by' | 'previous_value'>[] = [
  // Durées de réservation
  { key: 'reservation_expiry_hours', value: '48', category: 'reservations', description: "Durée de validité d'une réservation en attente (heures)" },
  { key: 'reservation_ready_expiry_hours', value: '72', category: 'reservations', description: 'Durée de validité d\'une réservation prête à retirer (heures)' },
  { key: 'reservation_max_days_advance', value: '30', category: 'reservations', description: 'Nombre max de jours à l\'avance pour une réservation' },
  // Délais de relance
  { key: 'reminder_payment_delay_hours', value: '24', category: 'rappels', description: 'Délai avant rappel pour paiement en attente (heures)' },
  { key: 'reminder_appointment_h24', value: '1440', category: 'rappels', description: 'Rappel RDV — délai en minutes avant le RDV (1440 = 24h)' },
  { key: 'reminder_appointment_h1', value: '60', category: 'rappels', description: 'Rappel RDV — délai en minutes avant le RDV (60 = 1h)' },
  // Délais couverture
  { key: 'coverage_decision_deadline_hours', value: '72', category: 'couverture', description: 'Délai max pour une décision de couverture (heures)' },
  { key: 'coverage_partial_min_percent', value: '30', category: 'couverture', description: 'Taux minimum pour une couverture partielle (%)' },
  // Notifications
  { key: 'notification_email_enabled', value: 'true', category: 'notifications', description: "Activer les notifications par e-mail" },
  { key: 'notification_batch_size', value: '100', category: 'notifications', description: 'Nombre de notifications traitées par batch' },
  // Mobile Money
  { key: 'payment_orange_money_enabled', value: 'true', category: 'paiements', description: 'Activer Orange Money' },
  { key: 'payment_wave_enabled', value: 'true', category: 'paiements', description: 'Activer Wave' },
  { key: 'payment_free_money_enabled', value: 'true', category: 'paiements', description: 'Activer Free Money' },
  { key: 'payment_especes_enabled', value: 'true', category: 'paiements', description: 'Activer le paiement en espèces' },
]

const CATEGORY_LABELS: Record<string, string> = {
  reservations: 'Réservations', rappels: 'Rappels et relances', couverture: 'Couverture',
  notifications: 'Notifications', paiements: 'Prestataires de paiement',
}

// Spec 22.5 — sauvegarde avec historique (ancienne et nouvelle valeur)
async function saveSetting(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const key = formData.get('key') as string
  const newValue = formData.get('value') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string

  // Récupérer la valeur actuelle pour historique
  type FetchFn = { select: (q: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } }
  const { data: existing } = await (supabase.from('platform_settings') as unknown as FetchFn)
    .select('value')
    .eq('key', key)
    .maybeSingle()

  const previousValue = (existing as unknown as { value: string } | null)?.value ?? null

  type UpsertFn = {
    upsert: (v: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }>
  }
  await (supabase.from('platform_settings') as unknown as UpsertFn)
    .upsert({
      key, value: newValue, category, description,
      previous_value: previousValue,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

  // Spec 22.5 — historisation
  type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertFn).insert({
    event_type: 'platform_setting.changed',
    actor_type: 'super_admin',
    object_type: 'platform_setting',
    object_id: key,
    result: 'success',
    category: 'admin',
    metadata: { key, previous_value: previousValue, new_value: newValue },
  })

  revalidatePath('/super-admin/parametres')
}

export default async function SuperAdminParametresPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat: filterCat } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  // Charger les valeurs persistées
  type FetchFn = { select: (q: string) => Promise<{ data: unknown[] | null }> }
  const { data: rawSettings } = await (supabase.from('platform_settings') as unknown as FetchFn)
    .select('key, value, category, description, updated_at, updated_by, previous_value')

  const dbSettings = (rawSettings ?? []) as unknown as SettingRow[]
  const dbMap = Object.fromEntries(dbSettings.map(s => [s.key, s]))

  // Fusionner defaults + DB
  const settings: SettingRow[] = DEFAULT_SETTINGS.map(d => ({
    ...d,
    value: dbMap[d.key]?.value ?? d.value,
    updated_at: dbMap[d.key]?.updated_at ?? null,
    updated_by: dbMap[d.key]?.updated_by ?? null,
    previous_value: dbMap[d.key]?.previous_value ?? null,
  })).filter(s => !filterCat || s.category === filterCat)

  const categories = Array.from(new Set(DEFAULT_SETTINGS.map(s => s.category)))

  const TABS = [{ key: '', label: 'Tous' }, ...categories.map(c => ({ key: c, label: CATEGORY_LABELS[c] ?? c }))]

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Paramétrage central</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 22.5 — règles globales, modifications historisées avec ancienne et nouvelle valeur</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?cat=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterCat ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {categories.filter(c => !filterCat || c === filterCat).map(cat => {
          const catSettings = settings.filter(s => s.category === cat)
          if (catSettings.length === 0) return null
          return (
            <section key={cat} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] flex items-center gap-2">
                <Settings className="w-3 h-3" /> {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="sw-card overflow-hidden">
                <div className="divide-y divide-[var(--sw-line)]">
                  {catSettings.map(setting => (
                    <form key={setting.key} action={saveSetting} className="px-4 py-3.5 space-y-2">
                      <input type="hidden" name="key" value={setting.key} />
                      <input type="hidden" name="category" value={setting.category} />
                      <input type="hidden" name="description" value={setting.description ?? ''} />

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-[var(--sw-ink-3)]">{setting.key}</p>
                          <p className="text-sm font-medium text-[var(--sw-ink)]">{setting.description}</p>
                          {/* Spec 22.5 — afficher ancienne valeur */}
                          {setting.previous_value !== null && setting.previous_value !== setting.value && (
                            <p className="text-xs text-[var(--sw-ink-3)] mt-0.5 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              Ancienne valeur : <span className="font-mono">{setting.previous_value}</span>
                            </p>
                          )}
                          {setting.updated_at && (
                            <p className="text-xs text-[var(--sw-ink-3)]">
                              <Clock className="w-3 h-3 inline mr-1" />
                              Modifié le {new Date(setting.updated_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {setting.value === 'true' || setting.value === 'false' ? (
                            <select name="value" defaultValue={setting.value}
                              className="sw-input text-sm px-2 py-1.5">
                              <option value="true">Activé</option>
                              <option value="false">Désactivé</option>
                            </select>
                          ) : (
                            <input type="text" name="value" defaultValue={setting.value}
                              className="sw-input w-24 text-sm text-right font-mono" />
                          )}
                          <button className="px-3 py-1.5 rounded-xl bg-[var(--sw-primary)] text-white text-xs font-medium">
                            Sauver
                          </button>
                        </div>
                      </div>
                    </form>
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
