'use client'
import { CheckCircle2, XCircle, Clock, Download, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCFA } from '@/lib/utils'

export type PaymentConfirmationStatus = 'success' | 'failed' | 'pending'

export interface PaymentConfirmationData {
  status: PaymentConfirmationStatus
  reference: string
  amountFcfa: number
  method: string
  description: string
  completedAt?: Date
  reservationId?: string
  pickupCode?: string
  invoiceUrl?: string
  nextUrl?: string
  nextLabel?: string
}

interface Props {
  open: boolean
  onClose: () => void
  data: PaymentConfirmationData
}

const METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  stripe: 'Carte bancaire',
  cash: 'Espèces',
  bank_transfer: 'Virement bancaire',
}

export function PaymentConfirmationModal({ open, onClose, data }: Props) {
  const isSuccess = data.status === 'success'
  const isFailed = data.status === 'failed'
  const isPending = data.status === 'pending'

  const icon = isSuccess ? (
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
  )

  const title = isSuccess ? 'Paiement confirmé !' : isFailed ? 'Paiement échoué' : 'Paiement en cours…'
  const subtitle = isSuccess
    ? 'Votre paiement a été traité avec succès.'
    : isFailed
    ? "Le paiement n'a pas pu être traité. Veuillez réessayer."
    : 'Votre paiement est en cours de traitement.'

  return (
    <Dialog open={open} onClose={onClose} closeOnBackdrop={false} className="max-w-sm">
      <DialogBody className="text-center space-y-5">
        <div className="flex justify-center">{icon}</div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--sw-ink)]">{title}</h2>
          <p className="text-sm text-[var(--sw-ink-2)]">{subtitle}</p>
        </div>

        {/* Détails du paiement */}
        <div className="bg-[var(--sw-surface-2)] rounded-xl p-4 space-y-3 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--sw-ink-2)]">Référence</span>
            <span className="font-mono text-xs text-[var(--sw-ink)]">{data.reference}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--sw-ink-2)]">Montant</span>
            <span className="font-semibold text-[var(--sw-ink)]">{formatCFA(data.amountFcfa)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--sw-ink-2)]">Méthode</span>
            <span className="text-[var(--sw-ink)]">{METHOD_LABELS[data.method] ?? data.method}</span>
          </div>
          {data.description && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--sw-ink-2)]">Objet</span>
              <span className="text-[var(--sw-ink)] text-right max-w-[60%]">{data.description}</span>
            </div>
          )}
          {data.completedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--sw-ink-2)]">Date</span>
              <span className="text-[var(--sw-ink)]">
                {new Date(data.completedAt).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Code de retrait si réservation */}
        {isSuccess && data.pickupCode && (
          <div className="bg-[var(--sw-primary-subtle)] rounded-xl p-4 space-y-1">
            <p className="text-xs text-[var(--sw-ink-2)]">Code de retrait pharmacie</p>
            <p className="text-3xl font-mono font-bold tracking-[0.25em] text-[var(--sw-primary)]">
              {data.pickupCode}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {isSuccess && data.invoiceUrl && (
            <a href={data.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full" size="md">
                <Download className="w-4 h-4" />
                Télécharger la facture
              </Button>
            </a>
          )}

          {isSuccess && data.nextUrl ? (
            <Link href={data.nextUrl}>
              <Button className="w-full" size="lg" onClick={onClose}>
                {data.nextLabel ?? 'Continuer'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          ) : isFailed ? (
            <Button className="w-full" size="lg" onClick={onClose}>
              Réessayer
            </Button>
          ) : (
            <Button className="w-full" size="lg" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
