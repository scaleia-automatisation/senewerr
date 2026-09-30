import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, FilePlus } from 'lucide-react'
import { ConsultationEditor } from '@/components/sante/consultation-editor'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Consultation' }

export default async function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase
    .from('professionals')
    .select('id, establishment_professionals(establishments(id, name))')
    .eq('profile_id', user.id)
    .maybeSingle()

  const pro = proData as unknown as {
    id: string
    establishment_professionals: { establishments: { id: string; name: string } | null }[]
  } | null
  if (!pro) redirect('/connexion')

  const { data: cData } = await supabase
    .from('consultations')
    .select('id, status, consultation_date, motif, observations, clinical_notes, report, patient_id, establishment_id, appointment_id, created_at, patients(profiles(first_name, last_name, date_of_birth))')
    .eq('id', id)
    .eq('professional_id', pro.id)
    .maybeSingle()

  const consult = cData as unknown as {
    id: string; status: string; consultation_date: string | null; motif: string | null
    observations: string | null; clinical_notes: string | null; report: string | null
    patient_id: string; establishment_id: string | null; appointment_id: string | null; created_at: string
    patients: { profiles: { first_name: string | null; last_name: string | null; date_of_birth: string | null } | null } | null
  } | null

  if (!consult) notFound()

  const establishments = (pro.establishment_professionals ?? [])
    .map(ep => ep.establishments).filter(Boolean) as { id: string; name: string }[]

  const p = (consult.patients as unknown as { profiles: { first_name: string | null; last_name: string | null; date_of_birth: string | null } | null } | null)?.profiles
  const patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null

  // Ordonnances liées
  const { data: prescsData } = await supabase
    .from('prescriptions')
    .select('id, status, created_at, item_count')
    .eq('consultation_id', id)
    .order('created_at', { ascending: false })

  const prescs = (prescsData ?? []) as unknown as { id: string; status: string; created_at: string; item_count: number | null }[]

  const PRESC_STATUS: Record<string, string> = {
    draft: 'Brouillon', issued: 'Émise', shared: 'Partagée',
    verifying: 'En vérification', validated: 'Validée', refused: 'Refusée', expired: 'Expirée', used: 'Utilisée',
  }
  const PRESC_CLASS: Record<string, string> = {
    draft: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
    issued: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
    shared: 'bg-blue-50 text-blue-600',
    verifying: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
    validated: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
    refused: 'bg-red-50 text-[var(--sw-danger)]',
    expired: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
    used: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  }

  const isReadOnly = consult.status === 'cancelled'

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/sante/consultations" className="inline-flex items-center gap-2 text-sm text-[var(--sw-ink-2)] hover:text-[var(--sw-primary)]">
          <ArrowLeft className="w-4 h-4" /> Consultations
        </Link>
        {!isReadOnly && (
          <Link href={`/sante/ordonnances/nouveau?consultationId=${id}&patientId=${consult.patient_id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--sw-primary)] text-[var(--sw-primary)] text-sm font-medium hover:bg-[var(--sw-primary-subtle)]">
            <FilePlus className="w-4 h-4" /> Ordonnance
          </Link>
        )}
      </div>

      <ConsultationEditor
        mode="edit"
        consultationId={id}
        professionalId={pro.id}
        establishments={establishments}
        patientId={consult.patient_id}
        patientName={patientName}
        establishmentId={consult.establishment_id}
        appointmentId={consult.appointment_id}
        initialStatus={consult.status}
        initialMotif={consult.motif}
        initialObservations={consult.observations}
        initialClinicalNotes={consult.clinical_notes}
        initialReport={consult.report}
      />

      {prescs.length > 0 && (
        <div className="sw-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)]">Ordonnances ({prescs.length})</h2>
          <div className="space-y-2">
            {prescs.map(pr => (
              <Link key={pr.id} href={`/sante/ordonnances/${pr.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--sw-surface-2)] hover:bg-[var(--sw-primary-subtle)] transition-colors">
                <div>
                  <p className="text-xs font-medium text-[var(--sw-ink)]">ORD-{pr.id.slice(-6).toUpperCase()}</p>
                  <p className="text-xs text-[var(--sw-ink-3)]">{pr.item_count ?? 0} médicament{(pr.item_count ?? 0) > 1 ? 's' : ''} · {new Date(pr.created_at).toLocaleDateString('fr-SN')}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRESC_CLASS[pr.status] ?? ''}`}>
                  {PRESC_STATUS[pr.status] ?? pr.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
