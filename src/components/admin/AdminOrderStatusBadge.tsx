import {
  adminOrderKindClasses,
  formatAdminOrderStatusLabel,
  getAdminOrderVisualKind,
} from '@/lib/admin-order-badges'

export function AdminOrderStatusBadge({
  status,
  printedAt,
  showStatusText = true,
}: {
  status: string
  printedAt?: string | Date | null
  showStatusText?: boolean
}) {
  const kind = getAdminOrderVisualKind(status, printedAt)
  const classes = adminOrderKindClasses(kind)

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showStatusText && (
        <span className="rounded px-2 py-0.5 text-xs font-medium bg-[var(--border)]/60 text-foreground">
          {formatAdminOrderStatusLabel(status)}
        </span>
      )}
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${classes.badge}`}>
        {classes.label}
      </span>
    </span>
  )
}
