import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { Users, Calendar } from 'lucide-react'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/patients')

  const { data: professionalData } = await supabase
    .from('professionnels')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  const professional = professionalData as unknown as { id: string } | null

  if (!professional) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
      </div>
    )
  }

  // Get all appointments for this professional with patient info
  const { data: appointments } = await supabase
    .from('rendez_vous')
    .select(`
      id,
      patient_id,
      appointment_date,
      status,
      patients!inner(
        id,
        profiles!inner(first_name, last_name)
      )
    `)
    .eq('professional_id', professional.id)
    .order('appointment_date', { ascending: false })

  // Group by patient_id
  const patientMap = new Map<string, {
    id: string
    fullName: string
    lastAppointmentDate: string
    totalVisits: number
  }>()

  const typedApts = (appointments ?? []) as unknown as { patient_id: string; appointment_date: string; patients: { profiles: { first_name: string; last_name: string } | null } | null }[]
  for (const appt of typedApts) {
    const pat = appt.patients
    const profile = pat?.profiles
    const fullName = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      : 'Patient inconnu'

    if (!patientMap.has(appt.patient_id)) {
      patientMap.set(appt.patient_id, {
        id: appt.patient_id,
        fullName,
        lastAppointmentDate: appt.appointment_date,
        totalVisits: 1,
      })
    } else {
      const existing = patientMap.get(appt.patient_id)!
      existing.totalVisits += 1
      if (appt.appointment_date > existing.lastAppointmentDate) {
        existing.lastAppointmentDate = appt.appointment_date
      }
    }
  }

  const patients = Array.from(patientMap.values())

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Mes patients</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">{patients.length} patient{patients.length !== 1 ? 's' : ''} au total</p>
      </div>

      {patients.length === 0 ? (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <Users className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="font-medium text-[var(--sw-ink)]">Aucun patient pour l&apos;instant</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1">
            Vos patients apparaîtront ici une fois que vous aurez des rendez-vous confirmés.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map(patient => (
            <div
              key={patient.id}
              className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4 flex items-center gap-4"
            >
              {/* Avatar initiales */}
              <div className="w-10 h-10 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-[var(--sw-primary)]">
                  {patient.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--sw-ink)] truncate">{patient.fullName}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-[var(--sw-ink-3)]">
                    <Calendar className="w-3 h-3" />
                    Dernier RDV : {formatDate(patient.lastAppointmentDate)}
                  </span>
                  <span className="text-xs text-[var(--sw-ink-3)]">
                    {patient.totalVisits} visite{patient.totalVisits !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
