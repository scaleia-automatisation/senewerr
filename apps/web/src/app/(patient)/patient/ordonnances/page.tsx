import Link from 'next/link'
import { FileText, Pill, Calendar, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes ordonnances' }

type PrescriptionStatus = 'draft' | 'issued' | 'shared' | 'verifying' | 'validated' | 'refused' | 'expired' | 'used'

const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  shared: 'Partagée',
  verifying: 'En vérification',
  validated: 'Validée',
  refused: 'Refusée',
  expired: 'Expirée',
  used: 'Utilisée',
}

const STATUS_CLASSES: Record<PrescriptionStatus, string> = {
  draft: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  issued: 'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  shared: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  validated: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
  expired: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  used: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
}

const ACTIVE_STATUSES: PrescriptionStatus[] = ['issued', 'shared', 'verifying']
const INACTIVE_STATUSES: PrescriptionStatus[] = ['validated', 'refused', 'expired', 'used', 'draft']

function StatusBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface PrescriptionItem {
  id: string
  medication_name: string
  dosage: string | null
}

interface Prescription {
  id: string
  issued_at: string | null
  expires_at: string | null
  status: PrescriptionStatus
  notes: string | null
  prescription_items: PrescriptionItem[]
  professionals: { profiles: { first_name: string; last_name: string } | null } | null
}

export default async function OrdonnancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patientData } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', user!.id)
    .single()
  const patient = patientData as unknown as { id: string } | null

  let active: Prescription[] = []
  let inactive: Prescription[] = []

  if (patient) {
    const { data } = await supabase
      .from('prescriptions')
      .select(`
        id,
        issued_at,
        expires_at,
        status,
        notes,
        prescription_items(id, medication_name, dosage),
        professionals(profiles(first_name, last_name))
      `)
      .eq('patient_id', patient.id)
      .order('issued_at', { ascending: false })

    if (data) {
      const typed = data as unknown as Prescription[]
      active = typed.filter(p => ACTIVE_STATUSES.includes(p.status as PrescriptionStatus))
      inactive = typed.filter(p => INACTIVE_STATUSES.includes(p.status as PrescriptionStatus))
    }
  }

  function PrescriptionCard({ rx }: { rx: Prescription }) {
    return (
      <div className="sw-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--sw-primary)] flex-shrink-0" />
            <span className="text-sm font-semibold text-[var(--sw-ink)]">
              {rx.issued_at ? formatDate(rx.issued_at) : 'Date inconnue'}
            </span>
          </div>
          <StatusBadge status={rx.status} />
        </div>

        {rx.professionals?.profiles && (
          <p className="text-xs text-[var(--sw-ink-2)]">
            Dr {rx.professionals?.profiles?.first_name} {rx.professionals?.profiles?.last_name}
          </p>
        )}

        {rx.expires_at && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--sw-ink-3)]">
            <Calendar className="w-3 h-3" />
            Expire le {formatDate(rx.expires_at)}
          </div>
        )}

        {rx.prescription_items && rx.prescription_items.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-[var(--sw-line)]">
            <p className="text-xs font-medium text-[var(--sw-ink-2)]">
              {rx.prescription_items.length} médicament{rx.prescription_items.length > 1 ? 's' : ''}
            </p>
            {rx.prescription_items.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <Pill className="w-3 h-3 text-[var(--sw-ink-3)] flex-shrink-0" />
                <span className="text-xs text-[var(--sw-ink)]">
                  {item.medication_name}
                  {item.dosage && <span className="text-[var(--sw-ink-3)]"> — {item.dosage}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const hasAny = active.length > 0 || inactive.length > 0

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes ordonnances</h1>

      {!hasAny ? (
        <div className="sw-card p-10 flex flex-col items-center gap-4 text-center">
          <FileText className="w-12 h-12 text-[var(--sw-ink-3)]" />
          <div>
            <p className="text-sm font-medium text-[var(--sw-ink)]">Aucune ordonnance pour l'instant</p>
            <p className="text-xs text-[var(--sw-ink-2)] mt-1">
              Vos ordonnances apparaîtront ici après une consultation
            </p>
          </div>
          <Link
            href="/patient/rendez-vous"
            className="text-sm text-[var(--sw-primary)] font-medium hover:underline"
          >
            Prendre un rendez-vous
          </Link>
        </div>
      ) : (
        <>
          {/* Actives */}
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Actives ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map(rx => <PrescriptionCard key={rx.id} rx={rx} />)}
              </div>
            </section>
          )}

          {/* Historique */}
          {inactive.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--sw-ink-2)] uppercase tracking-wide">
                Historique ({inactive.length})
              </h2>
              <div className="space-y-3">
                {inactive.map(rx => <PrescriptionCard key={rx.id} rx={rx} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Info */}
      <div className="sw-card p-4 flex items-start gap-3 bg-[var(--sw-info-bg)]">
        <AlertCircle className="w-4 h-4 text-[var(--sw-info)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--sw-ink-2)]">
          Pour utiliser une ordonnance en pharmacie, partagez son QR code directement depuis l'application.
        </p>
      </div>
    </div>
  )
}
