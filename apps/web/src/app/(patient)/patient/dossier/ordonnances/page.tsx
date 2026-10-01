import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ordonnances — Mon dossier' }

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', expired: 'Expirée', dispensed: 'Délivrée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  active:    'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  expired:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  dispensed: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  cancelled: 'bg-red-50 text-[var(--sw-danger)]',
}

type Prescription = {
  id: string; status: string; created_at: string; valid_until: string | null
  notes: string | null; item_count: number | null
  professionals: { profiles: { first_name: string | null; last_name: string | null } | null } | null
}

export default async function DossierOrdonnancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const prescriptions: Prescription[] = []
  if (patient) {
    const { data } = await supabase
      .from('ordonnances')
      .select('id, status, created_at, valid_until, notes, item_count, professionals(profiles(first_name, last_name))')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) prescriptions.push(...(data as unknown as Prescription[]))
  }

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const refNum = (id: string) => `ORD-${id.slice(-6).toUpperCase()}`

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <p className="text-xs text-[var(--sw-ink-2)]">{prescriptions.length} ordonnance{prescriptions.length > 1 ? 's' : ''}</p>

      {prescriptions.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <FileText className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune ordonnance enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prescriptions.map(p => {
            const pro = (p.professionals as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)
            const proName = pro?.profiles ? `Dr ${pro.profiles.first_name ?? ''} ${pro.profiles.last_name ?? ''}`.trim() : null
            return (
              <div key={p.id} className="sw-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-[var(--sw-primary)]">{refNum(p.id)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[p.status] ?? ''}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs text-[var(--sw-ink-2)] flex-wrap">
                      {proName && <span>{proName}</span>}
                      <span>{fmtDate(p.created_at)}</span>
                      {p.item_count != null && <span>{p.item_count} médicament{p.item_count > 1 ? 's' : ''}</span>}
                    </div>
                    {p.valid_until && (
                      <p className="text-xs text-[var(--sw-ink-3)]">Valable jusqu'au {fmtDate(p.valid_until)}</p>
                    )}
                  </div>
                  <FileText className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-0.5" />
                </div>
                {p.notes && (
                  <p className="text-xs text-[var(--sw-ink-2)] border-t border-[var(--sw-line)] pt-2">{p.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
