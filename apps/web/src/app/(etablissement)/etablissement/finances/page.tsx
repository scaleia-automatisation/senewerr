import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wallet, TrendingUp, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Finances — Établissement Séné Wérr' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
function fmtDate(d: string) { const dt = new Date(d); return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}` }
function fmtCFA(n: number)  { return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA' }

interface AptFin {
  id: string; appointment_date: string; start_time: string; consultation_fee: number | null
  patients: { profiles: { first_name: string; last_name: string } | null } | null
  professional: { title: string | null; profiles: { first_name: string; last_name: string } | null } | null
}

export default async function EtablissementFinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase.from('etablissements').select('id').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string }

  const { data: membersData } = await supabase
    .from('establishment_professionals')
    .select('professional:professionals(id, consultation_fee)')
    .eq('establishment_id', est.id).eq('status', 'accepted')
  const proIds = ((membersData ?? []) as unknown as { professional: { id: string; consultation_fee: number | null } | null }[])
    .map(m => m.professional?.id).filter(Boolean) as string[]
  const feeMap = new Map(
    ((membersData ?? []) as unknown as { professional: { id: string; consultation_fee: number | null } | null }[])
      .map(m => [m.professional?.id ?? '', m.professional?.consultation_fee ?? 0])
  )

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [{ data: allData }, { data: monthData }] = await Promise.all([
    proIds.length > 0
      ? supabase.from('rendez_vous')
          .select(`id, appointment_date, start_time, consultation_fee,
            patients!inner(profiles!inner(first_name, last_name)),
            professional:professionals!inner(title, profiles!inner(first_name, last_name))`)
          .in('professional_id', proIds).eq('status', 'completed')
          .order('appointment_date', { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    proIds.length > 0
      ? supabase.from('rendez_vous').select('consultation_fee, professional_id')
          .in('professional_id', proIds).eq('status', 'completed')
          .gte('appointment_date', firstOfMonth)
      : Promise.resolve({ data: [] }),
  ])

  const all   = (allData   ?? []) as unknown as AptFin[]
  const month = (monthData ?? []) as unknown as { consultation_fee: number | null; professional_id: string }[]

  const totalAll   = all.reduce((s, a)   => s + (a.consultation_fee   ?? feeMap.get('') ?? 0), 0)
  const totalMonth = month.reduce((s, a) => s + (a.consultation_fee   ?? feeMap.get(a.professional_id) ?? 0), 0)

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Finances</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">Revenus consolidés de tous les professionnels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sw-card p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[var(--sw-success)]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Ce mois</span>
          </div>
          <p className="text-2xl font-bold text-[var(--sw-ink)]">{fmtCFA(totalMonth)}</p>
          <p className="text-xs text-[var(--sw-ink-2)]">{month.length} consultation{month.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="sw-card p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[var(--sw-primary)]">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Total encaissé</span>
          </div>
          <p className="text-2xl font-bold text-[var(--sw-ink)]">{fmtCFA(totalAll)}</p>
          <p className="text-xs text-[var(--sw-ink-2)]">{all.length} consultation{all.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Historique des consultations</h2>
        {all.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune consultation terminée.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {all.map(a => {
              const pat = (a.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
              const pro = (a.professional as unknown as { title: string | null; profiles: { first_name: string; last_name: string } | null } | null)
              const patName = pat ? `${pat.first_name} ${pat.last_name}`.trim() : 'Patient'
              const proName = pro?.profiles ? `${pro.title ? pro.title + ' ' : ''}${pro.profiles.last_name}`.trim() : ''
              const fee = a.consultation_fee ?? 0
              return (
                <div key={a.id} className="sw-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{patName}</p>
                    <p className="text-xs text-[var(--sw-ink-2)]">{proName} · {fmtDate(a.appointment_date)} {a.start_time?.slice(0, 5)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[var(--sw-ink)]">{fmtCFA(fee)}</p>
                    <span className="text-xs text-[var(--sw-success)]">Encaissé</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
