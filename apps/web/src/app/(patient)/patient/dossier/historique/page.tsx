import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Stethoscope, FileText, ShoppingBag, Shield, CreditCard, Package, CalendarCheck } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Historique — Mon dossier' }

type EventType = 'consultation' | 'ordonnance' | 'reservation' | 'retrait' | 'couverture' | 'paiement' | 'rendez-vous'

type TimelineEvent = {
  id: string
  date: string
  type: EventType
  title: string
  subtitle: string | null
  badge: string | null
  badgeClass: string
}

const TYPE_CONFIG: Record<EventType, { icon: typeof Stethoscope; color: string; bg: string }> = {
  'consultation': { icon: Stethoscope, color: 'text-[var(--sw-primary)]',  bg: 'bg-[var(--sw-primary-subtle)]' },
  'ordonnance':   { icon: FileText,    color: 'text-purple-600',           bg: 'bg-purple-50' },
  'reservation':  { icon: ShoppingBag, color: 'text-[var(--sw-warning)]',  bg: 'bg-[var(--sw-warning-bg)]' },
  'retrait':      { icon: Package,     color: 'text-[var(--sw-success)]',  bg: 'bg-[var(--sw-success-bg)]' },
  'couverture':   { icon: Shield,      color: 'text-blue-600',             bg: 'bg-blue-50' },
  'paiement':     { icon: CreditCard,  color: 'text-[var(--sw-ink-2)]',   bg: 'bg-[var(--sw-surface-2)]' },
  'rendez-vous':  { icon: CalendarCheck, color: 'text-teal-600',           bg: 'bg-teal-50' },
}

const STATUS_LABELS_CONSULT: Record<string, string> = {
  scheduled: 'Programmée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
}
const STATUS_LABELS_RES: Record<string, string> = {
  new: 'Nouvelle', verifying: 'Vérification', to_prepare: 'Confirmée',
  preparing: 'Préparation', ready: 'Prête', collected: 'Retirée', refused: 'Refusée', cancelled: 'Annulée',
}
const STATUS_LABELS_COV: Record<string, string> = {
  pending: 'En attente', needs_info: 'Info requise', approved: 'Validée', refused: 'Refusée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  completed: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  approved:  'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  pending:   'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  new:       'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  ready:     'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  refused:   'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

export default async function DossierHistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="sw-card p-10 text-center">
        <p className="text-sm text-[var(--sw-ink-2)]">Aucun historique disponible.</p>
      </div>
    </div>
  )

  const [consultsRes, prescsRes, resaRes, covRes, apptRes] = await Promise.allSettled([
    supabase.from('consultations')
      .select('id, status, created_at, consultation_date, professionals(profiles(first_name, last_name)), establishments(name)')
      .eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('prescriptions')
      .select('id, status, created_at, item_count, professionals(profiles(first_name, last_name))')
      .eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('pharmacy_reservations')
      .select('id, status, pickup_code, created_at, collected_at, pharmacies(name)')
      .eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('coverage_requests')
      .select('id, status, request_type, created_at, approved_at, coverage_orgs(name)')
      .eq('patient_id', patient.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('appointments')
      .select('id, status, scheduled_at, reason, professionals(profiles(first_name, last_name))')
      .eq('patient_id', patient.id).order('scheduled_at', { ascending: false }).limit(30),
  ])

  const events: TimelineEvent[] = []

  // Consultations
  if (consultsRes.status === 'fulfilled' && consultsRes.value.data) {
    for (const c of consultsRes.value.data as unknown as { id: string; status: string; created_at: string; consultation_date: string | null; professionals: { profiles: { first_name: string | null; last_name: string | null } | null } | null; establishments: { name: string } | null }[]) {
      const pro = c.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null
      const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
      const estName = (c.establishments as unknown as { name: string } | null)?.name
      events.push({
        id: `c-${c.id}`, date: c.consultation_date ?? c.created_at, type: 'consultation',
        title: 'Consultation',
        subtitle: [proName, estName].filter(Boolean).join(' · '),
        badge: STATUS_LABELS_CONSULT[c.status] ?? c.status,
        badgeClass: STATUS_CLASSES[c.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
      })
    }
  }

  // Ordonnances
  if (prescsRes.status === 'fulfilled' && prescsRes.value.data) {
    for (const p of prescsRes.value.data as unknown as { id: string; status: string; created_at: string; item_count: number | null; professionals: { profiles: { first_name: string | null; last_name: string | null } | null } | null }[]) {
      const pro = p.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null
      const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
      const refNum = `ORD-${p.id.slice(-6).toUpperCase()}`
      const itemStr = p.item_count != null ? `${p.item_count} médicament${p.item_count > 1 ? 's' : ''}` : null
      events.push({
        id: `p-${p.id}`, date: p.created_at, type: 'ordonnance',
        title: 'Ordonnance',
        subtitle: [refNum, itemStr, proName].filter(Boolean).join(' · '),
        badge: null, badgeClass: '',
      })
    }
  }

  // Réservations + retraits
  if (resaRes.status === 'fulfilled' && resaRes.value.data) {
    for (const r of resaRes.value.data as unknown as { id: string; status: string; pickup_code: string | null; created_at: string; collected_at: string | null; pharmacies: { name: string } | null }[]) {
      const pharmName = (r.pharmacies as unknown as { name: string } | null)?.name
      const refCode = r.pickup_code ? `MED-${r.pickup_code}` : null

      events.push({
        id: `r-${r.id}`, date: r.created_at, type: 'reservation',
        title: 'Réservation pharmacie',
        subtitle: [pharmName, refCode].filter(Boolean).join(' · '),
        badge: STATUS_LABELS_RES[r.status] ?? r.status,
        badgeClass: STATUS_CLASSES[r.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
      })

      if (r.status === 'collected' && r.collected_at) {
        events.push({
          id: `ret-${r.id}`, date: r.collected_at, type: 'retrait',
          title: 'Retrait', subtitle: pharmName ?? null,
          badge: 'Terminé', badgeClass: STATUS_CLASSES['completed'],
        })
      }
    }
  }

  // Prises en charge
  if (covRes.status === 'fulfilled' && covRes.value.data) {
    for (const c of covRes.value.data as unknown as { id: string; status: string; request_type: string | null; created_at: string; approved_at: string | null; coverage_orgs: { name: string } | null }[]) {
      const orgName = (c.coverage_orgs as unknown as { name: string } | null)?.name
      events.push({
        id: `cov-${c.id}`, date: c.created_at, type: 'couverture',
        title: 'Prise en charge',
        subtitle: orgName ?? null,
        badge: STATUS_LABELS_COV[c.status] ?? c.status,
        badgeClass: STATUS_CLASSES[c.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
      })
    }
  }

  // Rendez-vous
  if (apptRes.status === 'fulfilled' && apptRes.value.data) {
    for (const a of apptRes.value.data as unknown as { id: string; status: string; scheduled_at: string; reason: string | null; professionals: { profiles: { first_name: string | null; last_name: string | null } | null } | null }[]) {
      const pro = a.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null
      const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
      events.push({
        id: `appt-${a.id}`, date: a.scheduled_at, type: 'rendez-vous',
        title: 'Rendez-vous',
        subtitle: [proName, a.reason].filter(Boolean).join(' · '),
        badge: a.status === 'completed' ? 'Passé' : a.status === 'scheduled' ? 'Confirmé' : a.status === 'cancelled' ? 'Annulé' : null,
        badgeClass: STATUS_CLASSES[a.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
      })
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Grouper par date
  const groups = new Map<string, TimelineEvent[]>()
  for (const ev of events) {
    const dayKey = new Date(ev.date).toISOString().split('T')[0]
    if (!groups.has(dayKey)) groups.set(dayKey, [])
    groups.get(dayKey)!.push(ev)
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-1">
      <p className="text-xs text-[var(--sw-ink-2)] mb-4">{events.length} événement{events.length > 1 ? 's' : ''} au total</p>

      {events.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun événement enregistré dans votre dossier.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--sw-line)]" />

          <div className="space-y-0">
            {Array.from(groups.entries()).map(([day, dayEvents]) => (
              <div key={day}>
                {/* Date en séparateur */}
                <div className="relative flex items-center gap-3 mb-3 mt-5 first:mt-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--sw-surface)] border border-[var(--sw-line)] flex items-center justify-center z-10 shrink-0" />
                  <span className="text-xs font-semibold text-[var(--sw-ink-2)]">
                    {fmtDate(day)}
                  </span>
                </div>

                {/* Événements de ce jour */}
                <div className="pl-12 space-y-2">
                  {dayEvents.map(ev => {
                    const cfg = TYPE_CONFIG[ev.type]
                    const Icon = cfg.icon
                    return (
                      <div key={ev.id} className="sw-card p-3.5 flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-[var(--sw-ink)]">{ev.title}</p>
                            {ev.badge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ev.badgeClass}`}>
                                {ev.badge}
                              </span>
                            )}
                          </div>
                          {ev.subtitle && (
                            <p className="text-xs text-[var(--sw-ink-2)]">{ev.subtitle}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
