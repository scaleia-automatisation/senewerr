import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingFlow } from '@/components/patient/booking-flow'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Prendre rendez-vous' }

export default async function ReserverRDVPage({ params }: { params: Promise<{ professionalId: string }> }) {
  const { professionalId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null
  if (!patient) redirect('/connexion')

  const { data: proData } = await supabase
    .from('professionals')
    .select('id, specialty, professional_type, title, consultation_fee_fcfa, profiles!inner(first_name, last_name, account_status), establishment_professionals(establishments(id, name, address_commune))')
    .eq('id', professionalId)
    .eq('profiles.account_status', 'verified')
    .maybeSingle()

  if (!proData) notFound()

  const pro = proData as unknown as {
    id: string; specialty: string | null; professional_type: string | null
    title: string | null; consultation_fee_fcfa: number | null
    profiles: { first_name: string | null; last_name: string | null } | null
    establishment_professionals: { establishments: { id: string; name: string; address_commune: string | null } | null }[]
  }

  const name = `${pro.title ? pro.title + ' ' : ''}${pro.profiles?.first_name ?? ''} ${pro.profiles?.last_name ?? ''}`.trim()
  const establishments = (pro.establishment_professionals ?? [])
    .map(ep => ep.establishments)
    .filter(Boolean) as { id: string; name: string; address_commune: string | null }[]

  const professional = {
    id: pro.id,
    name: name || 'Professionnel',
    specialty: pro.specialty,
    consultation_fee_fcfa: pro.consultation_fee_fcfa,
    establishments,
  }

  return (
    <div className="p-4 lg:p-6 max-w-xl mx-auto">
      <BookingFlow professional={professional} patientId={patient.id} />
    </div>
  )
}
