import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 20

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

type TabId =
  | 'all'
  | 'new'
  | 'pharmacy_pending'
  | 'prescription_pending'
  | 'mutual_pending'
  | 'patient_payment_pending'
  | 'mutual_payment_pending'
  | 'preparing'
  | 'ready'
  | 'withdrawn'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'disputes'

interface TabConfig {
  id: TabId
  label: string
  filter: (q: any) => any
}

const TAB_CONFIGS: TabConfig[] = [
  {
    id: 'all',
    label: 'Toutes',
    filter: q => q,
  },
  {
    id: 'new',
    label: 'Nouvelles',
    filter: q => q.eq('pharmacy_status', 'pending').eq('prescription_status', 'pending'),
  },
  {
    id: 'pharmacy_pending',
    label: 'Pharmacie à traiter',
    filter: q => q.eq('pharmacy_status', 'pending'),
  },
  {
    id: 'prescription_pending',
    label: 'Ordonnance à vérifier',
    filter: q => q.eq('prescription_status', 'pending'),
  },
  {
    id: 'mutual_pending',
    label: 'Mutuelle en attente',
    filter: q => q.eq('mutual_payment_status', 'pending'),
  },
  {
    id: 'patient_payment_pending',
    label: 'Paiement patient',
    filter: q => q.eq('patient_payment_status', 'pending'),
  },
  {
    id: 'mutual_payment_pending',
    label: 'Paiement mutuelle',
    filter: q => q.eq('mutual_payment_status', 'pending'),
  },
  {
    id: 'preparing',
    label: 'À préparer',
    filter: q => q.eq('preparation_status', 'preparing'),
  },
  {
    id: 'ready',
    label: 'Prêtes',
    filter: q => q.eq('preparation_status', 'ready'),
  },
  {
    id: 'withdrawn',
    label: 'Retirées',
    filter: q => q.not('withdrawn_at', 'is', null).neq('status', 'completed'),
  },
  {
    id: 'completed',
    label: 'Terminées',
    filter: q => q.eq('status', 'completed'),
  },
  {
    id: 'cancelled',
    label: 'Annulées',
    filter: q => q.eq('status', 'cancelled'),
  },
  {
    id: 'expired',
    label: 'Expirées',
    filter: q => q.eq('status', 'expired'),
  },
  {
    id: 'disputes',
    label: 'Litiges',
    filter: q => q.not('litige_status', 'is', null),
  },
]

function statusVariant(status?: string): 'success' | 'danger' | 'pending' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled' || status === 'expired') return 'danger'
  if (status === 'pending' || status === 'accepted') return 'pending'
  return 'neutral'
}

interface OrdersTabProps {
  tabConfig: TabConfig
}

function OrdersTab({ tabConfig }: OrdersTabProps) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const dSearch = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)

    let q = (supabase as any)
      .from('pharmacy_reservations')
      .select(
        `id, reference, total_amount, status, created_at,
         patient:profiles!patient_id(full_name),
         pharmacy:organizations!pharmacy_id(name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    // Apply tab-specific filter
    q = tabConfig.filter(q)

    // Search
    if (dSearch) {
      // reference search
      q = q.or(`reference.ilike.%${dSearch}%`)
    }

    // Date range
    if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
    if (dateTo) {
      const end = new Date(dateTo)
      end.setDate(end.getDate() + 1)
      q = q.lt('created_at', end.toISOString())
    }

    const { data, count } = await q
    setRows(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, dSearch, dateFrom, dateTo, tabConfig])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [dSearch, dateFrom, dateTo])

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex flex-wrap gap-s-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Rechercher par N° MED, patient, pharmacie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-s-2">
          <CalendarDays className="h-4 w-4 text-ink-3 shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-12 rounded-sm border border-line bg-surface px-s-3 text-sm text-ink focus:outline-none focus:border-primary"
            placeholder="Du"
          />
          <span className="text-ink-3 text-sm">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-12 rounded-sm border border-line bg-surface px-s-3 text-sm text-ink focus:outline-none focus:border-primary"
            placeholder="Au"
          />
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3 text-xs uppercase tracking-wide">
              <th className="px-s-3 py-s-3">N° MED</th>
              <th className="px-s-3 py-s-3 hidden sm:table-cell">Patient</th>
              <th className="px-s-3 py-s-3 hidden md:table-cell">Pharmacie</th>
              <th className="px-s-3 py-s-3 hidden lg:table-cell text-right">Montant</th>
              <th className="px-s-3 py-s-3">Statut</th>
              <th className="px-s-3 py-s-3 hidden sm:table-cell">Date</th>
              <th className="px-s-3 py-s-3" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array(7).fill(0).map((__, j) => (
                      <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-s-3 py-s-8 text-center text-ink-3">Aucune commande trouvée</td>
                  </tr>
                )
                : rows.map(r => (
                  <tr key={r.id} className="border-b border-line hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-mono text-xs font-medium text-ink">{r.reference ?? r.id}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden sm:table-cell">{r.patient?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden md:table-cell">{r.pharmacy?.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-right hidden lg:table-cell text-ink">
                      {r.total_amount != null ? `${r.total_amount.toLocaleString('fr-FR')} FCFA` : '—'}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <Badge variant={statusVariant(r.status)}>{r.status ?? '—'}</Badge>
                    </td>
                    <td className="px-s-3 py-s-3 text-ink-3 hidden sm:table-cell">{fmt(r.created_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <Link to={`/admin/commandes/${r.id}`}>
                        <Button variant="ghost" size="sm">Voir</Button>
                      </Link>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>

      <Pagination page={page} pages={pages} total={total} onChange={setPage} />
    </div>
  )
}

function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm text-ink-2">
      <span>{total} commande{total !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-s-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>Page {page + 1} / {pages}</span>
        <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => onChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  useAdminAudit('commandes')

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Commandes</h1>
        <p className="text-sm text-ink-3">Gestion des réservations pharmacie</p>
      </div>

      <Tabs defaultValue="all">
        <div className="overflow-x-auto pb-s-1">
          <TabsList className="flex-nowrap whitespace-nowrap h-auto">
            {TAB_CONFIGS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TAB_CONFIGS.map(tab => (
          <TabsContent key={tab.id} value={tab.id}>
            <OrdersTab tabConfig={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
