/**
 * Admin rendeléslista / részletező státusz + nyomtatás színkódok.
 * Lista: isPrinted=false → LILA, isPrinted=true → ZÖLD (teljes sor).
 */

export type AdminOrderVisualKind = 'new_unprinted' | 'printed_processing' | 'fulfilled' | 'cancelled' | 'other'

export function isOrderPrinted(printedAt: string | Date | null | undefined): boolean {
  return printedAt != null && printedAt !== ''
}

/**
 * Teljes sávos sorstílus a címkenyomtatási állapot szerint.
 * isPrinted === false → lila; true → zöld.
 */
export function getOrderPrintRowStyles(isPrinted: boolean): string {
  if (!isPrinted) {
    return 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-800/50 text-foreground'
  }
  return 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/50 text-foreground'
}

/** Nyomtatási státusz badge (lila / zöld). */
export function getOrderPrintBadgeStyles(isPrinted: boolean): { className: string; label: string } {
  if (!isPrinted) {
    return {
      className: 'bg-purple-500/10 text-purple-300 border-purple-500/40',
      label: 'Új – címke vár',
    }
  }
  return {
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    label: 'Címke kinyomtatva',
  }
}

export function getAdminOrderVisualKind(status: string, printedAt: string | Date | null | undefined): AdminOrderVisualKind {
  const cancelled =
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'expired' ||
    status === 'sourcing_failed'

  if (cancelled) return 'cancelled'
  if (isOrderPrinted(printedAt)) {
    if (status === 'fulfilled') return 'fulfilled'
    return 'printed_processing'
  }
  if (status === 'fulfilled') return 'fulfilled'
  if (
    status === 'paid' ||
    status === 'sourcing_pending' ||
    status === 'payment_pending' ||
    status === 'pending' ||
    status === 'created' ||
    status === 'needs_manual_review'
  ) {
    return 'new_unprinted'
  }
  return 'other'
}

/** Tailwind osztályok a sorháttérhez / badge-hez (részletező + legacy). */
export function adminOrderKindClasses(kind: AdminOrderVisualKind): {
  row: string
  badge: string
  label: string
} {
  switch (kind) {
    case 'new_unprinted':
      return {
        row: getOrderPrintRowStyles(false),
        badge: getOrderPrintBadgeStyles(false).className,
        label: getOrderPrintBadgeStyles(false).label,
      }
    case 'printed_processing':
      return {
        row: getOrderPrintRowStyles(true),
        badge: getOrderPrintBadgeStyles(true).className,
        label: getOrderPrintBadgeStyles(true).label,
      }
    case 'fulfilled':
      return {
        row: getOrderPrintRowStyles(true),
        badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
        label: 'Teljesítve ✓',
      }
    case 'cancelled':
      return {
        row: 'bg-red-950/30 hover:bg-red-900/40 border-red-800/40 text-foreground',
        badge: 'bg-red-500/10 text-red-300 border-red-500/40',
        label: 'Törölve / sikertelen',
      }
    default:
      return {
        row: 'bg-[var(--border)]/40 border-[var(--border)]',
        badge: 'bg-[var(--border)] text-foreground border-[var(--border)]',
        label: 'Egyéb',
      }
  }
}

export function formatAdminOrderStatusLabel(status: string): string {
  const map: Record<string, string> = {
    payment_pending: 'Fizetés folyamatban',
    paid: 'Fizetve',
    fulfilled: 'Teljesítve',
    cancelled: 'Törölve',
    failed: 'Sikertelen',
    expired: 'Lejárt',
    sourcing_pending: 'Beszerzés alatt',
    sourcing_failed: 'Beszerzés sikertelen',
    needs_manual_review: 'Kézi ellenőrzés',
    pending: 'Függőben',
    created: 'Létrehozva',
  }
  return map[status] ?? status
}
