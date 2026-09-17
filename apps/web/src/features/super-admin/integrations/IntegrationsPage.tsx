import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'

type ServiceHealth = 'idle' | 'testing' | 'ok' | 'error'

const API_KEYS = [
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
  { key: 'RESEND_API_KEY', label: 'Resend API Key' },
  { key: 'WAVE_SECRET_KEY', label: 'Wave Secret Key' },
  { key: 'ORANGE_MONEY_SECRET', label: 'Orange Money Secret' },
]

const SERVICES: { key: string; label: string; service: string }[] = [
  { key: 'openai', label: 'OpenAI', service: 'openai' },
  { key: 'resend', label: 'Resend', service: 'resend' },
  { key: 'stripe', label: 'Stripe', service: 'stripe' },
]

type KeyMeta = { present: boolean; last_updated?: string }
type WebhookEvent = {
  id: string
  psp_name?: string
  provider_name?: string
  event_type: string
  created_at: string
  status: string
  payload?: unknown
}
type WebhookStats = { psp: string; received: number; processed: number; rejected: number }

export default function IntegrationsPage() {
  useAdminAudit('super-admin-integrations')
  useSuperAdminContext()

  const [keyMeta, setKeyMeta] = useState<Record<string, KeyMeta>>({})
  const [keyLoading, setKeyLoading] = useState(true)
  const [serviceHealth, setServiceHealth] = useState<Record<string, ServiceHealth>>({})
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [webhookStats, setWebhookStats] = useState<WebhookStats[]>([])
  const [webhookLoading, setWebhookLoading] = useState(true)
  const [payloadModal, setPayloadModal] = useState<{ open: boolean; payload: Record<string, unknown> | null }>({ open: false, payload: null })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadKeys()
    loadWebhooks()
  }, [])

  async function loadKeys() {
    setKeyLoading(true)
    // Read from platform_settings — value is just 'present'/'absent' flag, never the actual key
    const { data } = await (supabase as any)
      .from('platform_settings')
      .select('key, value, updated_at')
      .in('key', API_KEYS.map(k => k.key))
    const meta: Record<string, KeyMeta> = {}
    for (const k of API_KEYS) {
      const row = (data ?? []).find((r: { key: string }) => r.key === k.key)
      meta[k.key] = { present: !!row?.value, last_updated: row?.updated_at }
    }
    setKeyMeta(meta)
    setKeyLoading(false)
  }

  async function testService(service: string, key: string) {
    setServiceHealth(prev => ({ ...prev, [key]: 'testing' }))
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'test_integration', service },
    })
    setServiceHealth(prev => ({ ...prev, [key]: e ? 'error' : 'ok' }))
  }

  async function loadWebhooks() {
    setWebhookLoading(true)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: events } = await (supabase as any)
      .from('payment_provider_logs')
      .select('id, provider_name, event_type, created_at, status, payload')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)

    setWebhooks((events ?? []).map((e: WebhookEvent) => ({ ...e, psp_name: e.provider_name })))

    // Compute stats
    const statsMap: Record<string, WebhookStats> = {}
    for (const e of (events ?? []) as WebhookEvent[]) {
      const psp = (e as any).provider_name ?? 'Unknown'
      if (!statsMap[psp]) statsMap[psp] = { psp, received: 0, processed: 0, rejected: 0 }
      statsMap[psp].received++
      if ((e as any).status === 'processed') statsMap[psp].processed++
      if ((e as any).status === 'rejected' || (e as any).status === 'failed') statsMap[psp].rejected++
    }
    setWebhookStats(Object.values(statsMap))
    setWebhookLoading(false)
  }

  function healthBadge(h: ServiceHealth) {
    if (h === 'idle') return <Badge variant="neutral">—</Badge>
    if (h === 'testing') return <Badge variant="pending">Test en cours…</Badge>
    if (h === 'ok') return <Badge variant="success">Opérationnel</Badge>
    return <Badge variant="danger">Erreur</Badge>
  }

  return (
    <div className="space-y-s-6">
      <div>
        <h1 className="text-h2 font-bold text-ink">Intégrations</h1>
        <p className="text-small text-ink-3">Clés API, santé des services et webhooks PSP.</p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}

      {/* 1. API Keys */}
      <Card>
        <CardHeader><CardTitle>Clés API</CardTitle></CardHeader>
        <CardContent>
          {keyLoading ? (
            <Skeleton className="h-40 w-full rounded" />
          ) : (
            <table className="w-full text-small">
              <thead className="text-ink-3 border-b border-line">
                <tr>
                  {['Clé', 'Présence', 'Dernière mise à jour'].map(h => (
                    <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {API_KEYS.map(({ key, label }) => {
                  const meta = keyMeta[key]
                  return (
                    <tr key={key} className="hover:bg-surface-2">
                      <td className="px-s-3 py-s-2 font-mono text-ink-2">{label}</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={meta?.present ? 'success' : 'danger'}>
                          {meta?.present ? 'Présente' : 'Absente'}
                        </Badge>
                      </td>
                      <td className="px-s-3 py-s-2 text-ink-2">
                        {meta?.last_updated ? new Date(meta.last_updated).toLocaleString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 2. Service Health */}
      <Card>
        <CardHeader><CardTitle>Santé des services</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-s-3">
            {SERVICES.map(({ key, label, service }) => (
              <div key={key} className="flex items-center justify-between gap-s-4 py-s-2 border-b border-line last:border-0">
                <span className="text-small font-medium text-ink">{label}</span>
                <div className="flex items-center gap-s-3">
                  {healthBadge(serviceHealth[key] ?? 'idle')}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={serviceHealth[key] === 'testing'}
                    onClick={() => testService(service, key)}
                  >
                    Tester {label}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 3. Recent webhooks */}
      <Card>
        <CardHeader><CardTitle>Derniers webhooks PSP (7 jours)</CardTitle></CardHeader>
        <CardContent>
          {webhookLoading ? (
            <Skeleton className="h-32 w-full rounded" />
          ) : webhooks.length === 0 ? (
            <p className="text-small text-ink-3">Aucun webhook reçu ces 7 derniers jours.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="text-ink-3 border-b border-line">
                  <tr>
                    {['PSP', 'Événement', 'Date', 'Statut', ''].map(h => (
                      <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {webhooks.map(ev => (
                    <tr key={ev.id} className="hover:bg-surface-2">
                      <td className="px-s-3 py-s-2 font-medium text-ink">{ev.psp_name ?? (ev as any).provider_name ?? '—'}</td>
                      <td className="px-s-3 py-s-2 font-mono text-ink-2 text-micro">{ev.event_type}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{new Date(ev.created_at).toLocaleString('fr-FR')}</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={ev.status === 'processed' ? 'success' : ev.status === 'rejected' || ev.status === 'failed' ? 'danger' : 'pending'}>
                          {ev.status}
                        </Badge>
                      </td>
                      <td className="px-s-3 py-s-2">
                        {!!ev.payload && (
                          <Button variant="ghost" size="sm" onClick={() => setPayloadModal({ open: true, payload: ev.payload as Record<string, unknown> })}>
                            Voir payload
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Webhook stats */}
      {webhookStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Statistiques webhooks (7 jours)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-small">
              <thead className="text-ink-3 border-b border-line">
                <tr>
                  {['PSP', 'Reçus', 'Traités', 'Rejetés', 'Taux de succès'].map(h => (
                    <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {webhookStats.map(s => {
                  const rate = s.received > 0 ? Math.round((s.processed / s.received) * 100) : 0
                  return (
                    <tr key={s.psp} className="hover:bg-surface-2">
                      <td className="px-s-3 py-s-2 font-medium text-ink">{s.psp}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{s.received}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{s.processed}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{s.rejected}</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={rate >= 90 ? 'success' : rate >= 70 ? 'pending' : 'danger'}>
                          {rate}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payload modal */}
      <Modal
        open={payloadModal.open}
        onOpenChange={open => !open && setPayloadModal({ open: false, payload: null })}
        title="Payload webhook"
        size="xl"
      >
        <pre className="overflow-auto max-h-[400px] rounded bg-surface-2 p-s-3 text-micro font-mono text-ink-2">
          {JSON.stringify(payloadModal.payload, null, 2)}
        </pre>
        <div className="mt-s-4 flex justify-end">
          <Button variant="secondary" onClick={() => setPayloadModal({ open: false, payload: null })}>Fermer</Button>
        </div>
      </Modal>
    </div>
  )
}
