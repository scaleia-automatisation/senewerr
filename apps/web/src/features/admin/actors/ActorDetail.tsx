import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useJustification } from '@/features/admin/JustificationSheet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusPill } from '@/components/ui/StatusPill'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-s-4 flex flex-col gap-s-3">
      <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">{title}</h2>
      {children}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-s-3 text-sm">
      <span className="text-ink-3 min-w-[140px] shrink-0">{label}</span>
      <span className="text-ink text-right flex-1">{value ?? '—'}</span>
    </div>
  )
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function RefuseModal({
  open, onOpenChange, onConfirm, loading,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (motif: string) => void; loading?: boolean }) {
  const [motif, setMotif] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Refuser — motif obligatoire">
      <div className="flex flex-col gap-s-4">
        <Textarea
          label="Motif (min. 20 caractères)"
          value={motif}
          onChange={e => setMotif(e.target.value)}
          placeholder="Expliquez la raison du refus…"
          rows={4}
        />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="danger" disabled={motif.trim().length < 20 || loading} loading={loading} onClick={() => onConfirm(motif)}>
            Refuser
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SuspendModal({
  open, onOpenChange, onConfirm, loading,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (motif: string) => void; loading?: boolean }) {
  const [motif, setMotif] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Suspendre le compte">
      <div className="flex flex-col gap-s-4">
        <Banner kind="warning">
          La suspension empêche immédiatement l'accès. Les RDV et commandes actifs ne seront pas automatiquement annulés.
        </Banner>
        <Textarea
          label="Motif de suspension"
          value={motif}
          onChange={e => setMotif(e.target.value)}
          placeholder="Motif de suspension…"
          rows={4}
        />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="danger" disabled={!motif.trim() || loading} loading={loading} onClick={() => onConfirm(motif)}>
            Suspendre
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const DOC_TYPES = [
  { value: 'id_card', label: "Carte d'identité" },
  { value: 'diploma', label: 'Diplôme' },
  { value: 'license', label: "Licence / Autorisation d'exercer" },
  { value: 'proof_address', label: 'Justificatif de domicile' },
  { value: 'insurance_cert', label: "Attestation d'assurance" },
  { value: 'other', label: 'Autre' },
]

function DocRequestModal({
  open, onOpenChange, onConfirm, loading,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (docs: string[], message: string) => void; loading?: boolean }) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const toggle = (v: string) => setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Demander des documents">
      <div className="flex flex-col gap-s-4">
        <div className="grid grid-cols-2 gap-s-2">
          {DOC_TYPES.map(d => (
            <label key={d.value} className="flex items-center gap-s-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={selected.includes(d.value)} onChange={() => toggle(d.value)} className="rounded border-line" />
              {d.label}
            </label>
          ))}
        </div>
        <Textarea label="Message (optionnel)" value={message} onChange={e => setMessage(e.target.value)} placeholder="Instructions…" rows={3} />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="primary" disabled={selected.length === 0 || loading} loading={loading} onClick={() => onConfirm(selected, message)}>
            Envoyer la demande
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function AnonymizeModal({
  open, onOpenChange, onConfirm, loading,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void; loading?: boolean }) {
  const [confirm, setConfirm] = useState('')
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Anonymiser le patient" size="sm">
      <div className="flex flex-col gap-s-4">
        <Banner kind="warning">
          Cette action est <strong>irréversible</strong>. Toutes les données identifiantes seront supprimées définitivement.
        </Banner>
        <p className="text-sm text-ink-2">Tapez <strong>ANONYMISER</strong> pour confirmer :</p>
        <input
          className="h-10 w-full rounded-sm border border-line bg-surface px-s-3 text-sm focus:outline-none focus:border-primary"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="ANONYMISER"
        />
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="danger" disabled={confirm !== 'ANONYMISER' || loading} loading={loading} onClick={onConfirm}>
            Anonymiser définitivement
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusPillInline({ status }: { status?: string }) {
  if (!status) return <span className="text-ink-3">—</span>
  const map: Record<string, { pill: 'success' | 'pending' | 'danger' | 'neutral'; label: string }> = {
    active:    { pill: 'success', label: 'Actif' },
    inactive:  { pill: 'neutral', label: 'Inactif' },
    suspended: { pill: 'danger', label: 'Suspendu' },
    to_verify: { pill: 'pending', label: 'À vérifier' },
    pending:   { pill: 'pending', label: 'En attente' },
  }
  const m = map[status] ?? { pill: 'neutral' as const, label: status }
  return <StatusPill status={m.pill} label={m.label} />
}

function verifVariant(status?: string): 'pending' | 'success' | 'danger' | 'neutral' {
  if (status === 'verified') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'pending') return 'pending'
  return 'neutral'
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type ActorType = 'patient' | 'professional' | 'establishment' | 'pharmacy' | 'mutual'

export default function ActorDetail() {
  const { type, id } = useParams<{ type: ActorType; id: string }>()
  const { profile: adminProfile } = useAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'

  useAdminAudit('acteur-detail')

  // Two separate justification hooks for distinct health data access
  const docJustif = useJustification({
    entityType: 'verification_document',
    entityId: id ?? '',
    action: 'view.verification.document',
  })
  const dossierJustif = useJustification({
    entityType: 'patient_dossier',
    entityId: id ?? '',
    action: 'view.patient.dossier',
  })

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [verifications, setVerifications] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [refuseOpen, setRefuseOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [docReqOpen, setDocReqOpen] = useState(false)
  const [anonymizeOpen, setAnonymizeOpen] = useState(false)

  const [dossier, setDossier] = useState<{ rdvs: any[]; bookings: any[]; pays: any[] } | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)

  const loadMain = useCallback(async () => {
    if (!id || !type) return
    setLoading(true)
    const isOrg = ['establishment', 'pharmacy', 'mutual'].includes(type)

    if (isOrg) {
      const { data: org } = await (supabase as any).from('organizations').select('*').eq('id', id).single()
      setData(org)
    } else if (type === 'professional') {
      const { data: pro } = await (supabase as any).from('professionals').select('*, profiles(*)').eq('id', id).single()
      setData(pro)
    } else {
      const { data: p } = await (supabase as any).from('profiles').select('*, patients(*)').eq('id', id).single()
      setData(p)
    }

    const [paysRes, verifsRes, notesRes, logsRes] = await Promise.all([
      (supabase as any).from('payments').select('id, amount, status, created_at, reference').eq('payer_id', id).order('created_at', { ascending: false }).limit(10),
      (supabase as any).from('verification_requests').select('id, status, document_type, document_url, reviewer_id, reviewed_at, created_at').eq('actor_id', id).order('created_at', { ascending: false }).limit(10),
      (supabase as any).from('admin_notes').select('id, content, created_at, author_id').eq('entity_id', id).order('created_at', { ascending: false }),
      (supabase as any).from('audit_logs').select('id, action, entity_type, created_at').eq('actor_id', id).order('created_at', { ascending: false }).limit(10),
    ])

    setPayments(paysRes.data ?? [])
    setVerifications(verifsRes.data ?? [])
    setNotes(notesRes.data ?? [])
    setAuditLogs(logsRes.data ?? [])
    setLoading(false)
  }, [id, type])

  useEffect(() => { loadMain() }, [loadMain])

  const callEdgeFunction = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setActionLoading(true)
    setActionError(null)
    const { error } = await supabase.functions.invoke('admin-action', {
      body: { action, targetId: id, targetType: type, ...extra },
    })
    if (error) setActionError(error.message)
    else await loadMain()
    setActionLoading(false)
    return !error
  }, [id, type, loadMain])

  const addNote = useCallback(async () => {
    if (!newNote.trim()) return
    setNoteLoading(true)
    await (supabase as any).from('admin_notes').insert({
      entity_id: id,
      entity_type: type,
      content: newNote.trim(),
      author_id: adminProfile?.id,
    })
    setNewNote('')
    await loadMain()
    setNoteLoading(false)
  }, [newNote, id, type, adminProfile?.id, loadMain])

  const viewDocument = useCallback(async (url: string) => {
    const cause = await docJustif.requestJustification()
    if (!cause) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [docJustif])

  const viewDossier = useCallback(async () => {
    const cause = await dossierJustif.requestJustification()
    if (!cause) return
    setDossierLoading(true)
    const [rdvs, bookings, pays] = await Promise.all([
      (supabase as any).from('appointments').select('id, scheduled_at, status').eq('patient_id', id).order('scheduled_at', { ascending: false }).limit(10),
      (supabase as any).from('pharmacy_reservations').select('id, created_at, status, reference').eq('patient_id', id).order('created_at', { ascending: false }).limit(10),
      (supabase as any).from('payments').select('id, amount, status, created_at, reference').eq('payer_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setDossier({ rdvs: rdvs.data ?? [], bookings: bookings.data ?? [], pays: pays.data ?? [] })
    setDossierLoading(false)
  }, [id, dossierJustif])

  if (loading) {
    return (
      <div className="p-s-4 flex flex-col gap-s-4 max-w-4xl mx-auto">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)}
      </div>
    )
  }

  const profile = type === 'patient' ? data : type === 'professional' ? data?.profiles : data
  const isPatient = type === 'patient'
  const isPro = type === 'professional'
  const status: string | undefined = profile?.status ?? data?.status

  const canValidate = !status || ['pending', 'to_verify'].includes(status)
  const canSuspend = status === 'active'
  const canReactivate = status === 'suspended' || status === 'inactive'

  return (
    <div className="flex flex-col gap-s-4 p-s-4 max-w-4xl mx-auto">
      {/* Justification modals — must be in JSX tree */}
      {docJustif.JustificationSheetNode}
      {dossierJustif.JustificationSheetNode}

      <div className="flex items-center gap-s-3">
        <Link to="/admin/acteurs">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>Acteurs</Button>
        </Link>
        <h1 className="text-h2 font-display text-ink flex-1 truncate">
          {profile?.full_name ?? data?.name ?? 'Acteur'}
        </h1>
      </div>

      {actionError && <Banner kind="warning">{actionError}</Banner>}

      {/* Action buttons */}
      <Card className="p-s-4">
        <div className="flex flex-wrap gap-s-2">
          <Button variant="primary" size="sm" disabled={!canValidate || actionLoading} loading={actionLoading} onClick={() => callEdgeFunction('validate')}>
            Valider
          </Button>
          <Button variant="danger" size="sm" disabled={actionLoading} onClick={() => setRefuseOpen(true)}>
            Refuser
          </Button>
          <Button variant="secondary" size="sm" disabled={actionLoading} onClick={() => setDocReqOpen(true)}>
            Demander un document
          </Button>
          <Button variant="danger" size="sm" disabled={!canSuspend || actionLoading} onClick={() => setSuspendOpen(true)}>
            Suspendre
          </Button>
          <Button variant="accent" size="sm" disabled={!canReactivate || actionLoading} loading={actionLoading} onClick={() => callEdgeFunction('reactivate')}>
            Réactiver
          </Button>
          {isPatient && (
            <>
              <Button variant="secondary" size="sm" disabled={dossierLoading} onClick={viewDossier}>
                {dossierLoading ? 'Chargement…' : 'Voir le dossier'}
              </Button>
              <Button variant="secondary" size="sm" disabled={actionLoading} loading={actionLoading} onClick={() => callEdgeFunction('reset_password')}>
                Réinitialiser le mot de passe
              </Button>
              {isSuperAdmin && (
                <Button variant="danger" size="sm" onClick={() => setAnonymizeOpen(true)}>
                  Anonymiser
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Section 1 — Identité */}
      <Section title="Identité">
        <Row label="Nom" value={profile?.full_name ?? data?.name} />
        <Row label="Email" value={profile?.email} />
        <Row label="Téléphone" value={profile?.phone} />
        <Row label="Inscription" value={fmt(profile?.created_at ?? data?.created_at)} />
        <Row label="Dernière connexion" value={fmt(profile?.last_sign_in_at)} />
        <Row label="Rôle" value={<span className="capitalize">{profile?.role ?? type}</span>} />
        <Row label="Statut" value={<StatusPillInline status={status} />} />
        {isPro && (
          <>
            <Row label="Spécialité" value={data?.specialty} />
            <Row label="Vérification" value={
              <Badge variant={verifVariant(data?.verification_status)}>{data?.verification_status ?? '—'}</Badge>
            } />
          </>
        )}
      </Section>

      {/* Section 2 — Organisation */}
      {(['establishment', 'pharmacy', 'mutual'].includes(type ?? '') || isPro) && data && (
        <Section title="Organisation">
          {['establishment', 'pharmacy', 'mutual'].includes(type ?? '') ? (
            <>
              <Row label="Nom" value={data.name} />
              <Row label="Type" value={data.type} />
              <Row label="Ville" value={data.city} />
            </>
          ) : (
            <>
              <Row label="Ville" value={data.city} />
              <Row label="Établissement" value={data.organization_name} />
            </>
          )}
        </Section>
      )}

      {/* Section 3 — Plan & usage */}
      <Section title="Plan & usage">
        {isPatient ? (
          <>
            <Row label="Plan" value={data?.patients?.[0]?.plan ?? '—'} />
            <Row label="Crédits IA utilisés" value={data?.patients?.[0]?.ai_credits_used ?? '—'} />
            <Row label="Crédits IA total" value={data?.patients?.[0]?.ai_credits_total ?? '—'} />
            <Row label="Prochaine facture" value={fmtDate(data?.patients?.[0]?.next_billing_date)} />
          </>
        ) : (
          <>
            <Row label="Plan" value={data?.plan ?? '—'} />
            <Row label="Prochaine facture" value={fmtDate(data?.next_billing_date)} />
          </>
        )}
      </Section>

      {/* Section 4 — Historique paiements */}
      <Section title="Historique paiements">
        {payments.length === 0 ? (
          <p className="text-sm text-ink-3">Aucun paiement</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                  <th className="text-left py-s-2 pr-s-3">Référence</th>
                  <th className="text-right py-s-2 pr-s-3">Montant</th>
                  <th className="text-left py-s-2 pr-s-3">Statut</th>
                  <th className="text-left py-s-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-s-2 pr-s-3 font-mono text-xs">{p.reference ?? p.id}</td>
                    <td className="py-s-2 pr-s-3 text-right">{p.amount?.toLocaleString('fr-FR')} FCFA</td>
                    <td className="py-s-2 pr-s-3">
                      <Badge variant={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'pending'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-s-2 text-ink-3">{fmt(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Section 5 — Vérification */}
      <Section title="Vérification">
        {verifications.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune demande de vérification</p>
        ) : (
          <div className="flex flex-col gap-s-3">
            {verifications.map(v => (
              <div key={v.id} className="border border-line rounded-md p-s-3 flex items-start justify-between gap-s-3">
                <div className="flex flex-col gap-s-1 text-sm">
                  <span className="font-medium text-ink">{v.document_type ?? 'Document'}</span>
                  <Badge variant={verifVariant(v.status)}>{v.status}</Badge>
                  {v.reviewed_at && <span className="text-ink-3">Révisé le {fmtDate(v.reviewed_at)}</span>}
                </div>
                {v.document_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<FileText className="h-4 w-4" />}
                    onClick={() => viewDocument(v.document_url)}
                  >
                    Voir
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Section 6 — Notes internes */}
      <Section title="Notes internes">
        {notes.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune note</p>
        ) : (
          <div className="flex flex-col gap-s-2">
            {notes.map(n => (
              <div key={n.id} className="border border-line rounded-md p-s-3 text-sm">
                <p className="text-ink">{n.content}</p>
                <p className="text-ink-3 text-xs mt-s-1">{fmt(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-s-2 mt-s-2">
          <Textarea label="Ajouter une note" placeholder="Note interne…" value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} />
          <Button variant="secondary" size="sm" disabled={!newNote.trim() || noteLoading} loading={noteLoading} onClick={addNote} className="self-end">
            Ajouter
          </Button>
        </div>
      </Section>

      {/* Section 7 — Audit de l'acteur */}
      <Section title="Audit de l'acteur (10 dernières entrées)">
        {auditLogs.length === 0 ? (
          <p className="text-sm text-ink-3">Aucune entrée d'audit</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-ink-3 uppercase tracking-wide">
                  <th className="text-left py-s-2 pr-s-3">Action</th>
                  <th className="text-left py-s-2 pr-s-3">Entité</th>
                  <th className="text-left py-s-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(l => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-s-2 pr-s-3 font-mono text-xs">{l.action}</td>
                    <td className="py-s-2 pr-s-3 text-ink-2">{l.entity_type ?? '—'}</td>
                    <td className="py-s-2 text-ink-3">{fmt(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Patient dossier (visible after justification) */}
      {dossier && (
        <Card className="p-s-4 flex flex-col gap-s-4">
          <div className="flex items-center gap-s-2">
            <AlertTriangle className="h-4 w-4 text-status-pending" />
            <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide">Dossier patient</h2>
          </div>

          <div>
            <p className="text-xs text-ink-3 uppercase tracking-wide mb-s-2">RDV récents</p>
            {dossier.rdvs.length === 0
              ? <p className="text-sm text-ink-3">Aucun RDV</p>
              : dossier.rdvs.map(r => (
                  <div key={r.id} className="text-sm border-b border-line py-s-2 flex justify-between">
                    <span>{fmt(r.scheduled_at)}</span>
                    <Badge variant="neutral">{r.status}</Badge>
                  </div>
                ))
            }
          </div>

          <div>
            <p className="text-xs text-ink-3 uppercase tracking-wide mb-s-2">Réservations pharmacie</p>
            {dossier.bookings.length === 0
              ? <p className="text-sm text-ink-3">Aucune réservation</p>
              : dossier.bookings.map(r => (
                  <div key={r.id} className="text-sm border-b border-line py-s-2 flex justify-between">
                    <span className="font-mono text-xs">{r.reference ?? r.id}</span>
                    <Badge variant="neutral">{r.status}</Badge>
                  </div>
                ))
            }
          </div>

          <div>
            <p className="text-xs text-ink-3 uppercase tracking-wide mb-s-2">Paiements</p>
            {dossier.pays.length === 0
              ? <p className="text-sm text-ink-3">Aucun paiement</p>
              : dossier.pays.map(p => (
                  <div key={p.id} className="text-sm border-b border-line py-s-2 flex justify-between gap-s-3">
                    <span className="font-mono text-xs">{p.reference ?? p.id}</span>
                    <span>{p.amount?.toLocaleString('fr-FR')} FCFA</span>
                    <Badge variant={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'pending'}>
                      {p.status}
                    </Badge>
                  </div>
                ))
            }
          </div>
        </Card>
      )}

      {/* Action modals */}
      <RefuseModal
        open={refuseOpen}
        onOpenChange={setRefuseOpen}
        loading={actionLoading}
        onConfirm={async motif => { const ok = await callEdgeFunction('refuse', { motif }); if (ok) setRefuseOpen(false) }}
      />
      <SuspendModal
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        loading={actionLoading}
        onConfirm={async motif => { const ok = await callEdgeFunction('suspend', { motif }); if (ok) setSuspendOpen(false) }}
      />
      <DocRequestModal
        open={docReqOpen}
        onOpenChange={setDocReqOpen}
        loading={actionLoading}
        onConfirm={async (docs, message) => { const ok = await callEdgeFunction('request_documents', { documentTypes: docs, message }); if (ok) setDocReqOpen(false) }}
      />
      {isSuperAdmin && (
        <AnonymizeModal
          open={anonymizeOpen}
          onOpenChange={setAnonymizeOpen}
          loading={actionLoading}
          onConfirm={async () => { const ok = await callEdgeFunction('anonymize'); if (ok) setAnonymizeOpen(false) }}
        />
      )}
    </div>
  )
}
