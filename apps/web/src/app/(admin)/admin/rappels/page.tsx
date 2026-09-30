import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Clock, Bell, Calendar, Package, AlertTriangle, FileText, CreditCard, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Rappels automatiques — Admin' }

// Spec 19.3 — types de rappels automatiques configurables
type ReminderRule = {
  key: string
  label: string
  description: string
  default_delay_minutes: number
  disableable: boolean
  icon: React.ReactNode
  category: string
}

const REMINDER_RULES: ReminderRule[] = [
  {
    key: 'appointment_24h',
    label: 'Rappel rendez-vous — 24 h avant',
    description: 'Envoyé au patient et au professionnel 24 heures avant le rendez-vous.',
    default_delay_minutes: 1440,
    disableable: true,
    icon: <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />,
    category: 'rdv',
  },
  {
    key: 'appointment_1h',
    label: 'Rappel rendez-vous — 1 h avant',
    description: 'Envoyé au patient 1 heure avant le rendez-vous.',
    default_delay_minutes: 60,
    disableable: true,
    icon: <Calendar className="w-4 h-4 text-[var(--sw-primary)]" />,
    category: 'rdv',
  },
  {
    key: 'reservation_expiring',
    label: 'Réservation prête — avant expiration',
    description: 'Rappel au patient quand sa réservation prête expire bientôt.',
    default_delay_minutes: 120, // 2h avant expiration
    disableable: true,
    icon: <Package className="w-4 h-4 text-[var(--sw-warning)]" />,
    category: 'pharmacie',
  },
  {
    key: 'document_missing',
    label: 'Document manquant',
    description: "Relance au patient si une pièce requise n'a pas été transmise.",
    default_delay_minutes: 2880, // 48h
    disableable: true,
    icon: <FileText className="w-4 h-4 text-orange-500" />,
    category: 'consultations',
  },
  {
    key: 'payment_pending',
    label: 'Règlement en attente',
    description: 'Relance au patient pour un reste à charge non réglé. Ne mentionne aucune donnée médicale.',
    default_delay_minutes: 1440, // 24h
    disableable: true,
    icon: <CreditCard className="w-4 h-4 text-[var(--sw-warning)]" />,
    category: 'paiements',
  },
  {
    key: 'dossier_delay',
    label: 'Dossier en délai dépassé',
    description: 'Alerte admin quand une demande de couverture ou réservation dépasse le délai configuré.',
    default_delay_minutes: 4320, // 72h
    disableable: false, // spec 19.3 — indispensable pour la supervision
    icon: <AlertTriangle className="w-4 h-4 text-[var(--sw-danger)]" />,
    category: 'admin',
  },
]

type DbRule = {
  key: string; enabled: boolean; delay_minutes: number; updated_at: string
}

type SelectRuleFn = {
  select: (q: string) => {
    in: (c: string, v: string[]) => Promise<{ data: unknown[] | null }>
  }
}

// Pending reminder stats
type RawCount = {
  select: (q: string, opts: { count: string; head: boolean }) => {
    eq: (c: string, v: string) => {
      gte: (c: string, v: string) => Promise<{ count: number | null }>
    }
  }
}

function fmtDelay(mins: number) {
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.round(mins / 60)} h`
  return `${Math.round(mins / 1440)} j`
}

export default async function AdminRappelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  // Fetch configured rules from DB
  const { data: rawRules } = await (supabase.from('reminder_rules') as unknown as SelectRuleFn)
    .select('key, enabled, delay_minutes, updated_at')
    .in('key', REMINDER_RULES.map(r => r.key))

  const dbRules = (rawRules ?? []) as DbRule[]

  // Merge static config with DB overrides
  const rules = REMINDER_RULES.map(r => {
    const db = dbRules.find(d => d.key === r.key)
    return {
      ...r,
      enabled: db ? db.enabled : true,
      delay_minutes: db ? db.delay_minutes : r.default_delay_minutes,
      last_updated: db?.updated_at ?? null,
    }
  })

  // Emails non encore lus dans la table notifications (channel = 'email')
  type CountQuery = {
    select: (q: string, opts: { count: string; head: boolean }) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: boolean) => Promise<{ count: number | null }>
      }
    }
  }
  const { count: pendingEmailCount } = await (supabase.from('notifications') as unknown as CountQuery)
    .select('id', { count: 'exact', head: true })
    .eq('channel', 'email')
    .eq('is_read', false)

  const CATEGORY_LABELS: Record<string, string> = {
    rdv: 'Rendez-vous', consultations: 'Consultations', pharmacie: 'Pharmacie',
    paiements: 'Paiements', admin: 'Administration',
  }

  const grouped = REMINDER_RULES.reduce<Record<string, typeof rules>>((acc, r) => {
    const g = r.category
    if (!acc[g]) acc[g] = []
    acc[g].push(rules.find(x => x.key === r.key)!)
    return acc
  }, {})

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Rappels automatiques</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 19.3 — configuration des règles de rappel</p>
      </div>

      {/* Stat en-tête */}
      <div className="grid grid-cols-2 gap-3">
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-warning-bg)] flex items-center justify-center">
            <Bell className="w-5 h-5 text-[var(--sw-warning)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">E-mails en attente</p>
            <p className="text-xl font-bold text-[var(--sw-ink)]">{pendingEmailCount ?? 0}</p>
          </div>
        </div>
        <div className="sw-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-success-bg)] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-[var(--sw-success)]" />
          </div>
          <div>
            <p className="text-xs text-[var(--sw-ink-3)]">Règles actives</p>
            <p className="text-xl font-bold text-[var(--sw-ink)]">{rules.filter(r => r.enabled).length} / {rules.length}</p>
          </div>
        </div>
      </div>

      {/* Règles par catégorie */}
      {Object.entries(grouped).map(([cat, catRules]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)]">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <div className="sw-card overflow-hidden">
            <div className="divide-y divide-[var(--sw-line)]">
              {catRules.map(rule => (
                <div key={rule.key} className="px-4 py-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    {rule.icon}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--sw-ink)]">{rule.label}</p>
                      {rule.enabled ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-success-bg)] text-[var(--sw-success)]">Actif</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]">Désactivé</span>
                      )}
                      {!rule.disableable && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-[var(--sw-danger)]">Obligatoire</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--sw-ink-2)]">{rule.description}</p>
                    <div className="flex items-center gap-3 text-xs text-[var(--sw-ink-3)]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Délai : <strong>{fmtDelay(rule.delay_minutes)}</strong></span>
                      </div>
                      {rule.last_updated && (
                        <span>Modifié le {new Date(rule.last_updated).toLocaleDateString('fr-SN')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Note spec 19.3 */}
      <div className="flex items-start gap-2 p-3.5 rounded-xl bg-[var(--sw-surface-2)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Spec 19.3 : les rappels automatiques ne révèlent aucune donnée médicale sensible (nom du médicament, diagnostic, etc.).
          Les rappels marqués &quot;Obligatoires&quot; ne peuvent être désactivés, conformément aux obligations de service.
        </p>
      </div>
    </div>
  )
}
