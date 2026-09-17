import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAdminAudit } from '@/features/admin/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Card } from '@/components/ui/Card'
import { Banner } from '@/components/ui/Banner'

const PAGE_SIZE = 50
const fmt = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

type LogResult = 'success' | 'failure' | 'blocked' | string

function resultBadge(r: LogResult): 'success' | 'danger' | 'neutral' {
  if (r === 'success') return 'success'
  if (r === 'failure' || r === 'blocked') return 'danger'
  return 'neutral'
}

interface AuditLog {
  id: string
  created_at: string
  actor_id?: string
  action?: string
  entity_type?: string
  entity_id?: string
  result?: string
  cause?: string
  metadata?: Record<string, unknown>
  actor?: { full_name?: string }
}

export default function AuditPage() {
  useAdminAudit('audit')

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [actorSearch, setActorSearch] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [resultFilter, setResultFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    let q = (supabase as any)
      .from('audit_logs')
      .select('id, created_at, actor_id, action, entity_type, entity_id, result, cause, metadata, actor:profiles(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (actionSearch) q = q.ilike('action', `%${actionSearch}%`)
    if (entityType) q = q.ilike('entity_type', `%${entityType}%`)
    if (entityId) q = q.ilike('entity_id', `%${entityId}%`)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')
    if (resultFilter !== 'all') q = q.eq('result', resultFilter)

    const { data, count } = await q
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, actionSearch, entityType, entityId, dateFrom, dateTo, resultFilter])

  useEffect(() => { load() }, [load])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    setExportError('')
    try {
      const { error } = await (supabase as any).functions.invoke('export-admin-report', {
        body: {
          type: 'audit',
          filters: { actorSearch, actionSearch, entityType, entityId, dateFrom, dateTo, resultFilter },
        },
      })
      if (error) throw error
    } catch (e: any) {
      setExportError(e.message ?? 'Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }, [actorSearch, actionSearch, entityType, entityId, dateFrom, dateTo, resultFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const reset = () => {
    setPage(0)
    setActorSearch('')
    setActionSearch('')
    setEntityType('')
    setEntityId('')
    setDateFrom('')
    setDateTo('')
    setResultFilter('all')
  }

  return (
    <div className="flex flex-col gap-s-5 p-s-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-display text-ink">Journal d'audit</h1>
          <p className="text-sm text-ink-3">{total.toLocaleString('fr-FR')} entrée{total !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="secondary" size="sm" loading={exporting} onClick={exportCsv}>
          Exporter CSV
        </Button>
      </div>

      {exportError && <Banner kind="warning">{exportError}</Banner>}

      {/* Filters */}
      <Card className="p-s-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-3">
          <Input label="Acteur (nom)" placeholder="Recherche…" value={actorSearch} onChange={(e) => { setActorSearch(e.target.value); setPage(0) }} />
          <Input label="Action" placeholder="Recherche…" value={actionSearch} onChange={(e) => { setActionSearch(e.target.value); setPage(0) }} />
          <Input label="Type d'entité" placeholder="ex. commandes" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0) }} />
          <Input label="ID entité" placeholder="uuid…" value={entityId} onChange={(e) => { setEntityId(e.target.value); setPage(0) }} />
          <Input label="Date de" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} />
          <Input label="Date à" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} />
          <Select
            label="Résultat"
            value={resultFilter}
            onValueChange={(v) => { setResultFilter(v); setPage(0) }}
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'success', label: 'Succès' },
              { value: 'failure', label: 'Échec' },
              { value: 'blocked', label: 'Bloqué' },
            ]}
          />
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}>Réinitialiser</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {['Date', 'Acteur', 'Action', 'Entité', 'ID entité', 'Résultat', 'Cause'].map((h) => (
                <th key={h} className="px-s-3 py-s-3 text-left text-xs font-medium text-ink-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array(10).fill(0).map((_, i) => (
                <tr key={i}>{Array(7).fill(0).map((__, j) => <td key={j} className="px-s-3 py-s-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              ))
              : logs.length === 0
                ? <tr><td colSpan={7} className="px-s-3 py-s-6 text-center text-ink-3">Aucun résultat</td></tr>
                : logs
                    .filter((l) => !actorSearch || (l.actor?.full_name ?? '').toLowerCase().includes(actorSearch.toLowerCase()))
                    .map((l) => (
                      <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2 transition-colors">
                        <td className="px-s-3 py-s-3 whitespace-nowrap text-ink-2">{fmt(l.created_at)}</td>
                        <td className="px-s-3 py-s-3">{l.actor?.full_name ?? l.actor_id?.slice(0, 8) ?? '—'}</td>
                        <td className="px-s-3 py-s-3 font-mono text-xs text-ink">{l.action ?? '—'}</td>
                        <td className="px-s-3 py-s-3 text-ink-2">{l.entity_type ?? '—'}</td>
                        <td className="px-s-3 py-s-3 font-mono text-xs text-ink-3">{l.entity_id ? l.entity_id.slice(0, 12) : '—'}</td>
                        <td className="px-s-3 py-s-3">
                          {l.result ? <Badge variant={resultBadge(l.result)}>{l.result}</Badge> : '—'}
                        </td>
                        <td className="px-s-3 py-s-3 text-ink-2 max-w-40 truncate">{l.cause ?? '—'}</td>
                      </tr>
                    ))
            }
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-3">Page {page + 1} / {totalPages}</p>
          <div className="flex gap-s-2">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>
      )}
    </div>
  )
}
