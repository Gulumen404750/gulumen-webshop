/**
 * Admin rendeléslista / részletező státusz + nyomtatás színkódok.
 * Lista: nem nyomtatott = LILA, kinyomtatott = ZÖLD (teljes sor).
 */

export type AdminOrderVisualKind = 'new_unprinted' | 'printed_processing' | 'fulfilled' | 'cancelled' | 'other'

export function getAdminOrderVisualKind(status: string, printedAt: string | Date | null | undefined): AdminOrderVisualKind {
  const cancelled =
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'expired' ||
    status === 'sourcing_failed'

  if (cancelled) return 'cancelled'
  // Nyomtatási állapot elsődleges a lista színkódjához (lila / zöld)
  if (printedAt) {
    if (status === 'fulfilled') return 'fulfilled'
    return 'printed_processing'
  }
  if (status === 'fulfilled') return 'fulfilled'
  // Új, még nem nyomtatott
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

/** Tailwind osztályok a sorháttérhez / badge-hez. */
export function adminOrderKindClasses(kind: AdminOrderVisualKind): {
  row: string
  badge: string
  label: string
} {
  switch (kind) {
    case 'new_unprinted':
      return {
        row: 'bg-violet-400 text-violet-950 dark:bg-violet-600 dark:text-violet-50',
        badge: 'bg-violet-800 text-white dark:bg-violet-950',
        label: 'Új – címke vár',
      }
    case 'printed_processing':
      return {
        row: 'bg-emerald-400 text-emerald-950 dark:bg-emerald-600 dark:text-emerald-50',
        badge: 'bg-emerald-800 text-white dark:bg-emerald-950',
        label: 'Címke kinyomtatva',
      }
    case 'fulfilled':
      return {
        row: 'bg-emerald-200/90 text-emerald-950 dark:bg-emerald-800/70 dark:text-emerald-50',
        badge: 'bg-slate-700 text-white',
        label: 'Teljesítve ✓',
      }
    case 'cancelled':
      return {
        row: 'bg-red-200/90 text-red-950 dark:bg-red-900/50 dark:text-red-50',
        badge: 'bg-red-700 text-white',
        label: 'Törölve / sikertelen',
      }
    default:
      return {
        row: 'bg-[var(--border)]/40',
        badge: 'bg-[var(--border)] text-foreground',
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
