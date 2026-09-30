import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClipboardList, FileText, Shield, Package, ArrowRight } from 'lucide-react'
import { AccountStatusBanner } from '@/components/ui/account-status-banner'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tableau de bord — Pharmacie Séné Wérr' }

const STATUS_LABELS: Record<string, string> = {
  new: 'À vérifier', verifying: 'En vérification', to_prepare: 'À préparer',
  preparing: 'En préparation', ready: 'Prête', collected: 'Collectée',
  refused: 'Refusée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  new: 'bg-[var(--sw-info-bg,#eff6ff)] text-blue-600',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  to_prepare: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  preparing: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
}

type Res = {
  id: string; pickup_code: string | null; status: string
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  pharmacy_reservation_items: Array<{ id: string }>
}

export default async function PharmacieAccueilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmacyData } = await supabase.from('pharmacies').select('id, name, status, refusal_reason').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmacyData as unknown as { id: string; name: string; status: string; refusal_reason?: string | null } | null
  if (!pharmacy) redirect('/connexion')

  const [
    { count: newCount },
    { count: verifyingCount },
    { count: toPrepareCount },
    { count: preparingCount },
    { data: lastResData },
  ] = await Promise.all([
    supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacy.id).eq('status', 'new'),
    supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacy.id).eq('status', 'verifying'),
    supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacy.id).eq('status', 'to_prepare'),
    supabase.from('pharmacy_reservations').select('*', { count: 'exact', head: true }).eq('pharmacy_id', pharmacy.id).eq('status', 'preparing'),
    supabase.from('pharmacy_reservations').select('id, pickup_code, status, patients(profiles(first_name, last_name)), pharmacy_reservation_items(id)').eq('pharmacy_id', pharmacy.id).in('status', ['new', 'verifying', 'to_prepare', 'preparing', 'ready']).order('created_at', { ascending: false }).limit(5),
  ])

  const lastRes = (lastResData ?? []) as unknown as Res[]

  const kpis = [
    { label: 'Réservations à vérifier',     value: newCount ?? 0,       icon: ClipboardList, href: '/pharmacie/reservations', color: 'text-blue-600',                     bg: 'bg-blue-50' },
    { label: 'Ordonnances à contrôler',      value: verifyingCount ?? 0, icon: FileText,      href: '/pharmacie/ordonnances',  color: 'text-[var(--sw-warning)]',          bg: 'bg-[var(--sw-warning-bg)]' },
    { label: 'Prises en charge en attente',  value: toPrepareCount ?? 0, icon: Shield,        href: '/pharmacie/prises-en-charge', color: 'text-purple-600',               bg: 'bg-purple-50' },
    { label: 'Commandes à préparer',         value: preparingCount ?? 0, icon: Package,       href: '/pharmacie/reservations', color: 'text-[var(--sw-primary)]',          bg: 'bg-[var(--sw-primary-subtle)]' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {pharmacy.status !== 'verifie' && (
        <AccountStatusBanner status={pharmacy.status as 'pending'} motif={pharmacy.refusal_reason} />
      )}

      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">{pharmacy.name}</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Tableau de bord — À traiter</p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, href, color, bg }) => (
          <Link key={label} href={href} className="sw-card p-4 hover:border-[var(--sw-primary)] transition-colors">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-[var(--sw-ink-2)] mt-1 leading-tight">{label}</p>
          </Link>
        ))}
      </div>

      {/* Dernières réservations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Dernières réservations</h2>
          <Link href="/pharmacie/reservations" className="flex items-center gap-1 text-xs text-[var(--sw-primary)] font-medium">
            Tout voir <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {lastRes.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune réservation en cours.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lastRes.map(r => {
              const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
              const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
              const itemCount = (r.pharmacy_reservation_items as unknown as Array<{ id: string }>).length
              return (
                <Link key={r.id} href={`/pharmacie/reservations/${r.id}`} className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[var(--sw-primary)] text-sm">
                        {r.pickup_code ? `MED-${r.pickup_code}` : r.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
                      {patName} · {itemCount} médicament{itemCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
