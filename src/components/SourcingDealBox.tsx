'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/data'
import {
  getSourcingDealStatus,
  getTimedPurchaseStatus,
  getAddToCartReason,
  getMaxQty,
} from '@/lib/data'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useCart } from '@/context/CartContext'
import { useLocale } from '@/context/LocaleContext'
import { useToast } from '@/context/ToastContext'
import { useEuroRate } from '@/context/EuroRateContext'

function formatCountdown(ms: number, format: (days: number, time: string) => string): string {
  const total = Math.max(0, ms)
  const d = Math.floor(total / 86400000)
  const h = Math.floor((total % 86400000) / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return format(d, time)
}

/** SSR és első kliens render: stabil placeholder, hogy ne legyen hydration mismatch. */
const COUNTDOWN_PLACEHOLDER = '—'

/** Ha a termék lejár/elfogy (EXPIRED), onExpired egyszer meghívódik – pl. termékoldalon animáció a kép fölött. */
export function SourcingDealBox({
  product,
  serverNow,
  onExpired,
}: {
  product: Product
  serverNow?: number
  onExpired?: () => void
}) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const { toast } = useToast()
  const { placeOrder } = useSourcingDealOrders()
  const { addItem, items } = useCart()
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const offsetMsRef = useRef<number | null>(null)
  const initializedRef = useRef(false)
  const onExpiredFiredRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current && serverNow != null) {
      offsetMsRef.current = serverNow - Date.now()
      initializedRef.current = true
    }
    if (offsetMsRef.current === null) {
      offsetMsRef.current = 0
    }
    const getAdjustedNow = () => new Date(Date.now() + (offsetMsRef.current ?? 0))
    setMounted(true)
    setNow(getAdjustedNow())
    const id = setInterval(() => setNow(getAdjustedNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const cartQty = items.find((x) => x.productId === product.id)?.qty ?? 0
  /** Szerveren már rendelt + kosárban lévő (dupla számolás nélkül). */
  const serverOrdersCount = product.ordersCount ?? 0
  const effectiveCount = serverOrdersCount + cartQty
  const nowOrEpoch = now ?? new Date(0)
  const status = getSourcingDealStatus(product, nowOrEpoch, effectiveCount)
  const timedStatus = getTimedPurchaseStatus(product, nowOrEpoch, effectiveCount)
  const { canAdd, reasonKey, reasonParams } = getAddToCartReason(
    product,
    nowOrEpoch,
    effectiveCount,
    locale
  )
  const reason = reasonKey ? t(reasonKey, reasonParams) : ''
  const maxOrders = product.maxOrders ?? 0
  /** Rendelhető még (szerver alapján); kosár mennyisége külön jelzés. */
  const displayAvailable = Math.max(0, maxOrders - serverOrdersCount)
  const maxQty = getMaxQty(product, effectiveCount)
  const [addQty, setAddQty] = useState(1)
  const safeAddQty = maxQty > 0 ? Math.min(Math.max(1, addQty), maxQty) : 1
  const { hufToEur } = useEuroRate()
  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const priceEur = hufToEur(priceHuf)

  if (product.type !== 'sourcing_deal') return null

  const previewFrom = product.previewFrom ? new Date(product.previewFrom).getTime() : 0
  const saleFrom = product.saleFrom ? new Date(product.saleFrom).getTime() : 0
  const saleTo = product.saleTo ? new Date(product.saleTo).getTime() : 0
  const nowMs = now?.getTime() ?? 0
  const countdownToPreview = previewFrom - nowMs
  const countdownToSale = saleFrom - nowMs
  const countdownToEnd = saleTo - nowMs

  const showPlaceholder = !mounted || now === null
  const countdownText = showPlaceholder
    ? COUNTDOWN_PLACEHOLDER
    : formatCountdown(
        !status && countdownToPreview > 0
          ? countdownToPreview
          : status === 'preview' && countdownToSale > 0
            ? countdownToSale
            : status === 'sale' && countdownToEnd > 0
              ? countdownToEnd
              : 0,
        (days, time) => t('status.countdownDays', { days, time })
      )

  if (timedStatus === 'EXPIRED' && onExpired && !onExpiredFiredRef.current) {
    onExpiredFiredRef.current = true
    onExpired()
  }

  const statusLabel =
    timedStatus === 'EXPIRED'
      ? status === 'soldout'
        ? t('sourcing.soldoutLabel')
        : t('sourcing.closedLabel')
      : timedStatus === 'NOT_STARTED'
        ? t('sourcing.previewLabel')
        : t('sourcing.saleLabel')

  const handleAddToCart = () => {
    if (!canAdd || timedStatus !== 'ACTIVE') return
    if (maxQty < 1) {
      toast(t('sourcing.availableCount', { count: displayAvailable }))
      return
    }
    placeOrder(product.id, safeAddQty)
    addItem(product.id, safeAddQty, undefined, product)
    router.push('/kosar')
  }

  const saleFromDate = product.saleFrom ? new Date(product.saleFrom) : null
  const availableFromLabel =
    saleFromDate?.toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 p-4 sm:p-5">
        <p className="font-heading font-semibold text-foreground mb-2">{statusLabel}</p>
        {timedStatus === 'NOT_STARTED' && (
          <p className="text-sm text-muted mb-1">
            {status === 'preview'
              ? t('sourcing.previewStarts')
              : t('sourcing.availableFromLabel', { when: availableFromLabel })}{' '}
            <strong className="text-foreground">{countdownText}</strong>
          </p>
        )}
        {status === 'sale' && countdownToEnd > 0 && (
          <p className="text-sm text-muted mb-1">
            {t('sourcing.remaining')} <strong className="text-foreground">{countdownText}</strong>
          </p>
        )}
        {timedStatus === 'EXPIRED' && (
          <p className="text-sm text-muted mb-1 font-medium">{t('sourcing.expiredShort')}</p>
        )}
        {(status === 'sale' || status === 'soldout' || status === 'closed') && (
          <p className="text-sm text-muted">
            {t('sourcing.availableCount', { count: displayAvailable })}
            {cartQty > 0 && (
              <span className="ml-1">({t('product.inCartCount', { count: cartQty })})</span>
            )}
          </p>
        )}
        <p className="text-sm text-muted mt-2">
          {t('sourcing.shippingNote')} <strong className="text-foreground">{t('sourcing.shippingDays')}</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {timedStatus === 'EXPIRED' && (
          <button
            type="button"
            disabled
            className="px-6 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed text-left"
          >
            {t('sourcing.expiredShort')}
          </button>
        )}
        {timedStatus === 'NOT_STARTED' && !canAdd && (
          <button
            type="button"
            disabled
            className="px-6 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed text-left"
          >
            {reason || t('sourcing.availableFromLabel', { when: availableFromLabel })}
          </button>
        )}
        {timedStatus === 'ACTIVE' && !canAdd && (
          <button
            type="button"
            disabled
            className="px-6 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed text-left"
          >
            {reason || t('status.notAvailable')}
          </button>
        )}
        {canAdd && timedStatus === 'ACTIVE' && maxQty === 0 && (
          <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">
            {t('product.maxInCart')}
          </p>
        )}
        {canAdd && timedStatus === 'ACTIVE' && maxQty > 0 && (
          <>
            <label htmlFor="sourcing-qty" className="text-sm font-medium text-foreground">
              {t('product.quantity')}:
            </label>
            <select
              id="sourcing-qty"
              value={safeAddQty}
              onChange={(e) => setAddQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-foreground min-w-[4rem] dark:bg-[var(--card-bg)]"
            >
              {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddToCart}
              className="px-6 py-3 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('buttons.orderSourcing')}
            </button>
          </>
        )}
      </div>

      <p className="text-sm text-muted italic whitespace-pre-line">{t('sourcing.legal')}</p>
    </div>
  )
}
