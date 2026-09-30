import Link from 'next/link'
import { ShoppingBag, MapPin, Clock, CheckCircle, Key } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCFA, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes réservations' }

type ReservationStatus =
  | 'new' | 'verifying' | 'awaiting_coverage' | 'awaiting_payment'
  | 'funded' | 'to_prepare' | 'preparing' | 'ready'
  | 'collected' | 'refused' | 'cancelled' | 'expired'

const STATUS_LABELS: Record<ReservationStatus, string> = {
  new: 'Nouvelle',
  verifying: 'En vérification',
  awaiting_coverage: 'Attente couverture',
  awaiting_payment: 'Attente paiement',
  funded: 'Financée',
  to_prepare: 'À préparer',
  preparing: 'En préparation',
  ready: 'Prête à récupérer',
  collected: 'Récupérée',
  refused: 'Refusée',
  cancelled: 'Annulée',
  expired: 'Expirée',
}

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  new: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  awaiting_coverage: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  awaiting_payment: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  funded: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  to_prepare: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  preparing: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  ready: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
  expired: 'bg-red-50 text-[var(--sw-danger)]',
}

const ACTIVE_STATUSES: ReservationStatus[] = [
  'new', 'verifying', 'awaiting_coverage', 'awaiting_payment', 'funded', 'to_prepare', 'preparing', 'ready',
]
const DONE_STATUSES: ReservationStatus[] = ['collected', 'refused', 'cancelled', 'expired']

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface Reservation {
  id: string
  status: ReservationStatus
  pickup_code: string | null
  expiry_at: string | null
  total_amount_fcfa: number | null
  patient_share_fcfa: number | null
  has_paid: boolean
  created_at: string
  pharmacies: {
    name: string
    address_commune: string | null
    address_region: string | null
  } | null
  prescriptions: {
    prescription_items: { id: string }[]
  } | null
}

export default async function ReservationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patientData } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user!.id)
    .single()
  const patient = patientData as unknown as { id: string } | null

  let active: Reservation[] = []
  let done: Reservation[] = []

  if (patient) {
    const { data } = await supabase
      .from('pharmacy_reservations')
      .select(`
        id,
        status,
        pickup_code,
        expiry_at,
        total_amount_fcfa,
        patient_share_fcfa,
        has_paid,
        created_at,
        pharmacies(name, address_commune, address_region),
        prescriptions(prescription_items(id))
      `)
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })

    if (data) {
      const typed = data as unknown as Reservation[]
      active = typed.filter(r => ACTIVE_STATUSES.includes(r.status as ReservationStatus))
      done = typed.filter(r => DONE_STATUSES.includes(r.status as ReservationStatus))
    }
  }

  function ReservationCard({ res }: { res: Reservation }) {
    const isReady = res.status === 'ready'
    const itemCount = res.prescriptions?.prescription_items?.length ?? 0

    return (
      <Link href={`/patient/pharmacie/reservations/${res.id}`} className={cn('sw-card p-4 space-y-3 block hover:opacity-90 transition-opacity', isReady && 'border-[var(--sw-success)]')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className={cn('w-4 h-4 flex-shrink-0', isReady ? 'text-[var(--sw-success)]' : 'text-[var(--sw-primary)]')} />
            <span className="text-sm font-semibold text-[var(--sw-ink)]">
              {res.pharmacies?.name ?? 'Pharmacie'}
            </span>
          </div>
          <StatusBadge status={res.status} />
        </div>

        {res.pharmacies?.address_commune && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-3)]">
            <MapPin className="w-3 h-3" />
            {res.pharmacies.address_commune}
            {res.pharmacies.address_region && `, ${res.pharmacies.address_region}`}
          </div>
        )}

        {/* Code de retrait si prête */}
        {isReady && res.pickup_code && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sw-success-bg)]">
            <Key className="w-4 h-4 text-[var(--sw-success)] flex-shrink-0" />
            <div>
              <p className="text-xs text-[var(--sw-success)] font-medium">Code de retrait</p>
              <p className="text-lg font-bold text-[var(--sw-success)] tracking-widest">{res.pickup_code}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[var(--sw-ink-2)]">
          {itemCount > 0 && (
            <span>{itemCount} article{itemCount > 1 ? 's' : ''}</span>
          )}
          {res.total_amount_fcfa != null && (
            <span className="font-medium text-[var(--sw-ink)]">{formatCFA(res.total_amount_fcfa)}</span>
          )}
        </div>

        {res.patient_share_fcfa != null && res.patient_share_fcfa !== res.total_amount_fcfa && (
          <p className="text-xs text-[var(--sw-ink-3)]">
            Votre part : <span className="font-medium text-[var(--sw-ink)]">{formatCFA(res.patient_share_fcfa)}</span>
          </p>
        )}

        {res.expiry_at && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-3)]">
            <Clock className="w-3 h-3" />
            Expire le {formatDateTime(res.expiry_at)}
          </div>
        )}
      </Link>
    )
  }

  const hasAny = active.length > 0 || done.length > 0

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes réservations</h1>

      {!hasAny ? (
        <div className="sw-card p-10 flex flex-col items-center gap-4 text-center">
          <ShoppingBag className="w-12 h-12 text-[var(--sw-ink-3)]" />
          <div>
            <p className="text-sm font-medium text-[var(--sw-ink)]">Aucune réservation en cours</p>
            <p className="text-xs text-[var(--sw-ink-2)] mt-1">
              Réservez vos médicaments depuis une ordonnance ou la liste des produits
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/patient/ordonnances"
              className="text-sm text-[var(--sw-primary)] font-medium hover:underline"
            >
              Mes ordonnances
            </Link>
            <span className="text-[var(--sw-ink-3)]">·</span>
            <Link
              href="/patient/medicaments"
              className="text-sm text-[var(--sw-primary)] font-medium hover:underline"
            >
              Catalogue
            </Link>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                En cours ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map(res => <ReservationCard key={res.id} res={res} />)}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Historique ({done.length})
              </h2>
              <div className="space-y-3">
                {done.map(res => <ReservationCard key={res.id} res={res} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
