import {
  formatAdminOrderStatusLabel,
  getOrderPrintBadgeStyles,
  isOrderPrinted,
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
  const printed = isOrderPrinted(printedAt)
  const printBadge = getOrderPrintBadgeStyles(printed)

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {showStatusText && (
        <span className="rounded-full border border-[var(--border)] bg-[var(--border)]/40 px-2 py-0.5 text-xs font-medium text-foreground">
          {formatAdminOrderStatusLabel(status)}
        </span>
      )}
      <span
        className={`rounded-full border px-2 py-1 text-xs font-medium ${printBadge.className}`}
      >
        {printBadge.label}
      </span>
    </span>
  )
}
