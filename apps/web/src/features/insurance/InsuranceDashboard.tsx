import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'
import { KpiTile } from '@/components/ui/KpiTile'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const thisMonthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
const fmt = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} FCFA`

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (h < 1) return `${Math.floor((Date.now() - new Date(d).getTime()) / 60000)}min`
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}j`
}

interface Todos {
  members_pending: number
  coverage_pending: number
  payments_to_make: number
  payments_this_month: number
  overdue_24h: number
}

interface CoverageRequest {
  id: string
  created_at: string
  status: string
  total_amount: number
  mutual_payment_status?: string
  patients?: { profiles?: { first_name?: string; last_name?: string } }
  organizations?: { name?: string }
}

interface FinanceStats {
  total_requested: number
  total_approved: number
  total_paid: number
  pending: number
}

export default function InsuranceDashboard() {
  const { profile } = useAuth()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todos>({ members_pending: 0, coverage_pending: 0, payments_to_make: 0, payments_this_month: 0, overdue_24h: 0 })
  const [todosLoading, setTodosLoading] = useState(true)
  const [requests, setRequests] = useState<CoverageRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [stats, setStats] = useState<FinanceStats>({ total_requested: 0, total_approved: 0, total_paid: 0, pending: 0 })

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('organization_members').select('organization_id').eq('profile_id', profile.id).eq('role', 'mutual_admin').limit(1).maybeSingle()
      .then(({ data }) => { if (data?.organization_id) setOrgId(data.organization_id) })
  }, [profile?.id])

  useEffect(() => {
    if (!orgId) return
    setTodosLoading(true)
    const cutoff24h = new Date(Date.now() - 86400000).toISOString()

    Promise.all([
      (supabase as any).from('insurance_members').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('insurance_provider_id', orgId),
      (supabase as any).from('coverage_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('insurance_provider_id', orgId),
      (supabase as any).from('coverage_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('mutual_payment_status', 'pending').eq('insurance_provider_id', orgId),
      (supabase as any).from('coverage_requests').select('id', { count: 'exact', head: true }).eq('mutual_payment_status', 'paid').eq('insurance_provider_id', orgId).gte('updated_at', thisMonthStart()),
      (supabase as any).from('coverage_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('insurance_provider_id', orgId).lt('created_at', cutoff24h),
    ]).then(([members, coverage, payments, paid_month, overdue]) => {
      setTodos({ members_pending: members.count ?? 0, coverage_pending: coverage.count ?? 0, payments_to_make: payments.count ?? 0, payments_this_month: paid_month.count ?? 0, overdue_24h: overdue.count ?? 0 })
      setTodosLoading(false)
    })
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    setRequestsLoading(true)
    ;(supabase as any).from('coverage_requests')
      .select('id, created_at, status, total_amount, mutual_payment_status, patients(profiles(first_name, last_name)), organizations(name)')
      .eq('insurance_provider_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }: any) => { setRequests(data ?? []); setRequestsLoading(false) })
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    ;(supabase as any).from('coverage_requests')
      .select('total_amount, status, mutual_payment_status')
      .eq('insurance_provider_id', orgId)
      .gte('created_at', thisMonthStart())
      .then(({ data }: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = data ?? []
        const sum = (arr: any[]) => arr.reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0)
        setStats({
          total_requested: sum(rows),
          total_approved: sum(rows.filter((r: any) => r.status === 'approved')),
          total_paid: sum(rows.filter((r: any) => r.mutual_payment_status === 'paid')),
          pending: sum(rows.filter((r: any) => r.status === 'pending')),
        })
      })
  }, [orgId])

  const statusVariant = (s: string): 'success' | 'danger' | 'pending' | 'neutral' => {
    if (s === 'approved') return 'success'
    if (s === 'rejected') return 'danger'
    if (s === 'pending') return 'pending'
    return 'neutral'
  }

  const kpiTiles = [
    { label: 'Assurés à vérifier', value: todos.members_pending, icon: Shield, variant: todos.members_pending > 0 ? 'warning' : 'default', subtext: 'En attente de validation' },
    { label: 'Demandes de PEC', value: todos.coverage_pending, icon: Clock, variant: todos.coverage_pending > 0 ? 'warning' : 'default', subtext: 'À traiter' },
    { label: 'Paiements à effectuer', value: todos.payments_to_make, icon: AlertTriangle, variant: todos.payments_to_make > 0 ? 'danger' : 'default', subtext: 'Demandes approuvées' },
    { label: 'Paiements ce mois', value: todos.payments_this_month, icon: CheckCircle, variant: todos.payments_this_month > 0 ? 'success' : 'default', subtext: 'Réglés' },
    { label: 'En retard (> 24h)', value: todos.overdue_24h, icon: AlertTriangle, variant: todos.overdue_24h > 0 ? 'danger' : 'default', subtext: 'Dépassent 24h' },
  ] as const

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Dashboard Mutuelle</h1>
        <p className="text-sm text-ink-3">Gestion des prises en charge et remboursements</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">À traiter</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-s-3">
          {todosLoading
            ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)
            : kpiTiles.map(t => (
                <KpiTile key={t.label} label={t.label} value={t.value} subtext={t.subtext} variant={t.variant} />
              ))
          }
        </div>
      </section>

      <section>
        <div className="border-t border-line pt-s-4">
          <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Demandes récentes</h2>
          <div className="flex flex-col gap-s-2">
            {requestsLoading
              ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)
              : requests.length === 0
                ? <p className="text-center text-ink-3 py-8">Aucune demande de prise en charge</p>
                : requests.map(r => {
                    const p = r.patients?.profiles
                    const name = p ? `${p.first_name} ${p.last_name}` : 'Patient inconnu'
                    const pharmacy = r.organizations?.name ?? 'Pharmacie inconnue'
                    return (
                      <Card key={r.id} className="p-s-3">
                        <div className="flex items-center justify-between gap-s-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-s-2">
                              <span className="font-medium text-ink">{name}</span>
                              <span className="text-xs text-ink-3">{pharmacy}</span>
                              <span className="font-medium text-ink">{fmt(r.total_amount)}</span>
                            </div>
                            <div className="flex items-center gap-s-2">
                              <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                              <span className="text-xs text-ink-3">Il y a {timeAgo(r.created_at)}</span>
                            </div>
                          </div>
                          <Link to={`/mutuelle/prises-en-charge/${r.id}`}>
                            <Button size="sm" variant="ghost">Traiter →</Button>
                          </Link>
                        </div>
                      </Card>
                    )
                  })
            }
          </div>
        </div>
      </section>

      <section>
        <div className="border-t border-line pt-s-4">
          <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide mb-s-3">Stats finances — ce mois</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-3">
            <KpiTile label="Total demandé" value={fmt(stats.total_requested)} variant="default" />
            <KpiTile label="Total approuvé" value={fmt(stats.total_approved)} variant="warning" />
            <KpiTile label="Total payé" value={fmt(stats.total_paid)} variant="success" />
            <KpiTile label="En attente" value={fmt(stats.pending)} variant={stats.pending > 0 ? 'danger' : 'default'} />
          </div>
        </div>
      </section>
    </div>
  )
}
