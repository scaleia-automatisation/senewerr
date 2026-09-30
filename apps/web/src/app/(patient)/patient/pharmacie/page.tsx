import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search, ArrowRight, Package, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Espace pharmacie' }

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'À vérifier', awaiting_coverage: 'En attente couverture',
  awaiting_payment: 'En attente paiement', funded: 'Financée', to_prepare: 'À préparer',
  preparing: 'En préparation', ready: 'Prête', collected: 'Retirée',
  refused: 'Refusée', cancelled: 'Annulée', expired: 'Expirée',
}
const STATUS_CLASSES: Record<string, string> = {
  new: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  awaiting_coverage: 'bg-blue-50 text-blue-600',
  awaiting_payment: 'bg-orange-50 text-orange-600',
  funded: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  to_prepare: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  preparing: 'bg-blue-50 text-blue-600',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  expired: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Reservation = {
  id: string; status: string; created_at: string; pickup_code: string | null; has_coverage: boolean; expires_at: string | null
  pharmacies: { name: string } | null
  pharmacy_reservation_items: { medication_name: string; pharmacy_products: { dosage: string | null } | null }[]
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
}

export default async function PatientPharmaciePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const reservations: Reservation[] = []
  if (patient) {
    const { data } = await supabase
      .from('pharmacy_reservations')
      .select('id, status, created_at, pickup_code, has_coverage, expires_at, pharmacies(name), pharmacy_reservation_items(medication_name, pharmacy_products(dosage))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) reservations.push(...(data as unknown as Reservation[]))
  }

  const active = reservations.filter(r => !['collected', 'refused', 'cancelled', 'expired'].includes(r.status))
  const done = reservations.filter(r => ['collected', 'refused', 'cancelled', 'expired'].includes(r.status))

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Pharmacie</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{active.length} réservation{active.length > 1 ? 's' : ''} active{active.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/patient/pharmacie/recherche" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 shrink-0">
          <Search className="w-4 h-4" /> Chercher
        </Link>
      </div>

      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">En cours ({active.length})</h2>
          {active.map(r => {
            const pharmName = (r.pharmacies as unknown as { name: string } | null)?.name
            const item = r.pharmacy_reservation_items?.[0]; const medName = item ? { name: item.medication_name, dosage: item.pharmacy_products?.dosage ?? null } : null
            const refCode = r.pickup_code ? `MED-${r.pickup_code}` : null
            const isExpiringSoon = r.expires_at && (new Date(r.expires_at).getTime() - Date.now()) < 24 * 3600 * 1000 * 2
            return (
              <Link key={r.id} href={`/patient/pharmacie/reservations/${r.id}`}
                className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-[var(--sw-primary)]" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.status === 'ready' && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--sw-success-bg)] text-[var(--sw-success)]">🔔 Prête</span>}
                  </div>
                  {medName?.name && <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{medName.name}{medName.dosage ? ` ${medName.dosage}` : ''}</p>}
                  {pharmName && <p className="text-xs text-[var(--sw-ink-2)]">{pharmName}</p>}
                  <div className="flex items-center gap-3 text-xs text-[var(--sw-ink-3)]">
                    <span>{fmtDate(r.created_at)}</span>
                    {refCode && <span className="font-mono">{refCode}</span>}
                    {isExpiringSoon && r.expires_at && (
                      <span className="text-[var(--sw-warning)] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Expire bientôt
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-1" />
              </Link>
            )
          })}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--sw-ink-2)]">Historique ({done.length})</h2>
          {done.slice(0, 5).map(r => {
            const pharmName = (r.pharmacies as unknown as { name: string } | null)?.name
            const _item2 = r.pharmacy_reservation_items?.[0]; const medName = _item2 ? { name: _item2.medication_name, dosage: _item2.pharmacy_products?.dosage ?? null } : null
            return (
              <Link key={r.id} href={`/patient/pharmacie/reservations/${r.id}`}
                className="sw-card p-3 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors opacity-75">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                <div className="flex-1 min-w-0">
                  {medName?.name && <p className="text-xs font-medium text-[var(--sw-ink)] truncate">{medName.name}</p>}
                  {pharmName && <p className="text-xs text-[var(--sw-ink-3)]">{pharmName}</p>}
                </div>
                <span className="text-xs text-[var(--sw-ink-3)]">{fmtDate(r.created_at)}</span>
              </Link>
            )
          })}
        </section>
      )}

      {reservations.length === 0 && (
        <div className="sw-card p-10 text-center">
          <Package className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto mb-4" />
          <p className="text-sm font-medium text-[var(--sw-ink)]">Aucune réservation</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1 mb-4">Recherchez un médicament et réservez-le en pharmacie.</p>
          <Link href="/patient/pharmacie/recherche" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium">
            <Search className="w-4 h-4" /> Chercher un médicament
          </Link>
        </div>
      )}
    </div>
  )
}
