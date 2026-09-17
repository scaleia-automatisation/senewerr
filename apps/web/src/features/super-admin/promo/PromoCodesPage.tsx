import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { useSuperAdminContext } from '@/features/super-admin/SuperAdminLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Banner } from '@/components/ui/Banner'

type PromoCode = {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  value: number
  max_uses: number | null
  uses_count: number
  valid_until: string | null
  is_active: boolean
}

type Redemption = {
  id: string
  profile_id: string
  redeemed_at: string
  profiles?: { full_name: string; email: string }
}

const EMPTY: Partial<PromoCode> = { code: '', discount_type: 'percent', value: 0, max_uses: null, valid_until: null, is_active: true }

export default function PromoCodesPage() {
  useAdminAudit('super-admin-promo')
  const { readOnly } = useSuperAdminContext()

  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; code: Partial<PromoCode> }>({ open: false, code: EMPTY })
  const [saving, setSaving] = useState(false)
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [redLoading, setRedLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await (supabase as any).from('promo_codes').select('*').order('created_at', { ascending: false })
    setCodes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadRedemptions(code: PromoCode) {
    setSelectedCode(code)
    setRedLoading(true)
    const { data } = await (supabase as any)
      .from('promo_code_redemptions')
      .select('id, profile_id, redeemed_at, profiles(full_name, email)')
      .eq('promo_code_id', code.id)
      .order('redeemed_at', { ascending: false })
      .limit(20)
    setRedemptions(data ?? [])
    setRedLoading(false)
  }

  function flashSuccess(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3000) }

  async function save() {
    setSaving(true)
    try {
      const c = modal.code
      if (c.id) {
        await (supabase as any).from('promo_codes').update({
          code: c.code, discount_type: c.discount_type, value: c.value,
          max_uses: c.max_uses, valid_until: c.valid_until || null,
        }).eq('id', c.id)
      } else {
        await (supabase as any).from('promo_codes').insert({
          code: c.code, discount_type: c.discount_type, value: c.value,
          max_uses: c.max_uses, valid_until: c.valid_until || null, is_active: true, uses_count: 0,
        })
      }
      flashSuccess('Code promo enregistré.')
      setModal({ open: false, code: EMPTY })
      load()
    } catch (e: unknown) { setError((e as Error).message) }
    setSaving(false)
  }

  async function toggle(code: PromoCode) {
    await (supabase as any).from('promo_codes').update({ is_active: !code.is_active }).eq('id', code.id)
    load()
  }

  if (loading) return <div className="space-y-s-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>

  return (
    <div className="space-y-s-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-bold text-ink">Codes promo</h1>
          <p className="text-small text-ink-3">Gestion des codes de réduction.</p>
        </div>
        <Button variant="primary" size="sm" disabled={readOnly} onClick={() => setModal({ open: true, code: EMPTY })}>
          + Nouveau code
        </Button>
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {success && <Banner kind="info">{success}</Banner>}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-line text-ink-3">
              <tr>
                {['Code', 'Type', 'Valeur', 'Utilisations', 'Max', 'Expire le', 'Statut', ''].map(h => (
                  <th key={h} className="px-s-3 py-s-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {codes.map(code => (
                <tr key={code.id} className="hover:bg-surface-2">
                  <td className="px-s-3 py-s-2 font-mono font-bold text-ink">{code.code}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{code.discount_type === 'percent' ? '%' : 'Fixe'}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{code.value}{code.discount_type === 'percent' ? '%' : ' XOF'}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{code.uses_count}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{code.max_uses ?? '∞'}</td>
                  <td className="px-s-3 py-s-2 text-ink-2">{code.valid_until ? new Date(code.valid_until).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-s-3 py-s-2">
                    <Badge variant={code.is_active ? 'success' : 'neutral'}>{code.is_active ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-s-3 py-s-2">
                    <div className="flex gap-s-2">
                      <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => setModal({ open: true, code })}>Modifier</Button>
                      <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => toggle(code)}>{code.is_active ? 'Désactiver' : 'Activer'}</Button>
                      <Button variant="ghost" size="sm" onClick={() => loadRedemptions(code)}>Usages</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Usage panel */}
      {selectedCode && (
        <Card>
          <div className="flex items-center justify-between mb-s-4">
            <h2 className="text-h3 font-semibold text-ink">Usages — {selectedCode.code}</h2>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCode(null); setRedemptions([]) }}>Fermer</Button>
          </div>
          {redLoading ? (
            <Skeleton className="h-24 w-full rounded" />
          ) : redemptions.length === 0 ? (
            <p className="text-small text-ink-3">Aucune utilisation pour ce code.</p>
          ) : (
            <table className="w-full text-small">
              <thead className="text-ink-3 border-b border-line">
                <tr>
                  {['Utilisateur', 'Email', 'Date'].map(h => <th key={h} className="px-s-3 py-s-2 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {redemptions.map(r => (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className="px-s-3 py-s-2 text-ink">{(r.profiles as any)?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-2 text-ink-2">{(r.profiles as any)?.email ?? '—'}</td>
                    <td className="px-s-3 py-s-2 text-ink-2">{new Date(r.redeemed_at).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={modal.open} onOpenChange={open => !open && setModal({ open: false, code: EMPTY })} title={modal.code.id ? 'Modifier le code' : 'Nouveau code promo'}>
        <div className="space-y-s-4">
          <Input label="Code" value={modal.code.code ?? ''} onChange={e => setModal(m => ({ ...m, code: { ...m.code, code: e.target.value } }))} disabled={!!modal.code.id} />
          <Select
            label="Type de réduction"
            options={[{ label: 'Pourcentage (%)', value: 'percent' }, { label: 'Montant fixe (XOF)', value: 'fixed' }]}
            value={modal.code.discount_type ?? 'percent'}
            onValueChange={v => setModal(m => ({ ...m, code: { ...m.code, discount_type: v as 'percent' | 'fixed' } }))}
          />
          <Input label="Valeur" type="number" value={String(modal.code.value ?? 0)} onChange={e => setModal(m => ({ ...m, code: { ...m.code, value: Number(e.target.value) } }))} />
          <Input label="Utilisations max (vide = illimité)" type="number" value={String(modal.code.max_uses ?? '')} onChange={e => setModal(m => ({ ...m, code: { ...m.code, max_uses: e.target.value ? Number(e.target.value) : null } }))} />
          <Input label="Date d'expiration" type="date" value={modal.code.valid_until?.substring(0, 10) ?? ''} onChange={e => setModal(m => ({ ...m, code: { ...m.code, valid_until: e.target.value || null } }))} />
          <div className="flex justify-end gap-s-3 pt-s-2">
            <Button variant="secondary" onClick={() => setModal({ open: false, code: EMPTY })}>Annuler</Button>
            <Button variant="primary" onClick={save} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
