import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface PraticienTableProps<T extends { id: string }> {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyLabel?: string
  className?: string
}

export function PraticienTable<T extends { id: string }>({
  columns, rows, onRowClick, loading = false, emptyLabel = 'Aucune donnée', className,
}: PraticienTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-line', className)}>
      <table className="w-full text-small">
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn('px-s-3 py-s-2 text-left font-semibold text-ink-3', col.className)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map(col => (
                    <td key={col.key} className="px-s-3 py-s-2">
                      <div className="h-4 animate-pulse rounded-sm bg-surface-2" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="px-s-3 py-s-8 text-center text-ink-3">
                      {emptyLabel}
                    </td>
                  </tr>
                )
              : rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-line last:border-0 transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-surface-2' : '',
                    )}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={cn('px-s-3 py-s-2 text-ink', col.className)}>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  )
}
