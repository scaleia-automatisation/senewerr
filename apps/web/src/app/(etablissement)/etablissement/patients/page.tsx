import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserCheck, Calendar } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Patients — Établissement Séné Wérr' }

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
function fmtDate(d: string) { const dt = new Date(d); return `${dt.getDate()} ${MONTHS_FR[dt.getMonth()]} ${dt.getFullYear()}` }

interface AptRow {
  patient_id: string
  appointment_date: string
  patients: { profiles: { first_name: string; last_name: string } | null } | null
}

export default async function EtablissementPatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: estRaw } = await supabase.from('establishments').select('id').eq('profile_id', user.id).single()
  if (!estRaw) redirect('/etablissement/accueil')
  const est = estRaw as unknown as { id: string }

  const { data: membersData } = await supabase
    .from('establishment_professionals').select('professional:professionals(id)')
    .eq('establishment_id', est.id).eq('status', 'accepted')
  const proIds = ((membersData ?? []) as unknown as { professional: { id: string } | null }[])
    .map(m => m.professional?.id).filter(Boolean) as string[]

  let patients: { id: string; fullName: string; lastDate: string; totalVisits: number }[] = []

  if (proIds.length > 0) {
    const { data } = await supabase.from('appointments')
      .select('patient_id, appointment_date, patients!inner(profiles!inner(first_name, last_name))')
      .in('professional_id', proIds)
      .order('appointment_date', { ascending: false })
      .limit(200)
    const apts = (data ?? []) as unknown as AptRow[]

    const map = new Map<string, { id: string; fullName: string; lastDate: string; totalVisits: number }>()
    for (const a of apts) {
      const pr = (a.patients as unknown as { profiles: { first_name: string; last_name: string } | null } | null)?.profiles
      const name = pr ? `${pr.first_name} ${pr.last_name}`.trim() : 'Patient inconnu'
      if (!map.has(a.patient_id)) {
        map.set(a.patient_id, { id: a.patient_id, fullName: name, lastDate: a.appointment_date, totalVisits: 1 })
      } else {
        const e = map.get(a.patient_id)!
        e.totalVisits++
        if (a.appointment_date > e.lastDate) e.lastDate = a.appointment_date
      }
    }
    patients = Array.from(map.values())
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-[var(--sw-primary)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Patients</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{patients.length} patient{patients.length !== 1 ? 's' : ''} au total · accès limité aux informations nécessaires</p>
        </div>
      </div>

      {patients.length === 0 ? (
        <div className="sw-card p-8 text-center">
          <UserCheck className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-2" />
          <p className="text-sm text-[var(--sw-ink-2)]">
            {proIds.length === 0
              ? 'Invitez des professionnels pour voir leurs patients ici.'
              : 'Aucun patient pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {patients.map(p => (
            <div key={p.id} className="sw-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[var(--sw-primary)]">
                  {p.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--sw-ink)] truncate">{p.fullName}</p>
                <p className="text-xs text-[var(--sw-ink-2)] flex items-center gap-1">
                  <Calendar className="w-3 h-3 inline" />
                  Dernier RDV : {fmtDate(p.lastDate)} · {p.totalVisits} visite{p.totalVisits !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
