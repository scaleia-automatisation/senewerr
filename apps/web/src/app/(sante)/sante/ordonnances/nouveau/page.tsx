import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrdonnanceEditor } from '@/components/sante/ordonnance-editor'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nouvelle ordonnance' }

export default async function NouvelleOrdonnancePage({ searchParams }: { searchParams: Promise<{ consultationId?: string; patientId?: string }> }) {
  const { consultationId, patientId: qPatientId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase.from('professionnels').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string } | null
  if (!pro) redirect('/connexion')

  let patientId = qPatientId ?? null
  let patientName: string | null = null

  if (!patientId && consultationId) {
    const { data: cData } = await supabase.from('consultations').select('patient_id, patients(profiles(first_name, last_name))').eq('id', consultationId).eq('professional_id', pro.id).maybeSingle()
    const c = cData as unknown as { patient_id: string; patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null } | null
    if (c) {
      patientId = c.patient_id
      const p = (c.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
      patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
    }
  } else if (patientId) {
    const { data: pData } = await supabase.from('patients').select('profiles(first_name, last_name)').eq('id', patientId).maybeSingle()
    const pd = pData as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null
    const p = pd?.profiles
    patientName = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
      <OrdonnanceEditor
        mode="create"
        professionalId={pro.id}
        patientId={patientId}
        patientName={patientName}
        consultationId={consultationId ?? null}
      />
    </div>
  )
}
