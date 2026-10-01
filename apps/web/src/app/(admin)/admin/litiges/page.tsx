import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, User, Package, Building2, Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Litiges — Admin' }

// Spec 21.6 — gestion des litiges ouverts par patients, pharmacies, établissements, organismes
type Litige = {
  id: string; reference: string | null; actor_type: string; declarant_name: string | null
  motif: string | null; status: string; created_at: string; updated_at: string | null
  operation_reference: string | null
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', en_cours: 'En cours', en_attente: "En attente d'info",
  resolu: 'Résolu', cloture: 'Clôturé',
}
const STATUS_CLASSES: Record<string, string> = {
  nouveau: 'bg-red-50 text-[var(--sw-danger)]',
  en_cours: 'bg-blue-50 text-blue-600',
  en_attente: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  resolu: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cloture: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}

const ACTOR_ICON: Record<string, React.ReactNode> = {
  patient: <User className="w-4 h-4 text-[var(--sw-primary)]" />,
  pharmacie: <Package className="w-4 h-4 text-orange-600" />,
  etablissement: <Building2 className="w-4 h-4 text-blue-600" />,
  couverture: <Shield className="w-4 h-4 text-[var(--sw-success)]" />,
}

const ACTOR_LABELS: Record<string, string> = {
  patient: 'Patient', pharmacie: 'Pharmacie', etablissement: 'Établissement', couverture: 'Organisme de couverture',
}

const TABS = [
  { key: '', label: 'Tous' },
  { key: 'nouveau', label: 'Nouveaux' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'en_attente', label: "En attente d'info" },
  { key: 'resolu', label: 'Résolus' },
]

export default async function AdminLitigesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status: filterStatus, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const PAGE_SIZE = 20

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profils').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  type Chain = {
    eq: (c: string, v: string) => Chain
    in: (c: string, v: string[]) => Chain
    order: (c: string, o: { ascending: boolean }) => Chain
    range: (from: number, to: number) => Promise<{ data: unknown[] | null; count: number | null }>
  }
  type RawQuery = { select: (q: string, opts?: { count?: string }) => Chain }

  let q = (supabase.from('litiges') as unknown as RawQuery)
    .select(
      'id, reference, actor_type, declarant_name, motif, status, created_at, updated_at, operation_reference',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (filterStatus) q = q.eq('status', filterStatus)

  const { data, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const litiges = (data ?? []) as unknown as Litige[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const countsByStatus: Record<string, number> = {}
  for (const s of ['nouveau', 'en_cours', 'en_attente', 'resolu', 'cloture']) {
    const { count: c } = await (supabase.from('litiges') as unknown as RawQuery)
      .select('id', { count: 'exact' })
      .eq('status', s)
      .range(0, 0)
    countsByStatus[s] = (c as unknown as number) ?? 0
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Litiges et réclamations</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 21.6 — ouverts par patients, pharmacies, établissements ou organismes</p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-2">
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-danger)]">{countsByStatus['nouveau'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">Nouveaux</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{countsByStatus['en_cours'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">En cours</p>
        </div>
        <div className="sw-card p-3 text-center">
          <p className="text-lg font-bold text-[var(--sw-warning)]">{countsByStatus['en_attente'] ?? 0}</p>
          <p className="text-xs text-[var(--sw-ink-3)]">En attente</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?status=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterStatus ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label} {t.key ? `(${countsByStatus[t.key] ?? 0})` : `(${total})`}
          </a>
        ))}
      </div>

      {litiges.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-[var(--sw-ink-3)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun litige{filterStatus ? ' dans cette catégorie' : ''}.</p>
        </div>
      ) : (
        <div className="sw-card overflow-hidden">
          <div className="divide-y divide-[var(--sw-line)]">
            {litiges.map(l => (
              <Link key={l.id} href={`/admin/litiges/${l.id}`}
                className="block px-4 py-3.5 hover:bg-[var(--sw-surface-2)] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    {ACTOR_ICON[l.actor_type] ?? <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLASSES[l.status] ?? ''}`}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </span>
                      <span className="text-xs text-[var(--sw-ink-3)]">{ACTOR_LABELS[l.actor_type] ?? l.actor_type}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--sw-ink)] mt-0.5">
                      {l.declarant_name ?? 'Déclarant inconnu'}
                      {l.reference && <span className="text-xs text-[var(--sw-ink-3)] ml-2 font-normal">#{l.reference}</span>}
                    </p>
                    {l.motif && <p className="text-xs text-[var(--sw-ink-2)] mt-0.5 line-clamp-1">{l.motif}</p>}
                    <p className="text-xs text-[var(--sw-ink-3)] mt-0.5">
                      {new Date(l.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {l.operation_reference && ` · opération ${l.operation_reference}`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--sw-ink-3)]">Page {page} / {totalPages} · {total} litiges</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page - 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink)]">← Précédent</a>
            )}
            {page < totalPages && (
              <a href={`?${filterStatus ? `status=${filterStatus}&` : ''}page=${page + 1}`}
                className="px-3 py-1.5 text-xs rounded-xl bg-[var(--sw-primary)] text-white">Suivant →</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
