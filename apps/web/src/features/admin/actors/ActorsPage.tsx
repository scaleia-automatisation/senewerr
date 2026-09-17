import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusPill } from '@/components/ui/StatusPill'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 20

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'to_verify', label: 'À vérifier' },
]

const verifOptions = [
  { value: '', label: 'Toute vérif.' },
  { value: 'pending', label: 'En attente' },
  { value: 'verified', label: 'Vérifié' },
  { value: 'rejected', label: 'Rejeté' },
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Patients tab ──────────────────────────────────────────────────────────────

function PatientsTab() {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const dSearch = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('profiles')
      .select('id, full_name, email, phone, created_at, status, patients(plan)', { count: 'exact' })
      .eq('role', 'patient')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dSearch) {
      q = q.or(`full_name.ilike.%${dSearch}%,email.ilike.%${dSearch}%,phone.ilike.%${dSearch}%`)
    }
    if (status) q = q.eq('status', status)

    const { data, count } = await q
    setRows(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, dSearch, status])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [dSearch, status])

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex flex-wrap gap-s-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Rechercher par nom, email, téléphone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-48">
          <Select value={status} onValueChange={setStatus} options={statusOptions} />
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3 text-xs uppercase tracking-wide">
              <th className="px-s-3 py-s-3">Nom</th>
              <th className="px-s-3 py-s-3 hidden sm:table-cell">Email</th>
              <th className="px-s-3 py-s-3 hidden md:table-cell">Téléphone</th>
              <th className="px-s-3 py-s-3 hidden lg:table-cell">Plan</th>
              <th className="px-s-3 py-s-3">Statut</th>
              <th className="px-s-3 py-s-3 hidden sm:table-cell">Inscription</th>
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
                    <td colSpan={7} className="px-s-3 py-s-8 text-center text-ink-3">
                      Aucun patient trouvé
                    </td>
                  </tr>
                )
                : rows.map(r => (
                  <tr key={r.id} className="border-b border-line hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-medium text-ink">{r.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden sm:table-cell">{r.email ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden md:table-cell">{r.phone ?? '—'}</td>
                    <td className="px-s-3 py-s-3 hidden lg:table-cell">
                      {r.patients?.[0]?.plan
                        ? <Badge variant="primary">{r.patients[0].plan}</Badge>
                        : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <ActorStatusPill status={r.status} />
                    </td>
                    <td className="px-s-3 py-s-3 text-ink-3 hidden sm:table-cell">{fmt(r.created_at)}</td>
                    <td className="px-s-3 py-s-3">
                      <Link to={`/admin/acteurs/patient/${r.id}`}>
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

// ─── Professionnels tab ────────────────────────────────────────────────────────

function ProsTab() {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verif, setVerif] = useState('')
  const dSearch = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('professionals')
      .select(`
        id, specialty, verification_status, city, plan,
        profiles!inner(id, full_name, email, status)
      `, { count: 'exact' })
      .order('id', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dSearch) {
      q = q.or(`profiles.full_name.ilike.%${dSearch}%,profiles.email.ilike.%${dSearch}%`)
    }
    if (verif) q = q.eq('verification_status', verif)

    const { data, count } = await q
    setRows(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, dSearch, verif])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [dSearch, verif])

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex flex-wrap gap-s-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Rechercher par nom, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-48">
          <Select value={verif} onValueChange={setVerif} options={verifOptions} />
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3 text-xs uppercase tracking-wide">
              <th className="px-s-3 py-s-3">Nom</th>
              <th className="px-s-3 py-s-3">Spécialité</th>
              <th className="px-s-3 py-s-3">Vérification</th>
              <th className="px-s-3 py-s-3 hidden md:table-cell">Ville</th>
              <th className="px-s-3 py-s-3 hidden lg:table-cell">Plan</th>
              <th className="px-s-3 py-s-3" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array(6).fill(0).map((__, j) => (
                      <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-s-3 py-s-8 text-center text-ink-3">
                      Aucun professionnel trouvé
                    </td>
                  </tr>
                )
                : rows.map(r => (
                  <tr key={r.id} className="border-b border-line hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-medium text-ink">{r.profiles?.full_name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2">{r.specialty ?? '—'}</td>
                    <td className="px-s-3 py-s-3">
                      <VerifBadge status={r.verification_status} />
                    </td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden md:table-cell">{r.city ?? '—'}</td>
                    <td className="px-s-3 py-s-3 hidden lg:table-cell">
                      {r.plan ? <Badge variant="primary">{r.plan}</Badge> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <Link to={`/admin/acteurs/professional/${r.id}`}>
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

// ─── Organizations tab (Établissements / Pharmacies / Mutuelles) ───────────────

interface OrgTabProps {
  types: string[]
  actorType: 'establishment' | 'pharmacy' | 'mutual'
}

function OrgTab({ types, actorType }: OrgTabProps) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verif, setVerif] = useState('')
  const dSearch = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('organizations')
      .select('id, name, type, city, verification_status, plan', { count: 'exact' })
      .in('type', types)
      .order('name', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dSearch) {
      q = q.or(`name.ilike.%${dSearch}%,city.ilike.%${dSearch}%`)
    }
    if (verif) q = q.eq('verification_status', verif)

    const { data, count } = await q
    setRows(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, dSearch, verif, types])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [dSearch, verif])

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-s-4">
      <div className="flex flex-wrap gap-s-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Rechercher par nom, ville…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-48">
          <Select value={verif} onValueChange={setVerif} options={verifOptions} />
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-3 text-xs uppercase tracking-wide">
              <th className="px-s-3 py-s-3">Nom</th>
              <th className="px-s-3 py-s-3">Type</th>
              <th className="px-s-3 py-s-3 hidden sm:table-cell">Ville</th>
              <th className="px-s-3 py-s-3">Vérification</th>
              <th className="px-s-3 py-s-3 hidden lg:table-cell">Plan</th>
              <th className="px-s-3 py-s-3" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {Array(6).fill(0).map((__, j) => (
                      <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="px-s-3 py-s-8 text-center text-ink-3">
                      Aucun résultat trouvé
                    </td>
                  </tr>
                )
                : rows.map(r => (
                  <tr key={r.id} className="border-b border-line hover:bg-surface-2 transition-colors">
                    <td className="px-s-3 py-s-3 font-medium text-ink">{r.name ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 capitalize">{r.type ?? '—'}</td>
                    <td className="px-s-3 py-s-3 text-ink-2 hidden sm:table-cell">{r.city ?? '—'}</td>
                    <td className="px-s-3 py-s-3">
                      <VerifBadge status={r.verification_status} />
                    </td>
                    <td className="px-s-3 py-s-3 hidden lg:table-cell">
                      {r.plan ? <Badge variant="primary">{r.plan}</Badge> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-s-3 py-s-3">
                      <Link to={`/admin/acteurs/${actorType}/${r.id}`}>
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

// ─── Shared sub-components ─────────────────────────────────────────────────────

function ActorStatusPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-ink-3">—</span>
  const map: Record<string, { pill: 'success' | 'pending' | 'danger' | 'neutral'; label: string }> = {
    active:    { pill: 'success', label: 'Actif' },
    inactive:  { pill: 'neutral', label: 'Inactif' },
    suspended: { pill: 'danger', label: 'Suspendu' },
    to_verify: { pill: 'pending', label: 'À vérifier' },
  }
  const m = map[status] ?? { pill: 'neutral' as const, label: status }
  return <StatusPill status={m.pill} label={m.label} />
}

function VerifBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-ink-3">—</span>
  const map: Record<string, 'pending' | 'success' | 'danger' | 'neutral'> = {
    pending:  'pending',
    verified: 'success',
    rejected: 'danger',
  }
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>
}

interface PaginationProps { page: number; pages: number; total: number; onChange: (p: number) => void }
function Pagination({ page, pages, total, onChange }: PaginationProps) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm text-ink-2">
      <span>{total} résultat{total !== 1 ? 's' : ''}</span>
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ActorsPage() {
  useAdminAudit('acteurs')

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div>
        <h1 className="text-h2 font-display text-ink">Acteurs</h1>
        <p className="text-sm text-ink-3">Gestion de tous les acteurs de la plateforme</p>
      </div>

      <Tabs defaultValue="patients">
        <TabsList className="flex-wrap h-auto gap-y-s-1">
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="pros">Professionnels</TabsTrigger>
          <TabsTrigger value="etablissements">Établissements</TabsTrigger>
          <TabsTrigger value="pharmacies">Pharmacies</TabsTrigger>
          <TabsTrigger value="mutuelles">Mutuelles</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          <PatientsTab />
        </TabsContent>

        <TabsContent value="pros">
          <ProsTab />
        </TabsContent>

        <TabsContent value="etablissements">
          <OrgTab types={['clinic', 'hospital']} actorType="establishment" />
        </TabsContent>

        <TabsContent value="pharmacies">
          <OrgTab types={['pharmacy']} actorType="pharmacy" />
        </TabsContent>

        <TabsContent value="mutuelles">
          <OrgTab types={['mutual']} actorType="mutual" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
