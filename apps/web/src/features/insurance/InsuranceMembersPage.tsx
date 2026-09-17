import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Search } from 'lucide-react'

const PAGE_SIZE = 20

interface StatusCfg { label: string; variant: string }
const STATUS_MAP: Record<string, StatusCfg> = {
  pending_verification: { label: 'En attente', variant: 'warning' },
  verified:             { label: 'Vérifié',    variant: 'success' },
  rejected:             { label: 'Rejeté',     variant: 'danger' },
  suspended:            { label: 'Suspendu',   variant: 'orange' },
}

const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`

export default function InsuranceMembersPage() {
  const { org } = useAuth()
  const orgId = org?.id

  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null })
  const [rejectReason, setRejectReason] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const fetchMembers = useCallback(async (q: string, p: number) => {
    if (!orgId) return
    setLoading(true)
    let query = supabase
      .from('insurance_members')
      .select('*, profiles(first_name, last_name, email), insurance_plans(name)', { count: 'exact' })
      .eq('organization_id', orgId)
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
    if (q.trim()) {
      query = query.or(`profiles.first_name.ilike.%${q}%,profiles.last_name.ilike.%${q}%,member_number.ilike.%${q}%`)
    }
    const { data, count } = await query
    setMembers(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setPage(0); fetchMembers(search, 0) }, 400)
    return () => clearTimeout(debounce.current)
  }, [search, fetchMembers])

  useEffect(() => { fetchMembers(search, page) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const callRpc = async (memberId: string, action: string, reason?: string) => {
    setActionLoading(memberId + action)
    await supabase.rpc('verify_member', { p_member_id: memberId, p_action: action, p_reason: reason ?? null })
    setActionLoading(null)
    fetchMembers(search, page)
  }

  const handleReject = async () => {
    if (!rejectModal.memberId) return
    await callRpc(rejectModal.memberId, 'reject', rejectReason)
    setRejectModal({ open: false, memberId: null }); setRejectReason('')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const MemberActions = ({ m }: { m: any }) => {
    const busy = (a: string) => actionLoading === m.id + a
    return (
      <div className="flex gap-s-2 flex-wrap">
        {m.status === 'pending_verification' && <>
          <Button size="sm" variant="primary" loading={busy('verify')} onClick={() => callRpc(m.id, 'verify')}>Vérifier</Button>
          <Button size="sm" variant="danger" onClick={() => setRejectModal({ open: true, memberId: m.id })}>Rejeter</Button>
        </>}
        {m.status === 'verified' && (
          <Button size="sm" variant="ghost" loading={busy('suspend')} onClick={() => callRpc(m.id, 'suspend')}>Suspendre</Button>
        )}
        {(m.status === 'rejected' || m.status === 'suspended') && (
          <Button size="sm" variant="secondary" loading={busy('reactivate')} onClick={() => callRpc(m.id, 'reactivate')}>Réactiver</Button>
        )}
      </div>
    )
  }

  return (
    <div className="p-s-5 space-y-s-4">
      <div className="flex items-center justify-between gap-s-3">
        <h1 className="text-xl font-semibold text-ink">Assurés</h1>
        <span className="text-sm text-ink-3">{total} résultat{total > 1 ? 's' : ''}</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 w-4 h-4 pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Rechercher un assuré…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr className="text-left text-ink-3 border-b border-line">
              {['Nom', 'Numéro adhérent', 'Plan', 'Statut', 'Plafond utilisé', 'Actions'].map(h => (
                <th key={h} className="py-s-3 px-s-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="p-s-2"><Skeleton className="h-10 rounded-md" /></td></tr>
                ))
              : members.length === 0
                ? <tr><td colSpan={6}><EmptyState title="Aucun assuré trouvé" description="Essayez d'affiner votre recherche" /></td></tr>
                : members.map(m => {
                    const cfg = STATUS_MAP[m.status] ?? { label: m.status, variant: 'default' }
                    const name = m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : '—'
                    return (
                      <tr key={m.id} className="border-b border-line hover:bg-surface-2 transition-colors">
                        <td className="py-s-3 px-s-4">
                          <div className="font-medium text-ink">{name}</div>
                          <div className="text-xs text-ink-3">{m.profiles?.email}</div>
                        </td>
                        <td className="py-s-3 px-s-4 text-ink-2">{m.member_number}</td>
                        <td className="py-s-3 px-s-4 text-ink-2">{m.insurance_plans?.name ?? m.plan_name}</td>
                        <td className="py-s-3 px-s-4">
                          <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
                        </td>
                        <td className="py-s-3 px-s-4 text-ink-2">
                          {fmt(m.ceiling_used)} / {fmt(m.ceiling_total)}
                        </td>
                        <td className="py-s-3 px-s-4"><MemberActions m={m} /></td>
                      </tr>
                    )
                  })
            }
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-s-2">
        {loading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-md" />)
          : members.length === 0
            ? <EmptyState title="Aucun assuré trouvé" description="Essayez d'affiner votre recherche" />
            : members.map(m => {
                const cfg = STATUS_MAP[m.status] ?? { label: m.status, variant: 'default' }
                const name = m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : '—'
                return (
                  <div key={m.id} className="bg-surface border border-line rounded-md p-s-4 space-y-s-2">
                    <div className="flex items-start justify-between gap-s-2">
                      <div>
                        <div className="font-medium text-ink">{name}</div>
                        <div className="text-xs text-ink-3">{m.member_number} · {m.insurance_plans?.name ?? m.plan_name}</div>
                      </div>
                      <Badge variant={cfg.variant as any}>{cfg.label}</Badge>
                    </div>
                    <div className="text-sm text-ink-2">{fmt(m.ceiling_used)} / {fmt(m.ceiling_total)}</div>
                    <MemberActions m={m} />
                  </div>
                )
              })
        }
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-s-2">
          <Button variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</Button>
          <span className="text-sm text-ink-3">Page {page + 1} / {totalPages}</span>
          <Button variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}

      <Modal open={rejectModal.open} onClose={() => setRejectModal({ open: false, memberId: null })} title="Rejeter l'adhérent">
        <Input label="Raison du rejet" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        <div className="flex justify-end gap-s-2 mt-s-4">
          <Button variant="ghost" onClick={() => setRejectModal({ open: false, memberId: null })}>Annuler</Button>
          <Button variant="danger" loading={actionLoading === rejectModal.memberId + 'reject'} disabled={!rejectReason} onClick={handleReject}>
            Confirmer le rejet
          </Button>
        </div>
      </Modal>
    </div>
  )
}
