'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Loader2 } from 'lucide-react'
import type { SanteSubRole } from '@/lib/subroles'
import { SANTE_SUBROLES } from '@/lib/subroles'

export function AcceptRefuseButtons({ attachmentId }: { attachmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'refuse' | null>(null)

  async function act(action: 'accept' | 'refuse') {
    setLoading(action)
    const supabase = createClient()
    await (supabase.from('establishment_professionals') as unknown as {
      update: (v: unknown) => { eq: (col: string, val: string) => Promise<unknown> }
    }).update({ status: action === 'accept' ? 'accepted' : 'refused' }).eq('id', attachmentId)
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-1.5 shrink-0">
      <button
        onClick={() => act('accept')}
        disabled={!!loading}
        title="Accepter"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--sw-success-bg)] text-[var(--sw-success)] hover:bg-[var(--sw-success)]/20 transition-colors disabled:opacity-50"
      >
        {loading === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => act('refuse')}
        disabled={!!loading}
        title="Refuser"
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--sw-danger-bg,#fef2f2)] text-[var(--sw-danger)] hover:opacity-80 transition-colors disabled:opacity-50"
      >
        {loading === 'refuse' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export function SubRoleSelect({
  attachmentId,
  currentRole,
}: {
  attachmentId: string
  currentRole: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('establishment_professionals') as unknown as {
      update: (v: unknown) => { eq: (col: string, val: string) => Promise<unknown> }
    }).update({ function: e.target.value }).eq('id', attachmentId)
    setLoading(false)
    router.refresh()
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={loading}
      className="text-xs border border-[var(--sw-line)] rounded-lg px-2 py-1 bg-[var(--sw-surface)] text-[var(--sw-ink)] focus:outline-none focus:border-[var(--sw-primary)] disabled:opacity-50"
    >
      {SANTE_SUBROLES.filter(r => r.value !== 'professionnel_independant').map(r => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  )
}

export function TeamMemberRoleSelect({
  memberId,
  currentRole,
  subRoles,
}: {
  memberId: string
  currentRole: string
  subRoles: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('team_members') as unknown as {
      update: (v: unknown) => { eq: (col: string, val: string) => Promise<unknown> }
    }).update({ sub_role: e.target.value }).eq('id', memberId)
    setLoading(false)
    router.refresh()
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={loading}
      className="text-xs border border-[var(--sw-line)] rounded-lg px-2 py-1 bg-[var(--sw-surface)] text-[var(--sw-ink)] focus:outline-none focus:border-[var(--sw-primary)] disabled:opacity-50"
    >
      {subRoles.map(r => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  )
}

export function RemoveMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    if (!confirm('Retirer ce membre de l\'équipe ?')) return
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('team_members') as unknown as {
      delete: () => { eq: (col: string, val: string) => Promise<unknown> }
    }).delete().eq('id', memberId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      title="Retirer"
      className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--sw-ink-3)] hover:text-[var(--sw-danger)] hover:bg-[var(--sw-danger-bg,#fef2f2)] transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
    </button>
  )
}

export function InviteMemberForm({
  organizationProfileId,
  organizationType,
  subRoles,
}: {
  organizationProfileId: string
  organizationType: string
  subRoles: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [subRole, setSubRole] = useState(subRoles[0]?.value ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 9) { setError('Numéro sénégalais invalide (9 chiffres).'); return }

    setLoading(true)
    const supabase = createClient()
    const email = `+221${digits}@phone.senewerr.internal`
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', `+221${digits}`)
      .maybeSingle()

    const targetProfileId = (profiles as unknown as { id: string } | null)?.id ?? null

    const { error: err } = await (supabase.from('team_members') as unknown as {
      insert: (v: unknown) => Promise<{ error: { message: string } | null }>
    }).insert({
      organization_profile_id: organizationProfileId,
      organization_type: organizationType,
      profile_id: targetProfileId,
      invited_phone: `+221${digits}`,
      invited_email: email,
      sub_role: subRole,
      status: 'pending',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setPhone('')
    setTimeout(() => { setSuccess(false); router.refresh() }, 2000)
  }

  return (
    <form onSubmit={handleInvite} className="sw-card p-5 space-y-3">
      <p className="text-sm font-semibold text-[var(--sw-ink)]">Inviter un membre</p>
      <div className="flex gap-2">
        <span className="sw-input px-3 flex items-center text-[var(--sw-ink-2)] bg-[var(--sw-surface-2)] text-sm shrink-0">+221</span>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="7X XXX XX XX"
          className="sw-input flex-1"
          required
        />
        <select
          value={subRole}
          onChange={e => setSubRole(e.target.value)}
          className="sw-input shrink-0"
        >
          {subRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-[var(--sw-danger)]">{error}</p>}
      {success && <p className="text-xs text-[var(--sw-success)]">Invitation envoyée !</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-[var(--sw-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Envoi…' : 'Envoyer l\'invitation'}
      </button>
    </form>
  )
}
