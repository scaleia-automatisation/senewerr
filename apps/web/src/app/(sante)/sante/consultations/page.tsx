import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight, Stethoscope, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes consultations' }

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programmée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
}
const STATUS_CLASSES: Record<string, string> = {
  scheduled:   'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  in_progress: 'bg-blue-50 text-blue-600',
  completed:   'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cancelled:   'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

type Consult = {
  id: string; status: string; consultation_date: string | null; created_at: string; motif: string | null
  patients: { profiles: { first_name: string | null; last_name: string | null } | null } | null
  establishments: { name: string } | null
}

function fmtDate(s: string | null) {
  if (!s) return null
  return new Date(s).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ConsultationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const active = tab ?? 'all'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: proData } = await supabase.from('professionnels').select('id').eq('profile_id', user.id).maybeSingle()
  const pro = proData as unknown as { id: string } | null
  if (!pro) redirect('/connexion')

  let q = supabase
    .from('consultations')
    .select('id, status, consultation_date, created_at, motif, patients(profiles(first_name, last_name)), establishments(name)')
    .eq('professional_id', pro.id)
    .order('consultation_date', { ascending: false })
    .limit(50)

  if (active !== 'all') q = q.eq('status', active)

  const { data } = await q
  const consultations = (data ?? []) as unknown as Consult[]

  const TABS = [
    { key: 'all',        label: 'Toutes' },
    { key: 'in_progress',label: 'En cours' },
    { key: 'completed',  label: 'Terminées' },
    { key: 'scheduled',  label: 'Programmées' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--sw-ink)]">Consultations</h1>
          <p className="text-xs text-[var(--sw-ink-2)]">{consultations.length} résultat{consultations.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/sante/consultations/nouveau" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium hover:opacity-90 shrink-0">
          <Plus className="w-4 h-4" /> Nouvelle
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <Link key={t.key} href={`?tab=${t.key}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${active === t.key ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)]'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {consultations.length === 0 ? (
          <div className="sw-card p-10 text-center">
            <Stethoscope className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
            <p className="text-sm text-[var(--sw-ink-2)]">Aucune consultation pour ce filtre.</p>
          </div>
        ) : consultations.map(c => {
          const pProfile = (c.patients as unknown as { profiles: { first_name: string | null; last_name: string | null } | null } | null)?.profiles
          const patientName = pProfile ? `${pProfile.first_name ?? ''} ${pProfile.last_name ?? ''}`.trim() : 'Patient inconnu'
          const estName = (c.establishments as unknown as { name: string } | null)?.name
          return (
            <Link key={c.id} href={`/sante/consultations/${c.id}`}
              className="sw-card p-4 flex items-start gap-3 hover:border-[var(--sw-primary)] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[var(--sw-primary-subtle)] flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-[var(--sw-primary)]" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--sw-ink)]">{patientName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASSES[c.status] ?? ''}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--sw-ink-2)]">{fmtDate(c.consultation_date ?? c.created_at)}{estName ? ` · ${estName}` : ''}</p>
                {c.motif && <p className="text-xs text-[var(--sw-ink-3)] italic truncate">{c.motif}</p>}
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--sw-ink-3)] shrink-0 mt-1" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
