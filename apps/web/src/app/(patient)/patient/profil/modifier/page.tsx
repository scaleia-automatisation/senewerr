import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EditForm } from './edit-form'

export default async function ModifierProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: profileData }, { data: patientData }] = await Promise.all([
    supabase.from('profils').select('*').eq('id', user.id).single(),
    supabase.from('patients').select('*').eq('profile_id', user.id).single(),
  ])

  const profile = profileData as any
  const patient = patientData as any

  const initial = {
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    phone: profile?.phone ?? null,
    date_of_birth: patient?.date_of_birth ?? null,
    gender: patient?.gender ?? null,
    blood_group: patient?.blood_group ?? null,
    nin: patient?.nin ?? null,
    weight_kg: patient?.weight_kg ?? null,
    height_cm: patient?.height_cm ?? null,
    allergies: patient?.allergies ?? null,
    chronic_conditions: patient?.chronic_conditions ?? null,
    emergency_contact_name: patient?.emergency_contact_name ?? null,
    emergency_contact_phone: patient?.emergency_contact_phone ?? null,
    address_region: patient?.address_region ?? null,
    address_department: patient?.address_department ?? null,
    address_commune: patient?.address_commune ?? null,
    address_details: patient?.address_details ?? null,
  }

  return <EditForm userId={user.id} initial={initial} />
}
