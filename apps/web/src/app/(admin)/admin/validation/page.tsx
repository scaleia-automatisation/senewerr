import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { CheckCircle2, XCircle, MessageSquare, User, Stethoscope, Building2, Package, Shield } from 'lucide-react'
import { sendNotificationAction } from '@/app/actions/notifications'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Validation des comptes — Admin' }

const ACTOR_META: Record<string, { label: string; icon: React.ReactNode }> = {
  sante:      { label: 'Professionnel de santé', icon: <Stethoscope className="w-4 h-4 text-purple-600" /> },
  pharmacie:  { label: 'Pharmacie',              icon: <Package   className="w-4 h-4 text-orange-600" /> },
  couverture: { label: 'Organisme de couverture',icon: <Shield    className="w-4 h-4 text-[var(--sw-success)]" /> },
}

async function validateActor(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const profileId = formData.get('profile_id') as string
  const actorType = formData.get('actor_type') as string
  const action    = formData.get('action') as 'approve' | 'refuse' | 'info_required' | 'suspend'
  const motif     = formData.get('motif') as string | null

  const newStatus = action === 'approve'        ? 'verified'
    : action === 'refuse'       ? 'refused'
    : action === 'suspend'      ? 'suspended'
    : 'needs_info'

  await supabase.from('profiles')
    .update({
      account_status: newStatus,
      ...(motif ? { verification_notes: motif } : {}),
    })
    .eq('id', profileId)

  if (action === 'approve' || action === 'refuse' || action === 'info_required') {
    const notifType = action === 'approve' ? 'account_validated'
      : action === 'refuse' ? 'account_refused'
      : 'account_needs_info'
    const notifBody = action === 'approve'
      ? 'Votre compte a été validé. Vous pouvez maintenant utiliser votre espace.'
      : action === 'refuse'
      ? `Votre compte n'a pas été validé.${motif ? ` Motif : ${motif}` : ''}`
      : `Complément d'information requis.${motif ? ` ${motif}` : ''}`
    sendNotificationAction({
      recipient_id: profileId,
      type: notifType,
      body: notifBody,
      reference_type: 'account',
      reference_id: profileId,
    }).catch(() => {})
  }

  type InsertEventFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertEventFn).insert({
    event_type: `account.${action}`,
    actor_type: 'admin',
    object_type: actorType,
    object_id: profileId,
    result: 'success',
    category: 'compte',
    metadata: { motif, new_status: newStatus },
  })

  revalidatePath('/admin/validation')
  revalidatePath('/sante/accueil')
  revalidatePath('/sante/onboarding')
  revalidatePath('/pharmacie/accueil')
  revalidatePath('/couverture/accueil')
}

export default async function AdminValidationPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: filterType } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type, account_status').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string; account_status: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  type ProfileRow = {
    id: string; actor_type: string; full_name: string | null
    email: string | null; account_status: string | null; verification_notes: string | null; created_at: string
  }

  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('id, actor_type, full_name, email, account_status, verification_notes, created_at')
    .in('account_status', ['pending', 'needs_info', 'draft'])
    .in('actor_type', ['sante', 'pharmacie', 'couverture'])
    .order('created_at', { ascending: true })

  const allActors = ((rawProfiles ?? []) as unknown as ProfileRow[])
    .filter(a => !filterType || a.actor_type === filterType)

  const TABS = [
    { key: '',          label: `Tous (${(rawProfiles ?? []).length})` },
    ...Object.entries(ACTOR_META).map(([key, meta]) => ({
      key,
      label: `${meta.label} (${(rawProfiles ?? []).filter((a: unknown) => (a as ProfileRow).actor_type === key).length})`,
    })),
  ]

  const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente', needs_info: 'Complément requis', draft: 'Brouillon',
  }
  const STATUS_CLASSES: Record<string, string> = {
    pending: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
    needs_info: 'bg-orange-50 text-orange-600',
    draft: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--sw-ink)]">Validation des comptes</h1>
        <p className="text-xs text-[var(--sw-ink-2)]">Spec 21.4 — inscriptions, justificatifs, décisions historisées</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {TABS.map(t => (
          <a key={t.key} href={t.key ? `?type=${t.key}` : '?'}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${(t.key === (filterType ?? '')) ? 'bg-[var(--sw-primary)] text-white' : 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-2)]'}`}>
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
                    {ACTOR_META[actor.actor_type]?.icon ?? <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CLASSES[actor.account_status ?? ''] ?? ''}`}>
                        {STATUS_LABELS[actor.account_status ?? ''] ?? actor.account_status}
                      </span>
                      <span className="text-xs text-[var(--sw-ink-3)]">{ACTOR_META[actor.actor_type]?.label ?? actor.actor_type}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--sw-ink)] mt-0.5">{actor.full_name ?? 'Sans nom'}</p>
                    {actor.email && <p className="text-xs text-[var(--sw-ink-3)]">{actor.email}</p>}
                    {actor.verification_notes && (
                      <p className="text-xs text-orange-600 mt-0.5">Note : {actor.verification_notes}</p>
                    )}
                    <p className="text-xs text-[var(--sw-ink-3)]">
                      Inscrit le {new Date(actor.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-[var(--sw-surface-2)] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <form action={validateActor}>
                    <input type="hidden" name="profile_id" value={actor.id} />
                    <input type="hidden" name="actor_type" value={actor.actor_type} />
                    <input type="hidden" name="action" value="approve" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--sw-success)] text-white text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                    </button>
                  </form>
                  <form action={validateActor}>
                    <input type="hidden" name="profile_id" value={actor.id} />
                    <input type="hidden" name="actor_type" value={actor.actor_type} />
                    <input type="hidden" name="action" value="refuse" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-[var(--sw-danger)] text-xs font-medium border border-[var(--sw-danger)]">
                      <XCircle className="w-3.5 h-3.5" /> Refuser
                    </button>
                  </form>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <form action={validateActor}>
                    <input type="hidden" name="profile_id" value={actor.id} />
                    <input type="hidden" name="actor_type" value={actor.actor_type} />
                    <input type="hidden" name="action" value="info_required" />
                    <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-medium border border-orange-200">
                      <MessageSquare className="w-3.5 h-3.5" /> Complément
                    </button>
                  </form>
                  <form action={validateActor}>
                    <input type="hidden" name="profile_id" value={actor.id} />
                    <input type="hidden" name="actor_type" value={actor.actor_type} />
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
