import { Suspense } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { formatCFA } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Confirmation de paiement — Séné Wérr' }

const METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  stripe: 'Carte bancaire',
  cash: 'Espèces',
  bank_transfer: 'Virement bancaire',
}

interface Props {
  searchParams: Promise<{
    ref?: string
    status?: string
  }>
}

export default async function PaymentConfirmationPage({ searchParams }: Props) {
  const { ref, status } = await searchParams

  const supabase = await createClient()

  let payment: Record<string, unknown> | null = null

  if (ref) {
    const { data } = await supabase
      .from('payments')
      .select('*, reservation:pharmacy_reservations(pickup_code, pharmacy_id)')
      .eq('reference', ref)
      .single()
    payment = data as unknown as Record<string, unknown>
  }

  const resolvedStatus = payment?.status ?? status ?? 'pending'
  const isSuccess = resolvedStatus === 'completed'
  const isFailed = resolvedStatus === 'failed' || resolvedStatus === 'cancelled'
  const isPending = !isSuccess && !isFailed

  const pickupCode = (payment?.reservation as { pickup_code?: string })?.pickup_code

  return (
    <div className="min-h-screen bg-[var(--sw-surface-2)] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-5">
        {/* Icône statut */}
        <div className="sw-card p-6 text-center space-y-4">
          <div className="flex justify-center">
            {isSuccess ? (
              <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
              </div>
            ) : isFailed ? (
              <div className="w-16 h-16 rounded-full bg-[var(--sw-danger-bg)] flex items-center justify-center">
                <XCircle className="w-8 h-8 text-[var(--sw-danger)]" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--sw-warning-bg)] flex items-center justify-center">
                <Clock className="w-8 h-8 text-[var(--sw-warning)]" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-xl font-bold text-[var(--sw-ink)]">
              {isSuccess ? 'Paiement confirmé !' : isFailed ? 'Paiement échoué' : 'Paiement en cours…'}
            </h1>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1">
              {isSuccess
                ? 'Votre paiement a été traité avec succès.'
                : isFailed
                ? 'Le paiement n\'a pas pu être traité.'
                : 'Votre paiement est en cours de traitement.'}
            </p>
          </div>
        </div>

        {/* Détails */}
        {payment && (
          <div className="sw-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Détails du paiement</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--sw-ink-2)]">Référence</span>
                <span className="font-mono text-xs text-[var(--sw-ink)]">{payment.reference as string}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--sw-ink-2)]">Montant</span>
                <span className="font-semibold text-[var(--sw-ink)]">{formatCFA(payment.amount_fcfa as number)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--sw-ink-2)]">Méthode</span>
                <span className="text-[var(--sw-ink)]">
                  {METHOD_LABELS[payment.method as string] ?? payment.method as string}
                </span>
              </div>
              {(payment.description as string | null) && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--sw-ink-2)]">Objet</span>
                  <span className="text-[var(--sw-ink)] text-right max-w-[55%]">{String(payment.description)}</span>
                </div>
              )}
              {(payment.completed_at as string | null) && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--sw-ink-2)]">Date</span>
                  <span className="text-[var(--sw-ink)]">
                    {new Date(payment.completed_at as string).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Code de retrait si réservation */}
        {isSuccess && pickupCode && (
          <div className="sw-card p-5 text-center space-y-2">
            <p className="text-xs text-[var(--sw-ink-2)]">Code de retrait pharmacie</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em] text-[var(--sw-primary)]">{pickupCode}</p>
            <p className="text-xs text-[var(--sw-ink-3)]">Présentez ce code à la pharmacie</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {isSuccess ? (
            <>
              {payment?.reservation_id && (
                <Link href={`/reservations/${payment.reservation_id}/confirmation?payment=success`}>
                  <Button className="w-full" size="lg">
                    Voir ma réservation
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              <Link href="/tableau-de-bord">
                <Button variant="outline" className="w-full" size="lg">
                  Retour à l'accueil
                </Button>
              </Link>
            </>
          ) : isFailed ? (
            <>
              <Link href={payment?.reservation_id ? `/reservations/${payment.reservation_id}/payer` : '/reservations'}>
                <Button className="w-full" size="lg">
                  Réessayer le paiement
                </Button>
              </Link>
              <Link href="/reservations">
                <Button variant="ghost" className="w-full" size="lg">
                  <ArrowLeft className="w-4 h-4" />
                  Mes réservations
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/reservations">
              <Button className="w-full" size="lg">
                Voir mes réservations
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
