import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'

type Provider = {
  id: string
  name: string
  is_active: boolean
  fee_percentage: number
  fee_fixed: number
}

export default function PaymentProvidersPage() {
  useAdminAudit('super-admin-payment-providers')
  const { readOnly } = useSuperAdminContext()

  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await (supabase as any).from('payment_providers').select('*').order('name')
    setProviders(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(provider: Provider) {
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'toggle_provider', providerId: provider.id, is_active: !provider.is_active },
    })
    if (e) setError(e.message)
    else load()
  }

  async function testProvider(provider: Provider) {
    setTestLoading(prev => ({ ...prev, [provider.id]: true }))
    setTestResults(prev => ({ ...prev, [provider.id]: null }))
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'test_provider', providerId: provider.id },
    })
    setTestResults(prev => ({ ...prev, [provider.id]: e ? 'error' : 'success' }))
    setTestLoading(prev => ({ ...prev, [provider.id]: false }))
  }

  if (loading) return <div className="space-y-s-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>

  return (
    <div className="space-y-s-5 max-w-3xl">
      <div>
        <h1 className="text-h2 font-bold text-ink">Fournisseurs de paiement</h1>
        <p className="text-small text-ink-3">Gestion des prestataires de paiement et leurs frais.</p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}

      <div className="space-y-s-3">
        {providers.map(provider => {
          const testResult = testResults[provider.id]
          const testingNow = testLoading[provider.id]

          return (
            <Card key={provider.id}>
              <div className="flex items-center justify-between gap-s-4">
                <div className="flex items-center gap-s-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-body font-bold text-ink-2">
                    {provider.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-s-2">
                      <p className="font-semibold text-ink">{provider.name}</p>
                      <Badge variant={provider.is_active ? 'success' : 'neutral'}>
                        {provider.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <p className="text-small text-ink-3">
                      Frais: {provider.fee_percentage}% + {provider.fee_fixed} XOF
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-s-3 shrink-0">
                  {testResult && (
                    <Banner kind={testResult === 'success' ? 'info' : 'warning'} className="py-s-1 text-micro">
                      {testResult === 'success' ? 'Connexion OK' : 'Échec de connexion'}
                    </Banner>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => testProvider(provider)}
                    loading={testingNow}
                  >
                    Test de connexion
                  </Button>
                  <Switch
                    checked={provider.is_active}
                    onCheckedChange={() => toggle(provider)}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {providers.length === 0 && (
        <div className="py-s-8 text-center text-ink-3">
          <p>Aucun fournisseur de paiement configuré.</p>
        </div>
      )}
    </div>
  )
}
