'use client'
import { CheckCircle2, Calendar, Clock, MapPin, User, Video, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogBody } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCFA } from '@/lib/utils'

export interface AppointmentConfirmationData {
  appointmentId: string
  providerName: string
  providerType: string
  specialty?: string
  appointmentType: 'in_person' | 'teleconsultation'
  date: Date
  startTime: string
  endTime: string
  address?: string
  feeFcfa?: number
  notes?: string
}

interface Props {
  open: boolean
  onClose: () => void
  data: AppointmentConfirmationData
}

export function AppointmentConfirmationModal({ open, onClose, data }: Props) {
  const formattedDate = new Date(data.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const isTeleconsult = data.appointmentType === 'teleconsultation'

  return (
    <Dialog open={open} onClose={onClose} closeOnBackdrop={false} className="max-w-sm">
      <DialogBody className="text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[var(--sw-success-bg)] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[var(--sw-success)]" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-[var(--sw-ink)]">Rendez-vous confirmé !</h2>
          <p className="text-sm text-[var(--sw-ink-2)]">
            Votre rendez-vous a été pris avec succès
          </p>
        </div>

        {/* Détails */}
        <div className="text-left space-y-3">
          <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
            <User className="w-4 h-4 text-[var(--sw-primary)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">{data.providerName}</p>
              <p className="text-xs text-[var(--sw-ink-2)]">
                {data.specialty ?? data.providerType}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
            <Calendar className="w-4 h-4 text-[var(--sw-primary)] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)] capitalize">{formattedDate}</p>
              <p className="text-xs text-[var(--sw-ink-2)]">{data.startTime} – {data.endTime}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
            {isTeleconsult ? (
              <Video className="w-4 h-4 text-[var(--sw-info)] mt-0.5 shrink-0" />
            ) : (
              <MapPin className="w-4 h-4 text-[var(--sw-primary)] mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--sw-ink)]">
                {isTeleconsult ? 'Téléconsultation' : 'En présentiel'}
              </p>
              {!isTeleconsult && data.address && (
                <p className="text-xs text-[var(--sw-ink-2)]">{data.address}</p>
              )}
              {isTeleconsult && (
                <p className="text-xs text-[var(--sw-ink-2)]">Un lien vous sera envoyé avant le rendez-vous</p>
              )}
            </div>
          </div>

          {data.feeFcfa != null && data.feeFcfa > 0 && (
            <div className="flex items-start gap-3 p-3 bg-[var(--sw-surface-2)] rounded-xl">
              <Clock className="w-4 h-4 text-[var(--sw-ink-3)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--sw-ink)]">Consultation</p>
                <p className="text-xs text-[var(--sw-ink-2)]">{formatCFA(data.feeFcfa)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Link href={`/rendez-vous/${data.appointmentId}`} onClick={onClose}>
            <Button className="w-full" size="lg">
              Voir mon rendez-vous
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" className="w-full" size="md" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
