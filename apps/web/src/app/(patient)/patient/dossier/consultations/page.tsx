import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Stethoscope, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Consultations — Mon dossier' }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programmée', in_progress: 'En cours', completed: 'Terminée',
  cancelled: 'Annulée', no_show: 'Absent',
}
const STATUS_CLASSES: Record<string, string> = {
  scheduled:   'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  in_progress: 'bg-blue-50 text-blue-600',
  completed:   'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cancelled:   'bg-red-50 text-[var(--sw-danger)]',
  no_show:     'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Consultation = {
  id: string; status: string; created_at: string; consultation_date: string | null; notes: string | null
  professionals: { profiles: { first_name: string | null; last_name: string | null } | null; specialty: string | null } | null
  establishments: { name: string } | null
}

export default async function DossierConsultationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const consultations: Consultation[] = []
  if (patient) {
    const { data } = await supabase
      .from('consultations')
      .select('id, status, created_at, consultation_date, notes, professionals(profiles(first_name, last_name), specialty), establishments(name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) consultations.push(...(data as unknown as Consultation[]))
  }

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <p className="text-xs text-[var(--sw-ink-2)]">{consultations.length} consultation{consultations.length > 1 ? 's' : ''}</p>

      {consultations.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <Stethoscope className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune consultation enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consultations.map(c => {
            const pro = (c.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null; specialty: string | null } | null)
            const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
            const estName = (c.establishments as unknown as { name: string } | null)?.name
            const dateStr = fmtDate(c.consultation_date ?? c.created_at)
            return (
              <div key={c.id} className="sw-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[c.status] ?? ''}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                      {dateStr && <span className="text-xs text-[var(--sw-ink-2)]">{dateStr}</span>}
                    </div>
                    {proName && <p className="text-sm font-medium text-[var(--sw-ink)]">{proName}</p>}
                    {pro?.specialty && <p className="text-xs text-[var(--sw-ink-3)]">{pro.specialty}</p>}
                    {estName && <p className="text-xs text-[var(--sw-ink-2)]">{estName}</p>}
                  </div>
                </div>
                {c.notes && (
                  <p className="text-xs text-[var(--sw-ink-2)] line-clamp-2 border-t border-[var(--sw-line)] pt-2">{c.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
