import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pharmacie — Mon dossier' }

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouvelle', verifying: 'Vérification', to_prepare: 'Confirmée',
  preparing: 'Préparation', ready: 'Prête', collected: 'Retirée',
  refused: 'Refusée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  new:        'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  verifying:  'bg-blue-50 text-blue-600',
  to_prepare: 'bg-[var(--sw-primary-subtle)] text-[var(--sw-primary)]',
  preparing:  'bg-blue-50 text-blue-700',
  ready:      'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  collected:  'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  refused:    'bg-red-50 text-[var(--sw-danger)]',
  cancelled:  'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Reservation = {
  id: string; status: string; pickup_code: string | null; total_amount_fcfa: number | null
  has_coverage: boolean | null; created_at: string; collected_at: string | null
  pharmacies: { name: string } | null
}

export default async function DossierPharmaciePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const reservations: Reservation[] = []
  if (patient) {
    const { data } = await supabase
      .from('pharmacy_reservations')
      .select('id, status, pickup_code, total_amount_fcfa, has_coverage, created_at, collected_at, pharmacies(name)')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
    if (data) reservations.push(...(data as unknown as Reservation[]))
  }

  function fmtDate(s: string | null) {
    if (!s) return null
    return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  function fmtCFA(n: number | null) {
    if (n == null) return null
    return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <p className="text-xs text-[var(--sw-ink-2)]">{reservations.length} réservation{reservations.length > 1 ? 's' : ''}</p>

      {reservations.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <ShoppingBag className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucune réservation en pharmacie.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map(r => {
            const pharmName = (r.pharmacies as unknown as { name: string } | null)?.name
            const refCode = r.pickup_code ? `MED-${r.pickup_code}` : null
            return (
              <div key={r.id} className="sw-card p-4 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {refCode && <span className="font-mono text-sm font-bold text-[var(--sw-primary)]">{refCode}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[r.status] ?? ''}`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  {r.has_coverage && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">Prise en charge</span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-[var(--sw-ink-2)] flex-wrap">
                  {pharmName && <span>{pharmName}</span>}
                  <span>{fmtDate(r.created_at)}</span>
                  {r.collected_at && <span>Retiré le {fmtDate(r.collected_at)}</span>}
                </div>
                {fmtCFA(r.total_amount_fcfa) && (
                  <p className="text-xs font-medium text-[var(--sw-ink)]">{fmtCFA(r.total_amount_fcfa)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
