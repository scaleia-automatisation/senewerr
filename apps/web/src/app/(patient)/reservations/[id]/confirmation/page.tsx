import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, Clock, MapPin, QrCode, ArrowLeft, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { formatCFA, reservationExpiresAt } from '@/lib/utils'
import type { Metadata } from 'next'
import { CopyCodeButton } from '@/components/reservation/copy-code-button'

export const metadata: Metadata = { title: 'Réservation confirmée — Séné Wérr' }

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ payment?: string }>
}

export default async function ReservationConfirmationPage({ params, searchParams }: Props) {
  const { id } = await params
  const { payment } = await searchParams
  const supabase = await createClient()

  const { data: reservationData, error } = await supabase
    .from('reservations_pharmacie')
    .select(`
      *,
      pharmacy:pharmacies (
        name,
        address_commune,
        address_details,
        phone
      ),
      items:pharmacy_reservation_items (
        medication_name,
        quantity,
        unit_price_fcfa,
        total_price_fcfa
      )
    `)
    .eq('id', id)
    .single()

  if (error || !reservationData) notFound()
  const reservation = reservationData as unknown as Record<string, unknown>

  const isNewPayment = payment === 'success'
  const pickupCode = reservation.pickup_code as string
  const expiryAt = new Date(reservation.expiry_at as string)
  const formattedExpiry = expiryAt.toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const pharmacy = reservation.pharmacy as {
    name: string; address_commune: string; address_details: string; phone: string
  }
  const items = reservation.items as Array<{
    medication_name: string; quantity: number; unit_price_fcfa: number; total_price_fcfa: number
  }>

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] pb-10">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        {/* Header */}
        <Link href="/reservations" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
          <ArrowLeft className="w-4 h-4" />
          Mes réservations
        </Link>

        {/* Succès */}
        <div className="sw-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">
              {isNewPayment ? 'Paiement et réservation confirmés !' : 'Réservation confirmée !'}
            </h1>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">
              Vos médicaments sont réservés à la pharmacie
            </p>
          </div>
        </div>

        {/* Code de retrait */}
        <div className="sw-card p-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-[var(--sw-ink-2)] text-sm">
            <QrCode className="w-4 h-4" />
            <span>Votre code de retrait</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-mono font-bold tracking-[0.3em] text-[var(--sw-primary)]">
              {pickupCode}
            </span>
            <Suspense fallback={null}>
              <CopyCodeButton code={pickupCode} />
            </Suspense>
          </div>
          <p className="text-xs text-[var(--sw-ink-3)]">
            Présentez ce code à la pharmacie pour retirer vos médicaments
          </p>
        </div>

        {/* Expiration */}
        <div className="sw-card p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-[var(--sw-warning)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--sw-ink)]">
              {reservation.has_paid ? 'Valable 72h après paiement' : 'Valable 3h (sans paiement)'}
            </p>
            <p className="text-xs text-[var(--sw-ink-2)]">Expire le {formattedExpiry}</p>
            {!reservation.has_paid && (
              <Link href={`/reservations/${id}/payer`} className="mt-2 inline-block">
                <Button size="sm" variant="outline">Payer maintenant → +72h</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Pharmacie */}
        <div className="sw-card p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[var(--sw-primary)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--sw-ink)]">{pharmacy.name}</p>
            <p className="text-xs text-[var(--sw-ink-2)]">{pharmacy.address_commune}</p>
            {pharmacy.address_details && (
              <p className="text-xs text-[var(--sw-ink-3)]">{pharmacy.address_details}</p>
            )}
            {pharmacy.phone && (
              <a href={`tel:${pharmacy.phone}`} className="text-xs text-[var(--sw-primary)] hover:underline mt-1 block">
                {pharmacy.phone}
              </a>
            )}
          </div>
        </div>

        {/* Récapitulatif articles */}
        <div className="sw-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Articles réservés</h2>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-[var(--sw-ink)]">{item.medication_name} × {item.quantity}</span>
                {item.total_price_fcfa > 0 && (
                  <span className="text-[var(--sw-ink-2)]">{formatCFA(item.total_price_fcfa)}</span>
                )}
              </div>
            ))}
          </div>
          {(reservation.total_amount_fcfa as number) > 0 && (
            <div className="border-t border-[var(--sw-line)] pt-3 space-y-1">
              {(reservation.coverage_share_fcfa as number) > 0 && (
                <div className="flex justify-between text-sm text-[var(--sw-ink-2)]">
                  <span>Prise en charge</span>
                  <span className="text-[var(--sw-success)]">− {formatCFA(reservation.coverage_share_fcfa as number)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-[var(--sw-ink)]">
                <span>{reservation.has_paid ? 'Payé' : 'À payer à la pharmacie'}</span>
                <span>{formatCFA((reservation.patient_share_fcfa as number) ?? (reservation.total_amount_fcfa as number))}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link href="/tableau-de-bord">
            <Button className="w-full" size="lg">
              Retour à l'accueil
            </Button>
          </Link>
          <Link href="/reservations">
            <Button variant="outline" className="w-full" size="lg">
              Voir mes réservations
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
