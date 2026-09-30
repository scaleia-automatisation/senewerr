'use server'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AlertTriangle, User, Package, Building2, Shield, MessageSquare, CheckCircle2, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Détail litige — Admin' }

// Spec 21.6 — dossier litige complet : référence, acteur, motif, pièces, échanges, statut, résolution, historique
type LitigeDetail = {
  id: string; reference: string | null; actor_type: string; declarant_id: string | null
  declarant_name: string | null; motif: string | null; description: string | null
  status: string; resolution: string | null; created_at: string; updated_at: string | null
  operation_reference: string | null; operation_type: string | null
}
type LitigeMessage = {
  id: string; author_type: string; author_name: string | null; content: string; created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', en_cours: 'En cours', en_attente: "En attente d'information",
  resolu: 'Résolu', cloture: 'Clôturé',
}
const STATUS_CLASSES: Record<string, string> = {
  nouveau: 'bg-red-50 text-[var(--sw-danger)]',
  en_cours: 'bg-blue-50 text-blue-600',
  en_attente: 'bg-[var(--sw-warning-bg)] text-[var(--sw-warning)]',
  resolu: 'bg-[var(--sw-success-bg)] text-[var(--sw-success)]',
  cloture: 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)]',
}
const ACTOR_LABELS: Record<string, string> = {
  patient: 'Patient', pharmacie: 'Pharmacie', etablissement: 'Établissement', couverture: 'Organisme',
}
const ACTOR_ICON: Record<string, React.ReactNode> = {
  patient: <User className="w-4 h-4 text-[var(--sw-primary)]" />,
  pharmacie: <Package className="w-4 h-4 text-orange-600" />,
  etablissement: <Building2 className="w-4 h-4 text-blue-600" />,
  couverture: <Shield className="w-4 h-4 text-[var(--sw-success)]" />,
}

// Spec 21.6 — actions admin : changer le statut, ajouter un échange, enregistrer la résolution
async function updateLitigeStatus(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const id = formData.get('litige_id') as string
  const newStatus = formData.get('new_status') as string
  const resolution = formData.get('resolution') as string | null

  type UpdateFn = { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }
  await (supabase.from('litiges') as unknown as UpdateFn)
    .update({ status: newStatus, ...(resolution ? { resolution } : {}), updated_at: new Date().toISOString() })
    .eq('id', id)

  type InsertEventFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('system_events') as unknown as InsertEventFn).insert({
    event_type: 'litige.status_changed',
    actor_type: 'admin',
    object_type: 'litige',
    object_id: id,
    result: 'success',
    category: 'admin',
    metadata: { new_status: newStatus, resolution },
  })

  revalidatePath(`/admin/litiges/${id}`)
}

async function addLitigeMessage(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const litigeId = formData.get('litige_id') as string
  const content = formData.get('content') as string
  if (!content.trim()) return

  type InsertFn = { insert: (v: unknown) => Promise<{ error: unknown }> }
  await (supabase.from('litige_messages') as unknown as InsertFn)
    .insert({ litige_id: litigeId, author_type: 'admin', author_name: 'Administrateur', content: content.trim() })

  revalidatePath(`/admin/litiges/${litigeId}`)
}

export default async function AdminLitigeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: profileData } = await supabase.from('profiles').select('actor_type').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { actor_type: string } | null
  if (!profile || (profile.actor_type !== 'admin' && profile.actor_type !== 'super_admin')) redirect('/connexion')

  type FetchFn = { select: (q: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: unknown; error: unknown }> } } }
  type MsgFn = { select: (q: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null }> } } }

  const [litigeRes, messagesRes] = await Promise.all([
    (supabase.from('litiges') as unknown as FetchFn)
      .select('id, reference, actor_type, declarant_id, declarant_name, motif, description, status, resolution, created_at, updated_at, operation_reference, operation_type')
      .eq('id', id)
      .single(),
    (supabase.from('litige_messages') as unknown as MsgFn)
      .select('id, author_type, author_name, content, created_at')
      .eq('litige_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!litigeRes.data) notFound()
  const litige = litigeRes.data as unknown as LitigeDetail
  const messages = (messagesRes.data ?? []) as unknown as LitigeMessage[]

  const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
    nouveau: [{ value: 'en_cours', label: 'Prendre en charge' }, { value: 'cloture', label: 'Clôturer' }],
    en_cours: [{ value: 'en_attente', label: "Demander des informations" }, { value: 'resolu', label: 'Marquer résolu' }, { value: 'cloture', label: 'Clôturer' }],
    en_attente: [{ value: 'en_cours', label: 'Reprendre le traitement' }, { value: 'resolu', label: 'Marquer résolu' }],
    resolu: [{ value: 'cloture', label: 'Clôturer' }],
    cloture: [],
  }
  const nextActions = NEXT_STATUSES[litige.status] ?? []

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--sw-surface-2)] flex items-center justify-center shrink-0">
          {ACTOR_ICON[litige.actor_type] ?? <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CLASSES[litige.status] ?? ''}`}>
              {STATUS_LABELS[litige.status] ?? litige.status}
            </span>
            <span className="text-xs text-[var(--sw-ink-3)]">{ACTOR_LABELS[litige.actor_type] ?? litige.actor_type}</span>
            {litige.reference && (
              <span className="text-xs font-mono text-[var(--sw-ink-3)]">#{litige.reference}</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-[var(--sw-ink)] mt-0.5">{litige.declarant_name ?? 'Déclarant'}</h1>
          <p className="text-xs text-[var(--sw-ink-3)]">
            Ouvert le {new Date(litige.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Détails du litige (spec 21.6) */}
      <div className="sw-card p-4 space-y-3">
        {litige.operation_reference && (
          <div>
            <p className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">Opération concernée</p>
            <p className="text-sm text-[var(--sw-ink)] mt-0.5">
              {litige.operation_type ?? 'Opération'} — <span className="font-mono">{litige.operation_reference}</span>
            </p>
          </div>
        )}
        {litige.motif && (
          <div>
            <p className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">Motif</p>
            <p className="text-sm text-[var(--sw-ink)] mt-0.5">{litige.motif}</p>
          </div>
        )}
        {litige.description && (
          <div>
            <p className="text-xs font-semibold text-[var(--sw-ink-3)] uppercase tracking-wide">Description</p>
            <p className="text-sm text-[var(--sw-ink)] mt-0.5 whitespace-pre-wrap">{litige.description}</p>
          </div>
        )}
        {litige.resolution && (
          <div className="p-3 rounded-xl bg-[var(--sw-success-bg)]">
            <p className="text-xs font-semibold text-[var(--sw-success)] uppercase tracking-wide">Résolution</p>
            <p className="text-sm text-[var(--sw-ink)] mt-0.5">{litige.resolution}</p>
          </div>
        )}
      </div>

      {/* Échanges (spec 21.6) */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Échanges
        </h2>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-xs text-[var(--sw-ink-3)] px-1">Aucun échange pour le moment.</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`p-3 rounded-xl text-sm ${m.author_type === 'admin' ? 'bg-[var(--sw-primary-subtle)] ml-6' : 'bg-[var(--sw-surface-2)] mr-6'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[var(--sw-ink)]">{m.author_name ?? m.author_type}</span>
                  <span className="text-xs text-[var(--sw-ink-3)]">
                    {new Date(m.created_at).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[var(--sw-ink)] whitespace-pre-wrap">{m.content}</p>
              </div>
            ))
          )}
        </div>

        {/* Ajouter un message */}
        <form action={addLitigeMessage} className="mt-3 space-y-2">
          <input type="hidden" name="litige_id" value={id} />
          <textarea name="content" rows={3} placeholder="Ajouter un échange ou une demande d'information…"
            className="sw-input w-full resize-none text-sm" required />
          <button className="px-4 py-2 rounded-xl bg-[var(--sw-primary)] text-white text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Envoyer
          </button>
        </form>
      </div>

      {/* Actions de statut (spec 21.6) */}
      {nextActions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--sw-ink)] mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Changer le statut
          </h2>
          <div className="space-y-2">
            {nextActions.map(action => (
              <form key={action.value} action={updateLitigeStatus} className="space-y-1.5">
                <input type="hidden" name="litige_id" value={id} />
                <input type="hidden" name="new_status" value={action.value} />
                {action.value === 'resolu' && (
                  <textarea name="resolution" rows={2} placeholder="Décrire la résolution…"
                    className="sw-input w-full resize-none text-sm" />
                )}
                <button className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${action.value === 'resolu' ? 'bg-[var(--sw-success)] text-white' : action.value === 'cloture' ? 'bg-[var(--sw-surface-2)] text-[var(--sw-ink-3)] border border-[var(--sw-line)]' : 'bg-[var(--sw-primary)] text-white'}`}>
                  {action.value === 'resolu' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {action.label}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
