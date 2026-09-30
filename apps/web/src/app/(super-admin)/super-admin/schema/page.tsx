import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Database, Link2, ShieldCheck, Building2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Schéma de base de données — Super Admin' }

// Spec 26 — référence du schéma pour le super admin
// Toutes les tables, groupes, relations et règles de cohérence

const TABLE_GROUPS = [
  {
    key: 'auth', label: 'Authentification', color: 'text-purple-600',
    tables: ['profiles', 'professional_specialties'],
    note: 'auth.users géré par Supabase Auth',
  },
  {
    key: 'patients', label: 'Patients', color: 'text-[var(--sw-primary)]',
    tables: ['patients', 'patient_beneficiaries', 'patient_consents'],
  },
  {
    key: 'sante', label: 'Santé', color: 'text-teal-600',
    tables: ['health_records', 'health_record_entries', 'documents'],
  },
  {
    key: 'professionals', label: 'Professionnels', color: 'text-blue-600',
    tables: ['professionals', 'professional_specialties', 'professional_qualifications'],
  },
  {
    key: 'establishments', label: 'Établissements', color: 'text-indigo-600',
    tables: ['establishments', 'establishment_services', 'professional_establishment_memberships'],
    note: 'Spec 26.5 — multi-organisation via memberships',
  },
  {
    key: 'pharmacies', label: 'Pharmacies', color: 'text-orange-500',
    tables: ['pharmacies', 'pharmacy_products', 'pharmacy_stock', 'pharmacy_stock_movements'],
  },
  {
    key: 'coverage', label: 'Couverture', color: 'text-[var(--sw-success)]',
    tables: ['coverage_orgs', 'coverage_members', 'coverage_plans', 'coverage_rules'],
  },
  {
    key: 'appointments', label: 'Rendez-vous', color: 'text-cyan-600',
    tables: ['schedules', 'schedule_slots', 'schedule_exceptions', 'appointments'],
  },
  {
    key: 'consultations', label: 'Consultations', color: 'text-[var(--sw-primary)]',
    tables: ['consultations', 'prescriptions', 'prescription_items'],
  },
  {
    key: 'reservations', label: 'Réservations', color: 'text-orange-600',
    tables: ['pharmacy_reservations', 'pharmacy_reservation_items'],
  },
  {
    key: 'prise_en_charge', label: 'Prise en charge', color: 'text-[var(--sw-success)]',
    tables: ['coverage_requests', 'coverage_decisions'],
  },
  {
    key: 'finances', label: 'Finances', color: 'text-yellow-600',
    tables: ['payments', 'payment_events', 'invoices', 'refunds'],
  },
  {
    key: 'notifications', label: 'Notifications', color: 'text-[var(--sw-warning)]',
    tables: ['notifications', 'notification_preferences'],
  },
  {
    key: 'tracabilite', label: 'Traçabilité', color: 'text-[var(--sw-ink-3)]',
    tables: ['audit_logs', 'event_logs', 'system_events'],
  },
  {
    key: 'administration', label: 'Administration', color: 'text-[var(--sw-danger)]',
    tables: ['subscriptions', 'platform_settings', 'feature_flags', 'archived_profiles'],
  },
]

// Spec 26.4 — règles de cohérence avec les colonnes NOT NULL concernées
const CONSISTENCY_RULES = [
  {
    rule: 'Un rendez-vous doit toujours être rattaché à un patient, à un professionnel et à un créneau.',
    tables: ['appointments'], keys: ['patient_id NOT NULL', 'schedule_id NOT NULL', 'professional_id | establishment_id NOT NULL'],
  },
  {
    rule: 'Une ordonnance doit toujours être rattachée à un patient et à son prescripteur.',
    tables: ['prescriptions'], keys: ['patient_id NOT NULL', 'professional_id NOT NULL'],
  },
  {
    rule: 'Une réservation doit toujours être rattachée à un patient et à une pharmacie.',
    tables: ['pharmacy_reservations'], keys: ['patient_id NOT NULL', 'pharmacy_id NOT NULL'],
  },
  {
    rule: 'Une demande de prise en charge doit être liée à un organisme et à une opération concernée.',
    tables: ['coverage_requests'], keys: ['coverage_org_id NOT NULL', 'prescription_id | reservation_id | appointment_id (au moins un)'],
  },
  {
    rule: 'Un paiement doit être rattaché à une opération et à un payeur.',
    tables: ['payments'], keys: ['payer_id NOT NULL', 'reservation_id | appointment_id | subscription_id (au moins un)'],
  },
  {
    rule: 'Un retrait ne peut être enregistré qu\'une seule fois pour une réservation.',
    tables: ['pharmacy_reservations'], keys: ['pickup_code UNIQUE', 'index unique partiel sur collected_at'],
  },
  {
    rule: 'Les données supprimées nécessaires à la traçabilité doivent être archivées ou anonymisées.',
    tables: ['archived_profiles', 'audit_logs'], keys: ['profiles.is_deleted', 'profiles.deleted_at'],
  },
]

// Spec 26.5 — multi-organisation
const MULTI_ORG_RULES = [
  'Un professionnel peut exercer dans plusieurs établissements via professional_establishment_memberships.',
  'Il conserve un seul profil (profiles + professionals), un seul identifiant.',
  'Les droits sont évalués selon l\'organisation sélectionnée et le rôle (memberships.role).',
  "Chaque organisation possède un identifiant UUID unique (profiles.id distinct par acteur).",
]

export default async function SchemaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || profile.actor_type !== 'super_admin') redirect('/connexion')

  // Comptages représentatifs (spec 26 — vérification cohérence)
  type CountQuery = { select: (q: string, opts: { count: string; head: boolean }) => Promise<{ count: number | null }> }
  const counts = await Promise.allSettled([
    (supabase.from('profiles') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('patients') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('professionals') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('pharmacies') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('appointments') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('prescriptions') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('pharmacy_reservations') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
    (supabase.from('payments') as unknown as CountQuery).select('id', { count: 'exact', head: true }),
  ])
  function cnt(r: PromiseSettledResult<{ count: number | null }>): number {
    return r.status === 'fulfilled' ? (r.value.count ?? 0) : 0
  }
  const [profiles, patients, professionals, pharmas, appointments, prescriptions, reservations, payments] = counts.map(cnt)

  const totalTables = TABLE_GROUPS.reduce((s, g) => s + g.tables.length, 0)

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Schéma de base de données</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 26 — PostgreSQL · {totalTables} tables · relations et contraintes</p>
      </div>

      {/* Comptages live */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Profils', value: profiles },
          { label: 'Patients', value: patients },
          { label: 'Professionnels', value: professionals },
          { label: 'Pharmacies', value: pharmas },
          { label: 'Rendez-vous', value: appointments },
          { label: 'Ordonnances', value: prescriptions },
          { label: 'Réservations', value: reservations },
          { label: 'Paiements', value: payments },
        ].map(({ label, value }) => (
          <div key={label} className="sw-card p-3 text-center">
            <p className="text-lg font-bold text-[var(--sw-ink)]">{value.toLocaleString('fr-SN')}</p>
            <p className="text-xs text-[var(--sw-ink-3)]">{label}</p>
          </div>
        ))}
      </div>

      {/* Groupes de tables — spec 26.2 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Tables principales (spec 26.2)</h2>
        </div>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {TABLE_GROUPS.map(g => (
              <div key={g.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className={`text-sm font-semibold ${g.color}`}>{g.label}</p>
                  <span className="text-xs text-[var(--sw-ink-3)] shrink-0">{g.tables.length} table{g.tables.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.tables.map(t => (
                    <code key={t} className="text-xs bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] px-1.5 py-0.5 rounded font-mono">
                      {t}
                    </code>
                  ))}
                </div>
                {g.note && (
                  <p className="text-xs text-[var(--sw-ink-3)] mt-1.5 italic">{g.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Règles de cohérence — spec 26.4 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Règles de cohérence (spec 26.4)</h2>
        </div>
        <div className="space-y-2">
          {CONSISTENCY_RULES.map((r, i) => (
            <div key={i} className="sw-card p-3">
              <p className="text-xs text-[var(--sw-ink)] font-medium mb-1.5">{r.rule}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.keys.map(k => (
                  <code key={k} className="text-xs bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] px-1.5 py-0.5 rounded font-mono">
                    {k}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-organisation — spec 26.5 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Multi-organisation (spec 26.5)</h2>
        </div>
        <div className="sw-card p-4 space-y-2">
          {MULTI_ORG_RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--sw-primary)] mt-1.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-[var(--sw-ink-2)]">{rule}</p>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-[var(--sw-line)]">
            <p className="text-xs text-[var(--sw-ink-3)]">
              Table pivot : <code className="bg-[var(--sw-surface-2)] px-1 rounded font-mono">professional_establishment_memberships</code>
              {' '}(professional_id, establishment_id, role, is_primary, joined_at, left_at)
            </p>
          </div>
        </div>
      </div>

      {/* Relations essentielles — spec 26.3 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-[var(--sw-ink-3)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Relations essentielles (spec 26.3)</h2>
        </div>
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {[
              ['appointments', 'patients', 'patient_id → patients.id'],
              ['appointments', 'professionals', 'professional_id → professionals.id'],
              ['appointments', 'schedules', 'schedule_id → schedules.id'],
              ['consultations', 'appointments', 'appointment_id → appointments.id (1:1)'],
              ['prescriptions', 'consultations', 'consultation_id → consultations.id'],
              ['prescriptions', 'patients', 'patient_id → patients.id NOT NULL'],
              ['pharmacy_reservations', 'patients', 'patient_id → patients.id NOT NULL'],
              ['pharmacy_reservations', 'pharmacies', 'pharmacy_id → pharmacies.id NOT NULL'],
              ['pharmacy_reservations', 'prescriptions', 'prescription_id → prescriptions.id'],
              ['coverage_requests', 'coverage_orgs', 'coverage_org_id → coverage_orgs.id NOT NULL'],
              ['coverage_requests', 'coverage_members', 'coverage_member_id → coverage_members.id'],
              ['payments', 'profiles', 'payer_id → profiles.id NOT NULL'],
              ['payments', 'pharmacy_reservations', 'reservation_id → pharmacy_reservations.id'],
              ['documents', 'profiles', 'owner_id → profiles.id NOT NULL'],
              ['system_events', 'profiles', 'actor_id → profiles.id'],
            ].map(([from, to, rel]) => (
              <div key={`${from}-${to}`} className="px-4 py-2.5 flex items-center gap-3">
                <code className="text-xs text-[var(--sw-primary)] font-mono shrink-0">{from}</code>
                <span className="text-xs text-[var(--sw-ink-3)] flex-1 font-mono">{rel}</span>
                <code className="text-xs text-[var(--sw-ink-2)] font-mono shrink-0">{to}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--sw-ink-3)]">
        Migration complète : <code className="font-mono bg-[var(--sw-surface-2)] px-1 rounded">supabase/migrations/0003_schema.sql</code> +
        compléments bloc 26 : <code className="font-mono bg-[var(--sw-surface-2)] px-1 rounded">0008_bloc26_additions.sql</code>
      </p>
    </div>
  )
}
