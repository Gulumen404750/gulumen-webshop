type AdminTableSkeletonProps = {
  columns: number
  rows?: number
  /** Opcionális oszlop-szélesség osztályok (pl. w-24, w-40). */
  columnWidths?: string[]
}

export function AdminTableSkeleton({ columns, rows = 8, columnWidths }: AdminTableSkeletonProps) {
  const cellWidth = (index: number) => columnWidths?.[index] ?? (index === 0 ? 'w-36' : 'w-20')

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[var(--border)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-3">
                <div className={`h-4 bg-[var(--border)] rounded animate-pulse ${cellWidth(i)}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--border)]">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-3">
                  <div
                    className={`h-4 bg-[var(--border)] rounded animate-pulse ${
                      colIndex === columns - 1 ? 'w-24' : cellWidth(colIndex)
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminProductsListSkeleton() {
  return (
    <AdminTableSkeleton
      columns={7}
      rows={10}
      columnWidths={['w-40', 'w-28', 'w-24', 'w-16', 'w-20', 'w-16', 'w-32']}
    />
  )
}

export function AdminOrdersListSkeleton() {
  return (
    <AdminTableSkeleton
      columns={7}
      rows={10}
      columnWidths={['w-28', 'w-24', 'w-16', 'w-20', 'w-36', 'w-32', 'w-20']}
    />
  )
}
