import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { CheckCircle2, XCircle, MessageSquare, User, Stethoscope, Building2, Package, Shield } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Validation des comptes — Admin' }

// Spec 21.4 — validation des acteurs, chaque décision historisée et notifiée
type PendingActor = {
  id: string; profile_id: string; name: string | null; actor_type: string
  status: string | null; created_at: string; email: string | null
}

const ACTOR_META: Record<string, { label: string; icon: React.ReactNode }> = {
  professionals: { label: 'Professionnel de santé', icon: <Stethoscope className="w-4 h-4 text-purple-600" /> },
  establishments: { label: 'Établissement', icon: <Building2 className="w-4 h-4 text-blue-600" /> },
  pharmacies: { label: 'Pharmacie', icon: <Package className="w-4 h-4 text-orange-600" /> },
  organismes_couverture: { label: 'Organisme de couverture', icon: <Shield className="w-4 h-4 text-[var(--sw-success)]" /> },
}

// Spec 21.4 — server actions : valider / refuser / demander un complément / suspendre
async function validateActor(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const actorId = formData.get('actor_id') as string
  const table = formData.get('table') as string
  const action = formData.get('action') as 'approve' | 'refuse' | 'info_required' | 'suspend'
  const motif = formData.get('motif') as string | null

  const newStatus = action === 'approve' ? 'active'
    : action === 'refuse' ? 'refused'
    : action === 'suspend' ? 'suspended'
    : 'info_required'

  type UpdateFn = { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
  await (supabase.from(table) as unknown as UpdateFn)
    .update({ status: newStatus, ...(motif ? { admin_notes: motif } : {}) })
    .eq('id', actorId)

  // Spec 21.4 — chaque décision est historisée (logEvent stub)
  type InsertEventFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertEventFn).insert({
    event_type: `account.${action}`,
    actor_type: 'admin',
    object_type: table,
    object_id: actorId,
    result: 'success',
    category: 'compte',
    metadata: { motif, new_status: newStatus },
  })

  revalidatePath('/admin/validation')
  // Revalider les espaces concernés pour que le changement de statut soit visible immédiatement
  revalidatePath('/sante/accueil')
  revalidatePath('/sante/onboarding')
  revalidatePath('/pharmacie/accueil')
  revalidatePath('/couverture/accueil')
}

export default async function AdminValidationPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { table: filterTable } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  // Fetch pending actors from all actor tables
  type ActorRow = { id: string; profile_id: string; name?: string | null; full_name?: string | null; status: string | null; created_at: string; profiles?: { email: string | null } | null }
  type FetchFn = { select: (q: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown[] | null }> } }

  const tables = Object.keys(ACTOR_META)
  const fetches = await Promise.allSettled(
    tables.map(t =>
      (supabase.from(t) as unknown as FetchFn)
        .select('id, profile_id, name, full_name, status, created_at, profiles(email)')
        .in('status', ['pending_verification', 'info_required', 'pending'])
        .then(r => ({ table: t, rows: (r.data ?? []) as ActorRow[] }))
    )
  )

  const allActors: (PendingActor & { table: string })[] = fetches
    .flatMap(f => {
      if (f.status !== 'fulfilled') return []
      return f.value.rows.map(r => ({
        id: r.id,
        profile_id: r.profile_id,
        name: r.name ?? r.full_name ?? null,
        actor_type: ACTOR_META[f.value.table]?.label ?? f.value.table,
        status: r.status,
        created_at: r.created_at,
        email: (r.profiles as unknown as { email: string | null } | null)?.email ?? null,
        table: f.value.table,
      }))
    })
    .filter(a => !filterTable || a.table === filterTable)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const TABS = [{ key: '', label: `Tous (${allActors.length})` }, ...tables.map(t => ({
    key: t, label: `${ACTOR_META[t]?.label} (${allActors.filter(a => a.table === t).length})`,
  }))]

  const STATUS_LABELS: Record<string, string> = {
    pending_verification: 'À vérifier', info_required: 'Complément requis', pending: 'En attente',
  }
  const STATUS_CLASSES: Record<string, string> = {
    pending_verification: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
    info_required: 'bg-orange-50 text-orange-600',
    pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Validation des comptes</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 21.4 — inscriptions, justificatifs, décisions historisées</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?table=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterTable ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
            {t.label}
          </a>
        ))}
      </div>

      {allActors.length === 0 ? (
        <div className="sw-card p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-[var(--sw-success)] mx-auto mb-3" />
          <p className="text-sm text-[var(--sw-ink-2)]">Aucun compte en attente de validation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allActors.map(actor => (
            <div key={actor.id} className="sw-card overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[var(--sw-line)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
                    {ACTOR_META[actor.table]?.icon ?? <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASSES[actor.status ?? ''] ?? ''}`}>
                        {STATUS_LABELS[actor.status ?? ''] ?? actor.status}
                      </span>
                      <span className="text-xs text-[var(--sw-ink-3)]">{actor.actor_type}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--sw-ink)] mt-0.5">{actor.name ?? 'Sans nom'}</p>
                    {actor.email && <p className="text-xs text-[var(--sw-ink-3)]">{actor.email}</p>}
                    <p className="text-xs text-[var(--sw-ink-3)]">
                      Inscrit le {new Date(actor.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions spec 21.4 */}
              <div className="px-4 py-3 bg-[var(--sw-surface-2)] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <form action={validateActor}>
                    <input type="hidden" name="actor_id" value={actor.id} />
                    <input type="hidden" name="table" value={actor.table} />
                    <input type="hidden" name="action" value="approve" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-success)] text-white text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                    </button>
                  </form>
                  <form action={validateActor}>
                    <input type="hidden" name="actor_id" value={actor.id} />
                    <input type="hidden" name="table" value={actor.table} />
                    <input type="hidden" name="action" value="refuse" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-[var(--sw-danger)] text-xs font-medium border border-[var(--sw-danger)]">
                      <XCircle className="w-3.5 h-3.5" /> Refuser
                    </button>
                  </form>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <form action={validateActor}>
                    <input type="hidden" name="actor_id" value={actor.id} />
                    <input type="hidden" name="table" value={actor.table} />
                    <input type="hidden" name="action" value="info_required" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-medium border border-orange-200">
                      <MessageSquare className="w-3.5 h-3.5" /> Complément
                    </button>
                  </form>
                  <form action={validateActor}>
                    <input type="hidden" name="actor_id" value={actor.id} />
                    <input type="hidden" name="table" value={actor.table} />
                    <input type="hidden" name="action" value="suspend" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] text-xs font-medium border border-[var(--sw-line)]">
                      Suspendre
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
