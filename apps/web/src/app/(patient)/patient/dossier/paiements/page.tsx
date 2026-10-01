import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreditCard } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Paiements — Mon dossier' }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtCFA(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

type Payment = {
  id: string; amount_fcfa: number | null; status: string; created_at: string
  payment_method: string | null; reference: string | null
  pharmacies: { name: string } | null
  establishments: { name: string } | null
}

type CoverageReq = {
  id: string; patient_amount_fcfa: number | null; approved_at: string | null
  pharmacies: { name: string } | null
  establishments: { name: string } | null
}

export default async function DossierPaiementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: patientData } = await supabase.from('patients').select('id').eq('profile_id', user.id).maybeSingle()
  const patient = patientData as unknown as { id: string } | null

  const payments: Payment[] = []
  const racs: CoverageReq[] = []

  if (patient) {
    const [paymentsRes, racsRes] = await Promise.all([
      supabase.from('patient_payments').select('id, amount_fcfa, status, created_at, payment_method, reference, pharmacies(name), establishments(name)').eq('patient_id', patient.id).order('created_at', { ascending: false }),
      supabase.from('demandes_couverture').select('id, patient_amount_fcfa, approved_at, pharmacies(name), establishments(name)').eq('patient_id', patient.id).eq('status', 'approved').not('patient_amount_fcfa', 'is', null).order('approved_at', { ascending: false }),
    ])
    if (paymentsRes.data) payments.push(...(paymentsRes.data as unknown as Payment[]))
    if (racsRes.data) racs.push(...(racsRes.data as unknown as CoverageReq[]))
  }

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Espèces', card: 'Carte', wave: 'Wave', orange_money: 'Orange Money',
    free_money: 'Free Money', expresso: 'Expresso Money',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {/* Restes à charge issus des prises en charge */}
      {racs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2">Restes à charge — prises en charge</h2>
          <div className="space-y-2">
            {racs.map(r => {
              const provName = (r.pharmacies as unknown as { name: string } | null)?.name ?? (r.establishments as unknown as { name: string } | null)?.name
              return (
                <div key={r.id} className="sw-card p-4 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-[var(--sw-warning)]">{fmtCFA(r.patient_amount_fcfa)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] font-medium">Reste à charge</span>
                  </div>
                  <div className="flex gap-3 text-xs text-[var(--sw-ink-2)]">
                    {provName && <span>{provName}</span>}
                    {r.approved_at && <span>{fmtDate(r.approved_at)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Paiements directs */}
      {payments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2">Paiements effectués</h2>
          <div className="space-y-2">
            {payments.map(p => {
              const provName = (p.pharmacies as unknown as { name: string } | null)?.name ?? (p.establishments as unknown as { name: string } | null)?.name
              return (
                <div key={p.id} className="sw-card p-4 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-sm text-[var(--sw-ink)]">{fmtCFA(p.amount_fcfa)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--sw-success-bg)] text-[var(--sw-success)] font-medium">Payé</span>
                  </div>
                  <div className="flex gap-3 text-xs text-[var(--sw-ink-2)] flex-wrap">
                    {provName && <span>{provName}</span>}
                    {p.payment_method && <span>{PAYMENT_LABELS[p.payment_method] ?? p.payment_method}</span>}
                    <span>{fmtDate(p.created_at)}</span>
                  </div>
                  {p.reference && <p className="text-xs font-mono text-[var(--sw-ink-3)]">Réf. {p.reference}</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {payments.length === 0 && racs.length === 0 && (
        <div className="sw-card p-10 text-center">
          <CreditCard className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun paiement enregistré.</p>
        </div>
      )}
    </div>
  )
}
