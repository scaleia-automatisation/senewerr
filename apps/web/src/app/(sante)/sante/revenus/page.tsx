import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wallet, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Revenus — Séné Wérr Santé' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}`
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-SN').format(n) + ' F CFA'
}

interface CompletedApt {
  id: string
  appointment_date: string
  start_time: string
  consultation_fee: number | null
  patients: { profiles: { first_name: string; last_name: string } | null } | null
}

export default async function RevenusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase
    .from('professionals')
    .select('id, consultation_fee')
    .eq('profile_id', user.id)
    .maybeSingle()
  const pro = proData as unknown as { id: string; consultation_fee: number | null } | null

  if (!pro) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
      </div>
    )
  }

  // Consultations terminées ce mois
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [{ data: allCompleted }, { data: thisMonthData }] = await Promise.all([
    supabase.from('appointments')
      .select(`id, appointment_date, start_time, consultation_fee,
        patients!inner(profiles!inner(first_name, last_name))`)
      .eq('professional_id', pro.id)
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .limit(50),
    supabase.from('appointments')
      .select('consultation_fee')
      .eq('professional_id', pro.id)
      .eq('status', 'completed')
      .gte('appointment_date', firstOfMonth),
  ])

  const completed  = (allCompleted ?? []) as unknown as CompletedApt[]
  const thisMonth  = (thisMonthData ?? []) as unknown as { consultation_fee: number | null }[]

  const defaultFee = pro.consultation_fee ?? 0
  const totalThisMonth = thisMonth.reduce((s, a) => s + (a.consultation_fee ?? defaultFee), 0)
  const totalAllTime   = completed.reduce((s, a) => s + (a.consultation_fee ?? defaultFee), 0)
  const pending = 0 // paiements en attente — à connecter à la table payments quand disponible

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Revenus</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">
            Séparés des frais d'abonnement Séné Wérr
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sw-card p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[var(--sw-success)]">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Ce mois</span>
          </div>
          <p className="text-2xl font-bold text-[var(--sw-ink)]">{fmtCFA(totalThisMonth)}</p>
          <p className="text-xs text-[var(--sw-ink-2)]">{thisMonth.length} consultation{thisMonth.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="sw-card p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[var(--sw-primary)]">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Total encaissé</span>
          </div>
          <p className="text-2xl font-bold text-[var(--sw-ink)]">{fmtCFA(totalAllTime)}</p>
          <p className="text-xs text-[var(--sw-ink-2)]">{completed.length} consultation{completed.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="sw-card p-5 space-y-1.5">
          <div className="flex items-center gap-2 text-[var(--sw-warning)]">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">En attente</span>
          </div>
          <p className="text-2xl font-bold text-[var(--sw-ink)]">{fmtCFA(pending)}</p>
          <p className="text-xs text-[var(--sw-ink-2)]">Paiements à recevoir</p>
        </div>
      </div>

      {/* Tarif de consultation */}
      <div className="sw-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--sw-ink-3)] font-medium">Tarif de consultation</p>
          <p className="text-lg font-bold text-[var(--sw-ink)]">{fmtCFA(defaultFee)}</p>
        </div>
        <span className="text-xs text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)] px-2.5 py-1 rounded-full">Par défaut</span>
      </div>

      {/* Historique */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-3">Historique des consultations</h2>
        {completed.length === 0 ? (
          <div className="sw-card p-6 text-center">
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune consultation terminée pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completed.map(apt => {
              const p = (apt.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
              const patName = p ? `${p.first_name} ${p.last_name}`.trim() : 'Patient inconnu'
              const fee = apt.consultation_fee ?? defaultFee
              return (
                <div key={apt.id} className="sw-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--sw-ink)] truncate">{patName}</p>
                    <p className="text-xs text-[var(--sw-ink-2)]">
                      {fmtDate(apt.appointment_date)} · {apt.start_time?.slice(0, 5)}
                    </p>
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

      {/* Note séparation abonnement */}
      <p className="text-xs text-[var(--sw-ink-3)] border-t border-[var(--sw-line)] pt-4">
        Les frais d'abonnement Séné Wérr sont gérés séparément dans <strong>Abonnement</strong>.
        Les revenus médicaux affichés ici correspondent uniquement aux consultations réalisées.
      </p>
    </div>
  )
}
