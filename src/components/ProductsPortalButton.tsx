'use client'

import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'

/**
 * Profil: arany Termékek gomb – közvetlen ugrás a kínálatra, kapu-effekt nélkül.
 */
export function ProductsPortalButton() {
  const { t } = useLocale()
  return (
    <Link
      href="/termekek"
      className="products-gold-cta shrink-0 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-heading font-bold text-sm sm:text-base"
      aria-label={t('profile.productsPortalAria')}
    >
      <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
      <span>{t('nav.products')}</span>
    </Link>
  )
}
