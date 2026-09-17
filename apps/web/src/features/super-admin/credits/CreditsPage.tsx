import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { useAuth } from '@/features/auth/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'

type Profile = {
  id: string
  user_id: string
  full_name: string | null
  email: string | null
  role: string
}

type Wallet = {
  plan_credits: number
  purchased_credits: number
  plan_code?: string
}

type Plan = { code: string; name: string }

export default function CreditsPage() {
  useAdminAudit('super-admin-credits')
  const { readOnly } = useSuperAdminContext()
  const { profile: me } = useAuth()
  const isSuperAdmin = me?.role === 'super_admin'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Adjust credits modal
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustMotif, setAdjustMotif] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

  // Change plan modal
  const [planModal, setPlanModal] = useState(false)
  const [newPlan, setNewPlan] = useState('')
  const [planSaving, setPlanSaving] = useState(false)

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, user_id, full_name, email, role')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10)
    setResults(data ?? [])
    setSearching(false)
  }

  async function selectProfile(profile: Profile) {
    setSelected(profile)
    setResults([])
    setQuery(profile.full_name ?? profile.email ?? '')
    setWalletLoading(true)

    const [{ data: w }, { data: p }] = await Promise.all([
      (supabase as any).from('wallets').select('plan_credits, purchased_credits').eq('profile_id', profile.id).single(),
      (supabase as any).from('subscription_plans').select('code, name').order('name'),
    ])
    setWallet(w ?? { plan_credits: 0, purchased_credits: 0 })
    setPlans(p ?? [])
    setWalletLoading(false)
  }

  async function adjustCredits() {
    if (!selected) return
    const amount = parseInt(adjustAmount)
    if (isNaN(amount) || adjustMotif.trim().length < 10) {
      setError('Motif requis (min 10 caractères) et montant invalide.')
      return
    }
    const limit = isSuperAdmin ? Infinity : 100
    if (Math.abs(amount) > limit) {
      setError(`En tant qu'admin, vous êtes limité à ${limit} crédits.`)
      return
    }
    setAdjustSaving(true)
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'adjust_credits', profileId: selected.id, amount, motif: adjustMotif },
    })
    setAdjustSaving(false)
    if (e) setError(e.message)
    else {
      flash(`Crédits ajustés de ${amount > 0 ? '+' : ''}${amount}.`)
      setAdjustModal(false)
      setAdjustAmount('')
      setAdjustMotif('')
      selectProfile(selected)
    }
  }

  async function changePlan() {
    if (!selected || !newPlan) return
    setPlanSaving(true)
    const { error: e } = await supabase.functions.invoke('super-admin', {
      body: { action: 'admin_change_plan', profileId: selected.id, planCode: newPlan, manual: true },
    })
    setPlanSaving(false)
    if (e) setError(e.message)
    else { flash(`Plan changé vers ${newPlan}.`); setPlanModal(false); selectProfile(selected) }
  }

  return (
    <div className="space-y-s-5 max-w-2xl">
      <div>
        <h1 className="text-h2 font-bold text-ink">Crédits utilisateurs</h1>
        <p className="text-small text-ink-3">Ajuster les crédits ou changer le plan d'un utilisateur.</p>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      {/* Search */}
      <Card>
        <div className="flex gap-s-3">
          <Input
            className="flex-1"
            placeholder="Chercher par nom ou email…"
            value={query}
            onChange={e => { setQuery(e.target.value); if (!e.target.value) { setSelected(null); setWallet(null) } }}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <Button variant="secondary" onClick={search} loading={searching}>Chercher</Button>
        </div>

        {results.length > 0 && (
          <div className="mt-s-3 divide-y divide-line border border-line rounded-md overflow-hidden">
            {results.map(r => (
              <button
                key={r.id}
                className="w-full flex items-center justify-between px-s-3 py-s-2 text-left hover:bg-surface-2"
                onClick={() => selectProfile(r)}
              >
                <div>
                  <p className="text-small font-medium text-ink">{r.full_name ?? '—'}</p>
                  <p className="text-micro text-ink-3">{r.email}</p>
                </div>
                <Badge variant="neutral">{r.role}</Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Wallet */}
      {selected && (
        <Card>
          {walletLoading ? (
            <Skeleton className="h-24 w-full rounded" />
          ) : (
            <div className="space-y-s-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{selected.full_name}</p>
                  <p className="text-small text-ink-3">{selected.email}</p>
                </div>
                <Badge variant="primary">{selected.role}</Badge>
              </div>

              {wallet && (
                <div className="grid grid-cols-2 gap-s-3">
                  <div className="rounded-md bg-surface-2 p-s-3">
                    <p className="text-micro text-ink-3">Crédits plan</p>
                    <p className="text-h2 font-bold text-ink">{wallet.plan_credits}</p>
                  </div>
                  <div className="rounded-md bg-surface-2 p-s-3">
                    <p className="text-micro text-ink-3">Crédits achetés</p>
                    <p className="text-h2 font-bold text-ink">{wallet.purchased_credits}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-s-3">
                <Button variant="primary" disabled={readOnly} onClick={() => setAdjustModal(true)}>
                  Ajuster les crédits
                </Button>
                <Button variant="secondary" disabled={readOnly} onClick={() => setPlanModal(true)}>
                  Changer de plan
                </Button>
              </div>

              {!isSuperAdmin && (
                <p className="text-micro text-ink-3">
                  En tant qu'admin plateforme, vous êtes limité à ±100 crédits par opération.
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Adjust credits modal */}
      <Modal open={adjustModal} onOpenChange={setAdjustModal} title="Ajuster les crédits">
        <div className="space-y-s-4">
          <Input
            label="Montant (positif ou négatif)"
            type="number"
            value={adjustAmount}
            onChange={e => setAdjustAmount(e.target.value)}
            hint={isSuperAdmin ? 'Aucune limite (super admin)' : 'Maximum ±100 crédits'}
            placeholder="+50 ou -10"
          />
          <Input
            label="Motif (min 10 caractères)"
            value={adjustMotif}
            onChange={e => setAdjustMotif(e.target.value)}
            placeholder="Ex : Compensation suite à bug signalement #1234"
          />
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setAdjustModal(false)}>Annuler</Button>
            <Button
              variant="primary"
              onClick={adjustCredits}
              loading={adjustSaving}
              disabled={!adjustAmount || adjustMotif.length < 10}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Change plan modal */}
      <Modal open={planModal} onOpenChange={setPlanModal} title="Changer de plan">
        <div className="space-y-s-4">
          <Banner kind="info">
            Changement manuel — aucune facturation Stripe ne sera déclenchée.
          </Banner>
          <Select
            label="Nouveau plan"
            options={plans.map(p => ({ label: p.name, value: p.code }))}
            value={newPlan}
            onValueChange={setNewPlan}
            placeholder="Sélectionner un plan…"
          />
          <div className="flex justify-end gap-s-3">
            <Button variant="secondary" onClick={() => setPlanModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={changePlan} loading={planSaving} disabled={!newPlan}>
              Changer le plan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
