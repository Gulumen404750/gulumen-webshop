import {
  formatAdminOrderStatusLabel,
  getOrderPrintBadgeStyles,
  hasShippingAddressChanged,
  isOrderPrinted,
} from '@/lib/admin-order-badges'
import { INTERNAL_POINTS_PAYMENT_LABEL, orderUsedInternalPoints } from '@/lib/order-points-accounting'
import { Flame } from 'lucide-react'

export function AdminOrderStatusBadge({
  status,
  printedAt,
  shippingAddressChangedAt,
  showStatusText = true,
  pointsUsed,
  pointsDiscountHuf,
}: {
  status: string
  printedAt?: string | Date | null
  shippingAddressChangedAt?: string | Date | null
  showStatusText?: boolean
  pointsUsed?: number | null
  pointsDiscountHuf?: number | null
}) {
  const printed = isOrderPrinted(printedAt)
  const printBadge = getOrderPrintBadgeStyles(printed)
  const addressChanged = hasShippingAddressChanged(shippingAddressChangedAt)
  const internalPoints = orderUsedInternalPoints({ pointsUsed, pointsDiscountHuf })

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
      {internalPoints && (
        <span
          className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200"
          title="Belső elszámolás – nem pénzbeni profit"
        >
          {INTERNAL_POINTS_PAYMENT_LABEL}
        </span>
      )}
      {addressChanged && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200"
          title="A vásárló módosította a szállítási címet"
        >
          <Flame className="h-3.5 w-3.5" aria-hidden />
          Cím módosítva
        </span>
      )}
    </span>
  )
}
