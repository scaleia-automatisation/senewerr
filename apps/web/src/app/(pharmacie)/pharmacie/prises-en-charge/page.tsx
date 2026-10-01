import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Prises en charge — Pharmacie Séné Wérr' }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function PrisesEnChargePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmacyData } = await supabase.from('pharmacies').select('id').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmacyData as unknown as { id: string } | null
  if (!pharmacy) redirect('/connexion')

  // Réservations avec prise en charge active
  const { data: resData } = await supabase
    .from('reservations_pharmacie')
    .select('id, pickup_code, status, total_amount_fcfa, created_at, patients(profiles(first_name, last_name))')
    .eq('pharmacy_id', pharmacy.id)
    .eq('has_coverage', true)
    .in('status', ['new', 'verifying', 'to_prepare', 'preparing', 'ready'])
    .order('created_at', { ascending: false })

  type Res = {
    id: string; pickup_code: string | null; status: string; total_amount_fcfa: number | null; created_at: string
    patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  }
  const list = (resData ?? []) as unknown as Res[]

  const STATUS_LABELS: Record<string, string> = {
    new: 'À vérifier', verifying: 'En vérification', to_prepare: 'À préparer',
    preparing: 'En préparation', ready: 'Prête',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Prises en charge</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Dossiers de couverture maladie en attente</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="sw-card p-8 flex flex-col items-center gap-3 text-center">
          <Shield className="w-10 h-10 text-[var(--sw-ink-3)]" />
          <div>
            <p className="font-medium text-[var(--sw-ink)]">Aucune prise en charge en attente</p>
            <p className="text-sm text-[var(--sw-ink-2)] mt-1 max-w-xs">
              Les réservations avec couverture maladie apparaîtront ici pour suivi.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(r => {
            const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
            const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
            return (
              <Link key={r.id} href={`/pharmacie/reservations/${r.id}`} className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
                <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--sw-ink)]">{patName}</p>
                  <p className="text-xs text-[var(--sw-ink-2)]">
                    {STATUS_LABELS[r.status] ?? r.status} · {fmtDate(r.created_at)}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      <div className="sw-card p-4 bg-purple-50 border-purple-100 space-y-1">
        <p className="text-xs font-semibold text-purple-700">Gestion des prises en charge</p>
        <p className="text-xs text-[var(--sw-ink-2)]">
          Le suivi détaillé des dossiers de couverture (IPM, assurance, CMU) sera disponible prochainement.
        </p>
      </div>
    </div>
  )
}
