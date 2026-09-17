import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

type Setting = { key: string; value: unknown }

const GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Réservations & RDV',
    keys: ['booking_delay_minutes', 'sla_pec_hours', 'prescription_validity_days', 'withdrawal_code_attempts'],
  },
  { label: 'Paiements', keys: ['payment_timeout_hours', 'reminder_delays_days'] },
  { label: 'Commissions', keys: ['default_commission_pct'] },
  { label: 'Finances', keys: ['usd_to_xof'] },
  { label: 'IA', keys: ['ai_pricing'] },
  { label: 'Maintenance', keys: ['maintenance_mode', 'maintenance_message'] },
  { label: 'Offre fondateur', keys: ['founder_offer_enabled'] },
  { label: 'Email', keys: ['allowed_email_domains'] },
]

const TOGGLE_KEYS = new Set(['maintenance_mode', 'founder_offer_enabled'])
const JSON_KEYS = new Set(['ai_pricing'])
const TEXTAREA_KEYS = new Set(['maintenance_message', 'ai_pricing'])
const ARRAY_KEYS = new Set(['reminder_delays_days', 'allowed_email_domains'])

function displayValue(key: string, val: unknown): string {
  if (val == null) return ''
  if (TOGGLE_KEYS.has(key)) return String(val)
  if (JSON_KEYS.has(key)) return JSON.stringify(val, null, 2)
  if (ARRAY_KEYS.has(key)) return Array.isArray(val) ? (val as string[]).join(', ') : String(val)
  return String(val)
}

function parseValue(key: string, raw: string): unknown {
  if (TOGGLE_KEYS.has(key)) return raw === 'true'
  if (JSON_KEYS.has(key)) return JSON.parse(raw)
  if (ARRAY_KEYS.has(key)) return raw.split(',').map(s => s.trim()).filter(Boolean)
  const n = Number(raw)
  return isNaN(n) ? raw : n
}

export default function PlatformSettingsPage() {
  useAdminAudit('super-admin-settings')
  const { readOnly } = useSuperAdminContext()

  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ key: string; raw: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    ;(supabase as any)
      .from('platform_settings')
      .select('key, value')
      .then(({ data, error: e }: { data: Setting[] | null; error: unknown }) => {
        if (e) { setError('Erreur chargement paramètres'); return }
        const map: Record<string, unknown> = {}
        ;(data ?? []).forEach((s: Setting) => { map[s.key] = s.value })
        setSettings(map)
        const d: Record<string, string> = {}
        Object.entries(map).forEach(([k, v]) => { d[k] = displayValue(k, v) })
        setDrafts(d)
        setLoading(false)
      })
  }, [])

  function openConfirm(key: string) {
    setPending({ key, raw: drafts[key] ?? '' })
  }

  async function handleSave() {
    if (!pending) return
    setSaving(true)
    try {
      const value = parseValue(pending.key, pending.raw)
      const { error: e } = await supabase.functions.invoke('super-admin', {
        body: { action: 'update_setting', key: pending.key, value },
      })
      if (e) throw new Error(e.message)
      setSettings(prev => ({ ...prev, [pending.key]: value }))
      setSuccess(`Paramètre « ${pending.key} » mis à jour.`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  if (loading) return (
    <div className="space-y-s-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-s-5 max-w-3xl">
      <div>
        <h1 className="text-h2 font-bold text-ink">Paramètres plateforme</h1>
        <p className="text-small text-ink-3 mt-s-1">Paramètres système globaux de Medikool.</p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      {GROUPS.map(group => (
        <Card key={group.label}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-s-4">
              {group.keys.map(key => (
                <SettingRow
                  key={key}
                  settingKey={key}
                  value={drafts[key] ?? ''}
                  toggle={TOGGLE_KEYS.has(key)}
                  isTextarea={TEXTAREA_KEYS.has(key)}
                  readOnly={readOnly}
                  onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))}
                  onSave={() => openConfirm(key)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Modal
        open={!!pending}
        onOpenChange={open => !open && setPending(null)}
        title="Modifier ce paramètre système ?"
        size="sm"
      >
        <p className="text-small text-ink-2 mb-s-4">
          Vous êtes sur le point de modifier <strong>{pending?.key}</strong>. Cette action est immédiatement effective.
        </p>
        <div className="flex justify-end gap-s-3">
          <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>Annuler</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Confirmer</Button>
        </div>
      </Modal>
    </div>
  )
}

function SettingRow({
  settingKey, value, toggle, isTextarea, readOnly, onChange, onSave,
}: {
  settingKey: string
  value: string
  toggle: boolean
  isTextarea: boolean
  readOnly: boolean
  onChange: (v: string) => void
  onSave: () => void
}) {
  const label = settingKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (toggle) {
    const checked = value === 'true'
    return (
      <div className="flex items-center justify-between py-s-2 border-b border-line last:border-0">
        <span className="text-small font-medium text-ink-2">{label}</span>
        <div className="flex items-center gap-s-3">
          <Switch
            checked={checked}
            onCheckedChange={v => { onChange(String(v)); onSave() }}
            disabled={readOnly}
          />
          {!readOnly && (
            <span className="text-micro text-ink-3">{checked ? 'Activé' : 'Désactivé'}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-s-2">
      <div className="flex items-center justify-between">
        <label className="text-small font-medium text-ink-2">{label}</label>
        <Button variant="secondary" size="sm" disabled={readOnly} onClick={onSave}>
          Enregistrer
        </Button>
      </div>
      {isTextarea ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          className="font-mono text-small"
        />
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
        />
      )}
    </div>
  )
}
