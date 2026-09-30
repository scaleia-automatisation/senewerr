import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConsultationEditor } from '@/components/sante/consultation-editor'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nouvelle consultation' }

export default async function NouvelleConsultationPage({ searchParams }: { searchParams: Promise<{ appointmentId?: string; patientId?: string }> }) {
  const { appointmentId, patientId: qPatientId } = await searchParams
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

  const establishments = (pro.establishment_professionals ?? [])
    .map(ep => ep.establishments).filter(Boolean) as { id: string; name: string }[]

  // Pré-remplissage via un rendez-vous
  let prefilledPatientId: string | null = null
  let prefilledEstId: string | null = establishments[0]?.id ?? null
  let prefilledMotif: string | null = null
  let patientName: string | null = null

  if (appointmentId) {
    const { data: apptData } = await supabase
      .from('appointments')
      .select('patient_id, establishment_id, reason, patients(profiles(first_name, last_name))')
      .eq('id', appointmentId)
      .eq('professional_id', pro.id)
      .maybeSingle()

    const appt = apptData as unknown as {
      patient_id: string; establishment_id: string | null; reason: string | null
      patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
    } | null

    if (appt) {
      prefilledPatientId = appt.patient_id
      if (appt.establishment_id) prefilledEstId = appt.establishment_id
      prefilledMotif = appt.reason
      const p = (appt.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
      patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
    }
  } else if (qPatientId) {
    prefilledPatientId = qPatientId
    const { data: pData } = await supabase
      .from('patients')
      .select('id, profiles(first_name, last_name)')
      .eq('id', qPatientId)
      .maybeSingle()
    const pd = pData as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null
    const p = pd?.profiles
    patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <ConsultationEditor
        mode="create"
        professionalId={pro.id}
        establishments={establishments}
        patientId={prefilledPatientId}
        patientName={patientName}
        establishmentId={prefilledEstId}
        appointmentId={appointmentId ?? null}
        motif={prefilledMotif}
      />
    </div>
  )
}
