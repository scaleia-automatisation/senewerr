import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { FileText } from 'lucide-react'

type Tab = 'toutes' | 'actives' | 'expirees'

const STATUS_STYLES: Record<string, string> = {
  issued:    'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  shared:    'bg-[var(--sw-info-bg)] text-[var(--sw-info)]',
  used:      'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]',
  expired:   'bg-[var(--sw-danger-bg)] text-[var(--sw-danger)]',
  cancelled: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
}

const STATUS_LABELS: Record<string, string> = {
  issued:    'Émise',
  shared:    'Partagée',
  used:      'Utilisée',
  expired:   'Expirée',
  cancelled: 'Annulée',
}

export default async function OrdonnancesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = (params.tab ?? 'toutes') as Tab

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion?redirect=/sante/ordonnances')

  const { data: professionalData } = await supabase
    .from('professionnels')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  const professional = professionalData as unknown as { id: string } | null

  if (!professional) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <p className="text-[var(--sw-ink-2)]">Profil professionnel introuvable.</p>
      </div>
    )
  }

  const { data: prescriptions } = await supabase
    .from('ordonnances')
    .select(`
      id,
      status,
      issued_at,
      expires_at,
      patients!inner(
        id,
        profiles!inner(first_name, last_name)
      ),
      prescription_items(id)
    `)
    .eq('professional_id', professional.id)
    .order('issued_at', { ascending: false })

  const now = new Date().toISOString()

  const allPrescriptions = (prescriptions ?? []) as unknown as { id: string; status: string; issued_at: string | null; expires_at: string | null; patients: { id: string; profiles: { first_name: string; last_name: string } } | null; prescription_items: { id: string }[] }[]
  const filtered = allPrescriptions.filter(p => {
    if (tab === 'actives') return p.status === 'issued' || p.status === 'shared'
    if (tab === 'expirees') return p.status === 'expired' || (p.expires_at && p.expires_at < now)
    return true
  })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'toutes',   label: 'Toutes' },
    { key: 'actives',  label: 'Actives' },
    { key: 'expirees', label: 'Expirées' },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Ordonnances</h1>
        <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">{prescriptions?.length ?? 0} ordonnance{(prescriptions?.length ?? 0) !== 1 ? 's' : ''} au total</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[var(--sw-surface-2)] p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <a
            key={t.key}
            href={`?tab=${t.key}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--sw-surface)] text-[var(--sw-ink)] shadow-sm'
                : 'text-[var(--sw-ink-2)] hover:text-[var(--sw-ink)]'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-10 text-center">
          <FileText className="w-12 h-12 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="font-medium text-[var(--sw-ink)]">Aucune ordonnance</p>
          <p className="text-sm text-[var(--sw-ink-2)] mt-1">Aucune ordonnance dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((presc: any) => {
            const profile = presc.patients?.profiles
            const fullName = profile
              ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
              : 'Patient inconnu'
            const medCount = presc.prescription_items?.length ?? 0

            return (
              <div
                key={presc.id}
                className="bg-[var(--sw-surface)] rounded-xl border border-[var(--sw-line)] p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium text-[var(--sw-ink)]">{fullName}</p>
                    <p className="text-sm text-[var(--sw-ink-2)] mt-0.5">
                      Émise le {formatDate(presc.issued_at)}
                    </p>
                  </div>
                  <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${STATUS_STYLES[presc.status] ?? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
                    {STATUS_LABELS[presc.status] ?? presc.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm text-[var(--sw-ink-3)]">
                  <span>{medCount} médicament{medCount !== 1 ? 's' : ''}</span>
                  {presc.expires_at && (
                    <span>Expire le {formatDate(presc.expires_at)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
