import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Select'

type Plan = {
  id: string
  code: string
  name: string
  target_role: string
  price_monthly: number
  price_yearly: number
  trial_days: number
  is_active: boolean
}

type CreditPack = {
  id: string
  code: string
  name: string
  credits: number
  price_xof: number
  is_active: boolean
}

const ROLES = [
  { label: 'Patient', value: 'patient' },
  { label: 'Professionnel', value: 'professional' },
  { label: 'Établissement', value: 'establishment_admin' },
  { label: 'Pharmacie', value: 'pharmacy_admin' },
  { label: 'Mutuelle', value: 'mutual_admin' },
]

const EMPTY_PLAN: Partial<Plan> = { code: '', name: '', target_role: 'patient', price_monthly: 0, price_yearly: 0, trial_days: 0, is_active: true }
const EMPTY_PACK: Partial<CreditPack> = { code: '', name: '', credits: 0, price_xof: 0, is_active: true }

export default function PlansPage() {
  useAdminAudit('super-admin-plans')
  const { readOnly } = useSuperAdminContext()

  const [plans, setPlans] = useState<Plan[]>([])
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [planModal, setPlanModal] = useState<{ open: boolean; plan: Partial<Plan> }>({ open: false, plan: EMPTY_PLAN })
  const [packModal, setPackModal] = useState<{ open: boolean; pack: Partial<CreditPack> }>({ open: false, pack: EMPTY_PACK })
  const [saving, setSaving] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: c }] = await Promise.all([
      (supabase as any).from('subscription_plans').select('*').order('price_monthly'),
      (supabase as any).from('credit_packs').select('*').order('price_xof'),
    ])
    setPlans(p ?? [])
    setPacks(c ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function flashSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function savePlan() {
    setSaving(true)
    try {
      const plan = planModal.plan
      if (plan.id) {
        await (supabase as any).from('subscription_plans').update({
          name: plan.name, target_role: plan.target_role,
          price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
          trial_days: plan.trial_days,
        }).eq('id', plan.id)
      } else {
        await (supabase as any).from('subscription_plans').insert({
          code: plan.code, name: plan.name, target_role: plan.target_role,
          price_monthly: plan.price_monthly, price_yearly: plan.price_yearly,
          trial_days: plan.trial_days, is_active: true,
        })
      }
      flashSuccess('Plan enregistré.')
      setPlanModal({ open: false, plan: EMPTY_PLAN })
      load()
    } catch (e: unknown) { setError((e as Error).message) }
    setSaving(false)
  }

  async function togglePlan(plan: Plan) {
    await supabase.functions.invoke('super-admin', { body: { action: 'toggle_plan', planId: plan.id, is_active: !plan.is_active } })
    load()
  }

  async function savePack() {
    setSaving(true)
    try {
      const pack = packModal.pack
      if (pack.id) {
        await (supabase as any).from('credit_packs').update({ name: pack.name, credits: pack.credits, price_xof: pack.price_xof }).eq('id', pack.id)
      } else {
        await (supabase as any).from('credit_packs').insert({ code: pack.code, name: pack.name, credits: pack.credits, price_xof: pack.price_xof, is_active: true })
      }
      flashSuccess('Pack crédits enregistré.')
      setPackModal({ open: false, pack: EMPTY_PACK })
      load()
    } catch (e: unknown) { setError((e as Error).message) }
    setSaving(false)
  }

  async function togglePack(pack: CreditPack) {
    await (supabase as any).from('credit_packs').update({ is_active: !pack.is_active }).eq('id', pack.id)
    load()
  }

  async function syncStripe() {
    setSyncLoading(true)
    const { error: e } = await supabase.functions.invoke('super-admin', { body: { action: 'sync_plans_stripe' } })
    setSyncLoading(false)
    if (e) setError(e.message)
    else flashSuccess('Synchronisation Stripe effectuée.')
  }

  if (loading) return <div className="space-y-s-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>

  return (
    <div className="space-y-s-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-bold text-ink">Plans & Crédits</h1>
          <p className="text-small text-ink-3">Gestion des abonnements et packs de crédits.</p>
        </div>
        <Button variant="secondary" onClick={syncStripe} loading={syncLoading} disabled={readOnly}>
          Synchroniser avec Stripe
        </Button>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="credits">Crédits</TabsTrigger>
          <TabsTrigger value="apercu">Aperçu</TabsTrigger>
        </TabsList>

        {/* ── Plans ── */}
        <TabsContent value="plans">
          <div className="mb-s-3 flex justify-end">
            <Button variant="primary" size="sm" disabled={readOnly} onClick={() => setPlanModal({ open: true, plan: EMPTY_PLAN })}>
              + Nouveau plan
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-line text-ink-3">
                  <tr>
                    {['Code', 'Nom', 'Rôle', '€/mois', '€/an', 'Essai', 'Statut', ''].map(h => (
                      <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {plans.map(plan => (
                    <tr key={plan.id} className="hover:bg-surface-2">
                      <td className="px-s-3 py-s-2 font-mono text-ink-2">{plan.code}</td>
                      <td className="px-s-3 py-s-2 font-medium text-ink">{plan.name}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{plan.target_role}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{plan.price_monthly?.toLocaleString('fr-FR')}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{plan.price_yearly?.toLocaleString('fr-FR')}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{plan.trial_days}j</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={plan.is_active ? 'success' : 'neutral'}>{plan.is_active ? 'Actif' : 'Inactif'}</Badge>
                      </td>
                      <td className="px-s-3 py-s-2">
                        <div className="flex gap-s-2">
                          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => setPlanModal({ open: true, plan })}>Modifier</Button>
                          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => togglePlan(plan)}>
                            {plan.is_active ? 'Désactiver' : 'Activer'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Credit Packs ── */}
        <TabsContent value="credits">
          <div className="mb-s-3 flex justify-end">
            <Button variant="primary" size="sm" disabled={readOnly} onClick={() => setPackModal({ open: true, pack: EMPTY_PACK })}>
              + Nouveau pack
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-line text-ink-3">
                  <tr>
                    {['Code', 'Nom', 'Crédits', 'Prix (XOF)', 'Statut', ''].map(h => (
                      <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {packs.map(pack => (
                    <tr key={pack.id} className="hover:bg-surface-2">
                      <td className="px-s-3 py-s-2 font-mono text-ink-2">{pack.code}</td>
                      <td className="px-s-3 py-s-2 font-medium text-ink">{pack.name}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{pack.credits}</td>
                      <td className="px-s-3 py-s-2 text-ink-2">{pack.price_xof?.toLocaleString('fr-FR')}</td>
                      <td className="px-s-3 py-s-2">
                        <Badge variant={pack.is_active ? 'success' : 'neutral'}>{pack.is_active ? 'Actif' : 'Inactif'}</Badge>
                      </td>
                      <td className="px-s-3 py-s-2">
                        <div className="flex gap-s-2">
                          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => setPackModal({ open: true, pack })}>Modifier</Button>
                          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => togglePack(pack)}>
                            {pack.is_active ? 'Désactiver' : 'Activer'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Preview ── */}
        <TabsContent value="apercu">
          <Card>
            <h2 className="text-h3 font-semibold text-ink mb-s-4">Aperçu de la grille tarifaire</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-small border-collapse">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border border-line px-s-3 py-s-2 text-left text-ink-2">Plan</th>
                    <th className="border border-line px-s-3 py-s-2 text-right text-ink-2">Mensuel</th>
                    <th className="border border-line px-s-3 py-s-2 text-right text-ink-2">Annuel</th>
                    <th className="border border-line px-s-3 py-s-2 text-center text-ink-2">Essai</th>
                    <th className="border border-line px-s-3 py-s-2 text-center text-ink-2">Cible</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.filter(p => p.is_active).map(plan => (
                    <tr key={plan.id} className="hover:bg-surface-2">
                      <td className="border border-line px-s-3 py-s-2 font-medium text-ink">{plan.name}</td>
                      <td className="border border-line px-s-3 py-s-2 text-right text-ink-2">{plan.price_monthly?.toLocaleString('fr-FR')} XOF</td>
                      <td className="border border-line px-s-3 py-s-2 text-right text-ink-2">{plan.price_yearly?.toLocaleString('fr-FR')} XOF</td>
                      <td className="border border-line px-s-3 py-s-2 text-center text-ink-2">{plan.trial_days}j</td>
                      <td className="border border-line px-s-3 py-s-2 text-center">
                        <Badge variant="primary">{plan.target_role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan modal */}
      <Modal open={planModal.open} onOpenChange={open => !open && setPlanModal({ open: false, plan: EMPTY_PLAN })} title={planModal.plan.id ? 'Modifier le plan' : 'Nouveau plan'} size="lg">
        <div className="space-y-s-4">
          {!planModal.plan.id && <Input label="Code" value={planModal.plan.code ?? ''} onChange={e => setPlanModal(p => ({ ...p, plan: { ...p.plan, code: e.target.value } }))} />}
          <Input label="Nom" value={planModal.plan.name ?? ''} onChange={e => setPlanModal(p => ({ ...p, plan: { ...p.plan, name: e.target.value } }))} />
          <Select label="Rôle cible" options={ROLES} value={planModal.plan.target_role ?? 'patient'} onValueChange={v => setPlanModal(p => ({ ...p, plan: { ...p.plan, target_role: v } }))} />
          <div className="grid grid-cols-2 gap-s-3">
            <Input label="Prix mensuel (XOF)" type="number" value={String(planModal.plan.price_monthly ?? 0)} onChange={e => setPlanModal(p => ({ ...p, plan: { ...p.plan, price_monthly: Number(e.target.value) } }))} />
            <Input label="Prix annuel (XOF)" type="number" value={String(planModal.plan.price_yearly ?? 0)} onChange={e => setPlanModal(p => ({ ...p, plan: { ...p.plan, price_yearly: Number(e.target.value) } }))} />
          </div>
          <Input label="Jours d'essai" type="number" value={String(planModal.plan.trial_days ?? 0)} onChange={e => setPlanModal(p => ({ ...p, plan: { ...p.plan, trial_days: Number(e.target.value) } }))} />
          <div className="flex justify-end gap-s-3 pt-s-2">
            <Button variant="secondary" onClick={() => setPlanModal({ open: false, plan: EMPTY_PLAN })}>Annuler</Button>
            <Button variant="primary" onClick={savePlan} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {/* Pack modal */}
      <Modal open={packModal.open} onOpenChange={open => !open && setPackModal({ open: false, pack: EMPTY_PACK })} title={packModal.pack.id ? 'Modifier le pack' : 'Nouveau pack'}>
        <div className="space-y-s-4">
          {!packModal.pack.id && <Input label="Code" value={packModal.pack.code ?? ''} onChange={e => setPackModal(p => ({ ...p, pack: { ...p.pack, code: e.target.value } }))} />}
          <Input label="Nom" value={packModal.pack.name ?? ''} onChange={e => setPackModal(p => ({ ...p, pack: { ...p.pack, name: e.target.value } }))} />
          <Input label="Crédits" type="number" value={String(packModal.pack.credits ?? 0)} onChange={e => setPackModal(p => ({ ...p, pack: { ...p.pack, credits: Number(e.target.value) } }))} />
          <Input label="Prix (XOF)" type="number" value={String(packModal.pack.price_xof ?? 0)} onChange={e => setPackModal(p => ({ ...p, pack: { ...p.pack, price_xof: Number(e.target.value) } }))} />
          <div className="flex justify-end gap-s-3 pt-s-2">
            <Button variant="secondary" onClick={() => setPackModal({ open: false, pack: EMPTY_PACK })}>Annuler</Button>
            <Button variant="primary" onClick={savePack} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
