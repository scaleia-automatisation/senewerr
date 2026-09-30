'use client'
import { CheckCircle2, Clock, MapPin, QrCode, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCFA } from '@/lib/utils'

export interface ReservationConfirmationData {
  reservationId: string
  pickupCode: string
  pharmacyName: string
  pharmacyAddress: string
  expiryAt: Date
  totalAmountFcfa: number
  patientShareFcfa?: number
  coverageShareFcfa?: number
  hasPaid: boolean
  items: Array<{ name: string; quantity: number; unitPriceFcfa?: number }>
}

interface Props {
  open: boolean
  onClose: () => void
  data: ReservationConfirmationData
}

export function ReservationConfirmationModal({ open, onClose, data }: Props) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(data.pickupCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const expiryDate = new Date(data.expiryAt)
  const formattedExpiry = expiryDate.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Dialog open={open} onClose={onClose} closeOnBackdrop={false} className="max-w-sm">
      <DialogBody className="text-center space-y-5">
        {/* Icône succès */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--sw-ink)]">Réservation confirmée !</h2>
          <p className="text-sm text-[var(--sw-ink-2)]">
            Vos médicaments sont réservés
          </p>
        </div>

        {/* Code de retrait */}
        <div className="bg-[var(--sw-primary-subtle)] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-center gap-2 text-[var(--sw-ink-2)] text-xs">
            <QrCode className="w-3.5 h-3.5" />
            <span>Code de retrait</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-mono font-bold tracking-[0.25em] text-[var(--sw-primary)]">
              {data.pickupCode}
            </span>
            <button
              onClick={copyCode}
              className="p-2 rounded-lg text-[var(--sw-ink-3)] hover:text-[var(--sw-primary)] hover:bg-[var(--sw-surface)] transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[var(--sw-success)]" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-[var(--sw-ink-3)]">Montrez ce code à la pharmacie</p>
        </div>

        {/* Pharmacie */}
        <div className="text-left space-y-3">
          <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
            <MapPin className="w-4 h-4 text-[var(--sw-primary)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">{data.pharmacyName}</p>
              <p className="text-xs text-[var(--sw-ink-2)]">{data.pharmacyAddress}</p>
            </div>
          </div>

          {/* Expiry */}
          <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
            <Clock className="w-4 h-4 text-[var(--sw-warning)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--sw-ink)]">
                {data.hasPaid ? 'Valable 72h après paiement' : 'Valable 3h (sans paiement)'}
              </p>
              <p className="text-xs text-[var(--sw-ink-2)]">Expire le {formattedExpiry}</p>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="text-left space-y-2">
          <p className="text-xs font-medium text-[var(--sw-ink-3)] uppercase tracking-wide">Articles réservés</p>
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[var(--sw-ink)]">{item.name} × {item.quantity}</span>
              {item.unitPriceFcfa && (
                <span className="text-[var(--sw-ink-2)]">{formatCFA(item.unitPriceFcfa * item.quantity)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Montants */}
        {data.totalAmountFcfa > 0 && (
          <div className="border-t border-[var(--sw-line)] pt-3 space-y-1 text-sm">
            {data.coverageShareFcfa != null && data.coverageShareFcfa > 0 && (
              <div className="flex justify-between text-[var(--sw-ink-2)]">
                <span>Prise en charge mutuelle</span>
                <span className="text-[var(--sw-success)]">- {formatCFA(data.coverageShareFcfa)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-[var(--sw-ink)]">
              <span>{data.hasPaid ? 'Montant payé' : 'Montant à payer'}</span>
              <span>{formatCFA(data.patientShareFcfa ?? data.totalAmountFcfa)}</span>
            </div>
          </div>
        )}

        <Button onClick={onClose} className="w-full" size="lg">
          Fermer
        </Button>
      </DialogBody>
    </Dialog>
  )
}
