import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TableColumn<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

interface MutuelleTableProps<T extends Record<string, any>> {
  columns: TableColumn<T>[]
  data: T[]
  pageSize?: number
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

export function MutuelleTable<T extends Record<string, any>>({
  columns, data, pageSize = 20, loading = false, emptyMessage = 'Aucun résultat.', onRowClick,
}: MutuelleTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize)

  function SortIcon({ col }: { col: TableColumn<T> }) {
    if (!col.sortable) return null
    const key = col.key as string
    if (sortKey !== key) return <ChevronsUpDown className="h-3.5 w-3.5 text-ink-3" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary" />
  }

  return (
    <div className="flex flex-col gap-s-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-small">
          <thead className="bg-surface-2 border-b border-line">
            <tr>
              {columns.map(col => (
                <th key={String(col.key)}
                  className={cn('px-s-4 py-s-3 text-left font-semibold text-ink-3', col.className)}
                  onClick={() => col.sortable && toggleSort(col.key as string)}
                >
                  <span className={cn('flex items-center gap-s-1', col.sortable && 'cursor-pointer hover:text-ink')}>
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-s-4 py-s-3">
                      <div className="h-4 rounded bg-surface-2 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-s-4 py-s-12 text-center text-small text-ink-3">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr key={i}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-2/50')}
                  onClick={() => onRowClick?.(row)}>
                  {columns.map(col => (
                    <td key={String(col.key)} className={cn('px-s-4 py-s-3 text-ink', col.className)}>
                      {col.render ? col.render(row) : String(row[col.key as string] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-micro text-ink-3">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} sur {sorted.length}
          </p>
          <div className="flex items-center gap-s-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded p-s-1.5 text-ink-3 hover:bg-surface-2 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-small text-ink">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="rounded p-s-1.5 text-ink-3 hover:bg-surface-2 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
