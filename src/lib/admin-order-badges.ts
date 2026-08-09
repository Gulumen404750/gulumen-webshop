/**
 * Admin rendeléslista / részletező státusz + nyomtatás színkódok.
 */

export type AdminOrderVisualKind = 'new_unprinted' | 'printed_processing' | 'fulfilled' | 'cancelled' | 'other'

export function getAdminOrderVisualKind(status: string, printedAt: string | Date | null | undefined): AdminOrderVisualKind {
  const cancelled =
    status === 'cancelled' ||
    status === 'failed' ||
    status === 'expired' ||
    status === 'sourcing_failed'

  if (cancelled) return 'cancelled'
  // Feladott / teljesített: szürke–zöld
  if (status === 'fulfilled') return 'fulfilled'
  // Kinyomtatott, még feldolgozás alatt
  if (printedAt) return 'printed_processing'
  // Új, még nem nyomtatott (fizetett / beszerzés / fizetés alatt)
  if (status === 'paid' || status === 'sourcing_pending' || status === 'payment_pending') {
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
        row: 'bg-emerald-50/80 dark:bg-emerald-950/25',
        badge: 'bg-emerald-600 text-white',
        label: 'Új – címke vár',
      }
    case 'printed_processing':
      return {
        row: 'bg-amber-50/80 dark:bg-amber-950/20',
        badge: 'bg-amber-500 text-white',
        label: 'Címke kinyomtatva',
      }
    case 'fulfilled':
      return {
        row: 'bg-slate-50/80 dark:bg-slate-900/40',
        badge: 'bg-slate-600 text-white',
        label: 'Teljesítve ✓',
      }
    case 'cancelled':
      return {
        row: 'bg-red-50/40 dark:bg-red-950/20',
        badge: 'bg-red-600/90 text-white',
        label: 'Törölve / sikertelen',
      }
    default:
      return {
        row: '',
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
