'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus } from '@/lib/data'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useLocale } from '@/context/LocaleContext'

/** Formátum: DD:HH:MM:SS */
function formatCountdownDDHHMMSS(ms: number): string {
  if (ms <= 0) return '00:00:00:00'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return [
    String(d).padStart(2, '0'),
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':')
}

export function SourcingDealCardCountdown({ product }: { product: Product }) {
  const { t } = useLocale()
  const { getOrdersCount } = useSourcingDealOrders()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (product.type !== 'sourcing_deal') return null

  if (now === null) return null

  const effectiveCount = (product.ordersCount ?? 0) + getOrdersCount(product.id)
  const status = getSourcingDealStatus(product, new Date(now), effectiveCount)

  const saleFrom = product.saleFrom ? new Date(product.saleFrom).getTime() : 0
  const saleTo = product.saleTo ? new Date(product.saleTo).getTime() : 0
  const nowMs = now

  if (status === 'soldout') {
    const available = Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
    const label = available > 0 ? t('sourcing.availableCount', { count: available }) : t('status.soldOut')
    return (
      <div className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center text-sm font-medium rounded-b-xl">
        {label}
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div className="px-3 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-center text-sm font-medium rounded-b-xl">
        {t('status.expired')}
      </div>
    )
  }

  if (status === 'preview' && saleFrom - nowMs > 0) {
    return (
      <div className="px-3 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-center text-sm font-medium border-y border-blue-200 dark:border-blue-800 rounded-b-xl">
        <span className="font-semibold">{t('status.startsIn')}:</span>{' '}
        <span className="tabular-nums">{formatCountdownDDHHMMSS(saleFrom - nowMs)}</span>
      </div>
    )
  }

  if (status === 'sale' && saleTo - nowMs > 0) {
    // Kijelzés: mindig a teljes rendelhető mennyiség (maxOrders - ordersCount). A kosár ne csökkentse.
    const displayAvailable = Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
    return (
      <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-center text-sm font-semibold border-y border-red-200 dark:border-red-800 rounded-b-xl">
        <div>
          <span>{t('status.endsIn')}:</span>{' '}
          <span className="tabular-nums">{formatCountdownDDHHMMSS(saleTo - nowMs)}</span>
        </div>
        {displayAvailable >= 0 && (
          <div className="text-xs font-medium mt-0.5 opacity-90">
            {t('sourcing.availableCount', { count: displayAvailable })}
          </div>
        )}
      </div>
    )
  }

  return null
}
