'use client'

import Link from 'next/link'
import { useCart } from '@/context/CartContext'
import { useLocale } from '@/context/LocaleContext'

/**
 * Mobil (< md): a Header alatt sticky sáv, ha van tétel a kosárban.
 * Felül rögzített – nem ütközik az alsó lebegő gombokkal (AI jobb, CallUs bal).
 */
export function MobileCartStickyBanner() {
  const { itemCount, totalHuf } = useCart()
  const { t } = useLocale()

  if (itemCount <= 0) return null

  const formattedTotal = totalHuf.toLocaleString('hu-HU')

  return (
    <div
      className="md:hidden sticky top-16 z-40 border-b border-[var(--border)] bg-[var(--card-bg)]/95 backdrop-blur-sm shadow-sm"
      role="region"
      aria-label={t('cart.mobileStickyBannerAria')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 py-2.5">
        <p className="text-sm text-foreground min-w-0 truncate">
          {t('cart.mobileStickyBanner', { count: itemCount, total: formattedTotal })}
        </p>
        <Link
          href="/kosar"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-heading font-semibold text-white hover:opacity-90 transition-opacity"
        >
          {t('common.cart')}
        </Link>
      </div>
    </div>
  )
}
