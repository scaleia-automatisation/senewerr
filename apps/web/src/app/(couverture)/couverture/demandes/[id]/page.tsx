import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Shield, Package, MapPin, User } from 'lucide-react'
import { CoverageDecisionActions } from '@/components/couverture/coverage-decision-actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Demande de prise en charge' }

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de traitement', reviewing: 'En cours d\'examen',
  info_required: 'Informations requises', approved: 'Validée',
  partial: 'Partiellement validée', refused: 'Refusée',
}
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  reviewing: 'bg-blue-50 text-blue-600',
  info_required: 'bg-orange-50 text-orange-600',
  approved: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  partial: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  refused: 'bg-red-50 text-[var(--sw-danger)]',
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="py-2.5 border-b border-[var(--sw-line)] last:border-0">
      <p className="text-xs text-[var(--sw-ink-3)] font-medium">{label}</p>
      <p className="text-sm text-[var(--sw-ink)] mt-0.5">{value}</p>
    </div>
  )
}

function fmtCFA(n: number | null) {
  if (!n) return null
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

export default async function DemandeCouvertureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: orgData } = await supabase.from('coverage_orgs').select('id').eq('profile_id', user.id).maybeSingle()
  const org = orgData as unknown as { id: string } | null
  if (!org) redirect('/connexion')

  const { data: reqData } = await supabase
    .from('coverage_requests')
    .select('id, status, created_at, decided_at, amount_total, amount_covered, amount_patient, exclusions_notes, decision_notes, required_documents, pharmacy_reservations(id, status, quantity, notes, pharmacy_reservation_items(medication_name, pharmacy_products(dosage, form, prescription_required)), pharmacies(name, address_commune, phone)), patients(id, profiles(full_name, phone)), coverage_policies(id, plan_name)')
    .eq('id', id)
    .eq('organisme_id', org.id)
    .maybeSingle()

  const req = reqData as unknown as {
    id: string; status: string; created_at: string; decided_at: string | null
    amount_total: number | null; amount_covered: number | null; amount_patient: number | null
    exclusions_notes: string | null; decision_notes: string | null; required_documents: string | null
    pharmacy_reservations: {
      id: string; status: string; quantity: number | null; notes: string | null
      pharmacy_reservation_items: { medication_name: string; pharmacy_products?: { dosage?: string | null; form?: string | null; prescription_required?: boolean } | null }[]
      pharmacies: { name: string; address_commune: string | null; phone: string | null } | null
    } | null
    patients: { id: string; profiles: { full_name: string | null; phone: string | null } | null } | null
    coverage_policies: { id: string; plan_name: string | null } | null
  } | null

  if (!req) notFound()

  const resa = req.pharmacy_reservations as unknown as typeof req.pharmacy_reservations
  const firstItem = (resa?.pharmacy_reservation_items as { medication_name: string; pharmacy_products?: { dosage?: string | null; form?: string | null; prescription_required?: boolean } | null }[] | undefined)?.[0]
  const ph = resa?.pharmacies as unknown as { name: string; address_commune: string | null; phone: string | null } | null
  const pat = req.patients as unknown as { id: string; profiles: { full_name: string | null; phone: string | null } | null } | null
  const policy = req.coverage_policies as unknown as { id: string; plan_name: string | null } | null

  const terminalStatuses = ['approved', 'partial', 'refused']
  const isTerminal = terminalStatuses.includes(req.status)

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto space-y-5">
      <Link href="/couverture/demandes" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
        <ArrowLeft className="w-4 h-4" /> Demandes
      </Link>

      {/* Header */}
      <div className="sw-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[var(--sw-primary)]" />
          </div>
          <div className="flex-1">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CLASSES[req.status] ?? ''}`}>
              {STATUS_LABELS[req.status] ?? req.status}
            </span>
            <p className="text-xs text-[var(--sw-ink-3)] mt-1">
              Demandée le {new Date(req.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Montants */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Montant total', value: fmtCFA(req.amount_total), cls: 'text-[var(--sw-ink)]' },
            { label: 'Pris en charge', value: fmtCFA(req.amount_covered), cls: 'text-[var(--sw-success)]' },
            { label: 'Reste à charge', value: fmtCFA(req.amount_patient), cls: 'text-orange-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="sw-card p-3 text-center">
              <p className="text-xs text-[var(--sw-ink-3)]">{label}</p>
              <p className={`text-sm font-bold mt-0.5 ${cls}`}>{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Patient */}
      <div className="sw-card p-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Adhérent
        </p>
        {pat?.profiles?.full_name && <p className="text-sm font-medium text-[var(--sw-ink)]">{pat.profiles.full_name}</p>}
        {pat?.profiles?.phone && <p className="text-xs text-[var(--sw-ink-2)]">{pat.profiles.phone}</p>}
        {policy?.plan_name && <p className="text-xs text-[var(--sw-ink-3)] mt-1">Formule : {policy.plan_name}</p>}
      </div>

      {/* Médicament */}
      <div className="sw-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-2 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Médicament
        </p>
        {firstItem?.medication_name && <Field label="Nom" value={`${firstItem.medication_name}${firstItem.pharmacy_products?.dosage ? ` ${firstItem.pharmacy_products.dosage}` : ''}${firstItem.pharmacy_products?.form ? ` · ${firstItem.pharmacy_products.form}` : ''}`} />}
        {resa?.quantity && <Field label="Quantité" value={`${resa.quantity}`} />}
        {firstItem?.pharmacy_products?.prescription_required && <Field label="Ordonnance" value="Requise" />}
        {ph?.name && (
          <div className="py-2.5 last:border-0">
            <p className="text-xs text-[var(--sw-ink-3)] font-medium">Pharmacie</p>
            <p className="text-sm text-[var(--sw-ink)]">{ph.name}</p>
            {(ph.address_commune) && (
              <div className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)]">
                <MapPin className="w-3 h-3" /> {ph.address_commune}
              </div>
            )}
          </div>
        )}
      </div>

      {req.required_documents && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-orange-50 border border-orange-200">
          <p className="text-xs text-orange-700"><strong>Documents demandés :</strong> {req.required_documents}</p>
        </div>
      )}

      {req.decision_notes && (
        <div className="sw-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sw-ink-3)] mb-1">Décision</p>
          <p className="text-sm text-[var(--sw-ink)] italic">{req.decision_notes}</p>
        </div>
      )}

      {/* Actions */}
      {!isTerminal && (
        <CoverageDecisionActions
          requestId={req.id}
          reservationId={resa?.id ?? null}
          currentStatus={req.status}
          currentAmountTotal={req.amount_total}
        />
      )}
    </div>
  )
}
