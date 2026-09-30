import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, CreditCard, Shield, FileText, User, Bell } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dossiers bloqués — Admin' }

// Spec 21.5 — liste des dossiers nécessitant une intervention admin
type BlockedItem = {
  id: string; type: string; title: string; detail: string; href: string
  since: string; severity: 'high' | 'medium' | 'low'
}

type ResaRaw = {
  id: string; status: string; created_at: string; pickup_code: string | null
  patients: { profiles: { full_name: string | null } | null } | null
  pharmacy_reservation_items: { medication_name: string }[]
}
type PaymentRaw = {
  id: string; status: string; created_at: string; reference_code: string | null; amount_fcfa: number
  patients: { profiles: { full_name: string | null } | null } | null
}
type CoverageRaw = {
  id: string; status: string; created_at: string
  patients: { profiles: { full_name: string | null } | null } | null
}
type PrescriptionRaw = {
  id: string; status: string; created_at: string
  patients: { profiles: { full_name: string | null } | null } | null
}

function ageHours(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 3600)
}
function fmtAge(dateStr: string): string {
  const h = ageHours(dateStr)
  if (h < 24) return `${Math.round(h)} h`
  return `${Math.floor(h / 24)} j`
}

export default async function AdminDossiersBloques({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  // Spec 21.5 — fetch par catégorie en parallèle
  const [resasRes, paymentsRes, coverageRes, prescsRes] = await Promise.allSettled([
    // Réservations bloquées (verifying, pending_coverage, pending_payment depuis > 12h)
    supabase.from('pharmacy_reservations')
      .select('id, status, created_at, pickup_code, patients(profiles(full_name)), pharmacy_reservation_items(medication_name)')
      .in('status', ['verifying', 'awaiting_coverage', 'awaiting_payment'])
      .order('created_at', { ascending: true })
      .limit(50),

    // Paiements non confirmés
    supabase.from('payments')
      .select('id, status, created_at, reference_code, amount_fcfa, patients(profiles(full_name))')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(50),

    // Prises en charge en attente trop longtemps
    supabase.from('coverage_requests')
      .select('id, status, created_at, patients(profiles(full_name))')
      .in('status', ['pending', 'reviewing', 'info_required'])
      .order('created_at', { ascending: true })
      .limit(50),

    // Ordonnances signalées
    supabase.from('prescriptions')
      .select('id, status, created_at, patients(profiles(full_name))')
      .eq('status', 'flagged')
      .order('created_at', { ascending: true })
      .limit(20),
  ])

  const resas = resasRes.status === 'fulfilled' ? (resasRes.value.data ?? []) as unknown as ResaRaw[] : []
  const payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.data ?? []) as unknown as PaymentRaw[] : []
  const coverages = coverageRes.status === 'fulfilled' ? (coverageRes.value.data ?? []) as unknown as CoverageRaw[] : []
  const prescriptions = prescsRes.status === 'fulfilled' ? (prescsRes.value.data ?? []) as unknown as PrescriptionRaw[] : []

  function patName(r: { patients: { profiles: { full_name: string | null } | null } | null }): string {
    return (r.patients as unknown as { profiles: { full_name: string | null } | null } | null)?.profiles?.full_name ?? 'Patient'
  }

  const items: BlockedItem[] = [
    // Spec 21.5 — Réservations bloquées
    ...resas
      .filter(r => ageHours(r.created_at) > 12)
      .map(r => ({
        id: r.id,
        type: 'reservation',
        title: `Réservation bloquée — ${patName(r)}`,
        detail: `Statut : ${r.status} · depuis ${fmtAge(r.created_at)}`,
        href: `/admin/reservations/${r.id}`,
        since: r.created_at,
        severity: ageHours(r.created_at) > 48 ? 'high' as const : 'medium' as const,
      })),

    // Spec 21.5 — Paiements non confirmés
    ...payments
      .filter(p => ageHours(p.created_at) > 6)
      .map(p => ({
        id: p.id,
        type: 'paiement',
        title: `Paiement non confirmé — ${patName(p)}`,
        detail: `Ref : ${p.reference_code ?? '—'} · ${new Intl.NumberFormat('fr-SN').format(p.amount_fcfa)} F CFA · ${fmtAge(p.created_at)}`,
        href: `/admin/paiements/${p.id}`,
        since: p.created_at,
        severity: p.status === 'failed' ? 'high' as const : 'medium' as const,
      })),

    // Spec 21.5 — Prises en charge en attente depuis trop longtemps
    ...coverages
      .filter(c => ageHours(c.created_at) > 48)
      .map(c => ({
        id: c.id,
        type: 'couverture',
        title: `Prise en charge en attente — ${patName(c)}`,
        detail: `Statut : ${c.status} · depuis ${fmtAge(c.created_at)}`,
        href: `/admin/prises-en-charge/${c.id}`,
        since: c.created_at,
        severity: ageHours(c.created_at) > 72 ? 'high' as const : 'medium' as const,
      })),

    // Spec 21.5 — Ordonnances signalées
    ...prescriptions.map(p => ({
      id: p.id,
      type: 'ordonnance',
      title: `Ordonnance signalée — ${patName(p)}`,
      detail: `Signalée · depuis ${fmtAge(p.created_at)}`,
      href: `/admin/ordonnances/${p.id}`,
      since: p.created_at,
      severity: 'high' as const,
    })),
  ]
    .filter(i => !filterType || i.type === filterType)
    .sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 }
      return sev[a.severity] - sev[b.severity] || new Date(a.since).getTime() - new Date(b.since).getTime()
    })

  const TYPE_ICON: Record<string, React.ReactNode> = {
    reservation: <AlertTriangle className="w-4 h-4 text-[var(--sw-warning)]" />,
    paiement: <CreditCard className="w-4 h-4 text-[var(--sw-danger)]" />,
    couverture: <Shield className="w-4 h-4 text-[var(--sw-primary)]" />,
    ordonnance: <FileText className="w-4 h-4 text-[var(--sw-danger)]" />,
    compte: <User className="w-4 h-4 text-[var(--sw-ink-3)]" />,
    notification: <Bell className="w-4 h-4 text-[var(--sw-ink-3)]" />,
  }
  const SEV_CLASSES: Record<string, string> = {
    high: 'bg-red-50 border-l-4 border-l-[var(--sw-danger)]',
    medium: 'bg-[var(--sw-warning-bg)] border-l-4 border-l-[var(--sw-warning)]',
    low: '',
  }

  const TABS = [
    { key: '', label: `Tous (${items.length})` },
    { key: 'reservation', label: 'Réservations' },
    { key: 'paiement', label: 'Paiements' },
    { key: 'couverture', label: 'Couverture' },
    { key: 'ordonnance', label: 'Ordonnances' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Dossiers bloqués</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 21.5 — dossiers nécessitant une intervention admin</p>
      </div>

      {/* Note spec 21.5 — l'admin ne modifie pas les décisions médicales ou de couverture */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--sw-surface-2)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-ink-3)]">
          Spec 21.5 : l'admin peut consulter et déclencher les actions autorisées. Il ne peut pas modifier une décision médicale ou une décision de couverture.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?type=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterType ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-[var(--sw-success)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--sw-ink)]">Aucun dossier bloqué</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">Tous les dossiers sont dans les délais.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <Link key={`${item.type}-${item.id}`} href={item.href}
              className={`sw-card block px-4 py-3.5 hover:opacity-90 transition-opacity ${SEV_CLASSES[item.severity]}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
                  {TYPE_ICON[item.type] ?? <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{item.title}</p>
                  <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">{item.detail}</p>
                </div>
                {item.severity === 'high' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-[var(--sw-danger)] shrink-0">Urgent</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
