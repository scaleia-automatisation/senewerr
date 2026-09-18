import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

type Template = {
  id: string
  event_type: string
  recipient_role: string
  channel: string
  locale: string
  enabled: boolean
  message_template: string
  subject?: string
}

const SAMPLE_VARS: Record<string, string> = {
  '{patient_name}': 'Amadou Diallo',
  '{amount}': '5 000 XOF',
  '{date}': '20/06/2026',
  '{time}': '14h30',
  '{professional_name}': 'Dr. Fatou Sow',
  '{pharmacy_name}': 'Pharmacie Centrale',
  '{code}': 'CODE-XYZ',
  '{link}': 'https://sene-werr.sn/rdv/123',
}

function renderPreview(template: string): string {
  let result = template
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    result = result.replaceAll(k, v)
  }
  return result
}

export default function NotificationTemplatesAdminPage() {
  useAdminAudit('super-admin-notif-templates')
  const { readOnly } = useSuperAdminContext()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<{ open: boolean; tpl: Template | null }>({ open: false, tpl: null })
  const [previewModal, setPreviewModal] = useState<{ open: boolean; tpl: Template | null }>({ open: false, tpl: null })
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Partial<Template>>({})

  async function load() {
    setLoading(true)
    const { data } = await (supabase as any)
      .from('notification_templates')
      .select('*')
      .order('event_type')
    setTemplates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const g: Record<string, Template[]> = {}
    for (const t of templates) {
      if (!g[t.event_type]) g[t.event_type] = []
      g[t.event_type].push(t)
    }
    return g
  }, [templates])

  function openEdit(tpl: Template) {
    setDraft({ ...tpl })
    setEditModal({ open: true, tpl })
  }

  async function toggleEnabled(tpl: Template) {
    await (supabase as any).from('notification_templates').update({ enabled: !tpl.enabled }).eq('id', tpl.id)
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, enabled: !t.enabled } : t))
  }

  async function save() {
    if (!draft.id) return
    setSaving(true)
    try {
      await (supabase as any).from('notification_templates').update({
        message_template: draft.message_template,
        subject: draft.subject,
        enabled: draft.enabled,
      }).eq('id', draft.id)
      setSuccess('Template mis à jour.')
      setTimeout(() => setSuccess(null), 3000)
      setEditModal({ open: false, tpl: null })
      load()
    } catch (e: unknown) { setError((e as Error).message) }
    setSaving(false)
  }

  if (loading) return <div className="space-y-s-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>

  return (
    <div className="space-y-s-5">
      <div>
        <h1 className="text-h2 font-bold text-ink">Templates de notification</h1>
        <p className="text-small text-ink-3">Gestion des messages de notification par événement.</p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      {Object.entries(grouped).map(([event, tpls]) => (
        <Card key={event}>
          <h2 className="text-body font-semibold text-ink mb-s-3 font-mono">{event}</h2>
          <div className="space-y-s-2">
            {tpls.map(tpl => (
              <div key={tpl.id} className="flex items-center justify-between gap-s-3 rounded-md border border-line p-s-3 bg-surface-2">
                <div className="flex items-center gap-s-2 min-w-0 flex-wrap">
                  <Badge variant="neutral">{tpl.recipient_role}</Badge>
                  <Badge variant="primary">{tpl.channel}</Badge>
                  <Badge variant="accent">{tpl.locale}</Badge>
                  <span className="text-small text-ink-3 truncate max-w-[200px]">{tpl.message_template?.substring(0, 60)}…</span>
                </div>
                <div className="flex items-center gap-s-2 shrink-0">
                  <Switch checked={tpl.enabled} onCheckedChange={() => toggleEnabled(tpl)} disabled={readOnly} />
                  <Button variant="ghost" size="sm" onClick={() => setPreviewModal({ open: true, tpl })}>Prévisualiser</Button>
                  <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => openEdit(tpl)}>Modifier</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Edit modal */}
      <Modal
        open={editModal.open}
        onOpenChange={open => !open && setEditModal({ open: false, tpl: null })}
        title="Modifier le template"
        size="lg"
      >
        <div className="space-y-s-4">
          <div className="flex gap-s-2 flex-wrap text-micro text-ink-3">
            Variables disponibles:{' '}
            {Object.keys(SAMPLE_VARS).map(v => (
              <code key={v} className="rounded bg-surface-2 px-s-1 font-mono">{v}</code>
            ))}
          </div>
          {draft.channel === 'email' && (
            <Input
              label="Sujet (email)"
              value={draft.subject ?? ''}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
            />
          )}
          <Textarea
            label="Message"
            value={draft.message_template ?? ''}
            onChange={e => setDraft(d => ({ ...d, message_template: e.target.value }))}
            className="min-h-[140px] font-mono text-small"
          />
          <div className="flex items-center gap-s-3">
            <Switch
              checked={draft.enabled ?? true}
              onCheckedChange={v => setDraft(d => ({ ...d, enabled: v }))}
              label="Activé"
            />
          </div>
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setEditModal({ open: false, tpl: null })}>Annuler</Button>
            <Button variant="primary" onClick={save} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={previewModal.open}
        onOpenChange={open => !open && setPreviewModal({ open: false, tpl: null })}
        title="Prévisualisation"
        size="lg"
      >
        {previewModal.tpl && (
          <div className="space-y-s-4">
            <div className="flex gap-s-2 flex-wrap">
              <Badge variant="neutral">{previewModal.tpl.recipient_role}</Badge>
              <Badge variant="primary">{previewModal.tpl.channel}</Badge>
              <Badge variant="accent">{previewModal.tpl.locale}</Badge>
            </div>
            {previewModal.tpl.subject && (
              <div>
                <p className="text-small font-medium text-ink-2 mb-s-1">Sujet :</p>
                <p className="text-small text-ink border border-line rounded p-s-3 bg-surface-2">
                  {renderPreview(previewModal.tpl.subject)}
                </p>
              </div>
            )}
            <div>
              <p className="text-small font-medium text-ink-2 mb-s-1">Message :</p>
              <pre className="whitespace-pre-wrap text-small text-ink border border-line rounded p-s-3 bg-surface-2 font-sans">
                {renderPreview(previewModal.tpl.message_template)}
              </pre>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setPreviewModal({ open: false, tpl: null })}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
