import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Examens — Mon dossier' }

type Exam = {
  id: string; exam_type: string | null; status: string; created_at: string
  result_available: boolean | null; result_summary: string | null
  professionals: { profiles: { first_name: string | null; last_name: string | null } | null } | null
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Demandé', pending: 'En attente', completed: 'Résultat disponible', cancelled: 'Annulé',
}
const STATUS_CLASSES: Record<string, string> = {
  requested:  'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  pending:    'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  completed:  'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cancelled:  'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

export default async function DossierExamensPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const exams: Exam[] = []
  if (patient) {
    const { data } = await supabase
      .from('patient_exams')
      .select('id, exam_type, status, created_at, result_available, result_summary, professionals(profiles(first_name, last_name))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) exams.push(...(data as unknown as Exam[]))
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <p className="text-xs text-[var(--sw-ink-2)]">{exams.length} examen{exams.length > 1 ? 's' : ''}</p>

      {exams.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <FlaskConical className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun examen enregistré.</p>
          <p className="text-xs text-[var(--sw-ink-3)] mt-1">Les demandes et résultats d'examens apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map(e => {
            const pro = (e.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)
            const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
            return (
              <div key={e.id} className="sw-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[e.status] ?? ''}`}>
                    {STATUS_LABELS[e.status] ?? e.status}
                  </span>
                  <span className="text-xs text-[var(--sw-ink-2)]">{fmtDate(e.created_at)}</span>
                </div>
                {e.exam_type && <p className="text-sm font-medium text-[var(--sw-ink)]">{e.exam_type}</p>}
                {proName && <p className="text-xs text-[var(--sw-ink-2)]">{proName}</p>}
                {e.result_summary && (
                  <p className="text-xs text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-2">{e.result_summary}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
