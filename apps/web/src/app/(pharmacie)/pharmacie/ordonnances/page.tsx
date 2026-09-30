import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ordonnances — Pharmacie Séné Wérr' }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Res = {
  id: string
  pickup_code: string | null
  status: string
  prescription_id: string | null
  created_at: string
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  pharmacy_reservation_items: Array<{ medication_name: string; quantity: number }>
}

export default async function OrdonnancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: pharmacyData } = await supabase.from('pharmacies').select('id, name').eq('profile_id', user.id).maybeSingle()
  const pharmacy = pharmacyData as unknown as { id: string; name: string } | null
  if (!pharmacy) redirect('/connexion')

  // Réservations avec prescription_id (ordonnance obligatoire) qui sont actives
  const { data: resData } = await supabase
    .from('pharmacy_reservations')
    .select('id, pickup_code, status, prescription_id, created_at, patients(profiles(first_name, last_name)), pharmacy_reservation_items(medication_name, quantity)')
    .eq('pharmacy_id', pharmacy.id)
    .not('prescription_id', 'is', null)
    .in('status', ['new', 'verifying', 'to_prepare'])
    .order('created_at', { ascending: false })

  const pending = (resData ?? []) as unknown as Res[]

  // Ordonnances déjà vérifiées (ready/collected)
  const { data: doneData } = await supabase
    .from('pharmacy_reservations')
    .select('id, pickup_code, status, prescription_id, created_at, patients(profiles(first_name, last_name)), pharmacy_reservation_items(medication_name, quantity)')
    .eq('pharmacy_id', pharmacy.id)
    .not('prescription_id', 'is', null)
    .in('status', ['preparing', 'ready', 'collected'])
    .order('created_at', { ascending: false })
    .limit(20)

  const done = (doneData ?? []) as unknown as Res[]

  function ResCard({ r }: { r: Res }) {
    const pat = (r.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
    const patName = pat ? `${pat.first_name ?? ''} ${pat.last_name ?? ''}`.trim() : 'Patient'
    return (
      <Link href={`/pharmacie/reservations/${r.id}`} className="sw-card p-4 flex items-center gap-3 hover:border-[var(--sw-primary)] transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--sw-ink)]">{patName}</p>
          <p className="text-xs text-[var(--sw-ink-2)] mt-0.5">
            Ordonnance #{r.prescription_id?.slice(0, 8)} · {r.pharmacy_reservation_items.length} médicament{r.pharmacy_reservation_items.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-[var(--sw-ink-3)]">{fmtDate(r.created_at)}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0" />
      </Link>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-warning-bg)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--sw-warning)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Ordonnances</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Réservations nécessitant une ordonnance</p>
        </div>
      </div>

      {/* En attente */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--sw-warning)]" />
          À contrôler
          {pending.length > 0 && (
            <span className="text-xs bg-[var(--sw-warning-bg)] text-[var(--sw-warning)] px-2 py-0.5 rounded-full font-medium">{pending.length}</span>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune ordonnance en attente de contrôle.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(r => <ResCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {/* Vérifiées */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--sw-success)]" />
            Vérifiées récemment
          </h2>
          <div className="space-y-2">
            {done.map(r => <ResCard key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
