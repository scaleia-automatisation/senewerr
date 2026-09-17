import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  /** Libellé affiché en vue carte mobile (défaut = header) */
  mobileLabel?: string
}

export interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
}

/** Tableau desktop qui devient liste de cartes sous md. */
export function Table<T>({ columns, rows, rowKey, onRowClick, className }: TableProps<T>) {
  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {columns.map(col => (
                <th key={col.key} className="px-s-4 py-s-3 text-left text-small font-semibold text-ink-2">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-2',
                )}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-s-4 py-s-3 text-ink">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile : cartes */}
      <div className="flex flex-col gap-s-3 md:hidden">
        {rows.map(row => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'flex flex-col gap-s-2 rounded-lg border border-line bg-surface p-s-4 shadow-1',
              onRowClick && 'cursor-pointer',
            )}
          >
            {columns.map(col => (
              <div key={col.key} className="flex items-center justify-between gap-s-3">
                <span className="text-small text-ink-3">{col.mobileLabel ?? col.header}</span>
                <span className="text-body text-ink">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
