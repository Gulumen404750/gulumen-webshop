'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/data'
import { getSourcingDealStatus, getAddToCartReason, getMaxQty } from '@/lib/data'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useCart } from '@/context/CartContext'
import { useLocale } from '@/context/LocaleContext'
import { useToast } from '@/context/ToastContext'
import { useEuroRate } from '@/context/EuroRateContext'

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0 nap 00:00:00'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${d} nap ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function SourcingDealBox({ product }: { product: Product }) {
  const { t } = useLocale()
  const router = useRouter()
  const { toast } = useToast()
  const { getOrdersCount, placeOrder } = useSourcingDealOrders()
  const { addItem } = useCart()
  const [now, setNow] = useState(() => new Date())

  const effectiveCount = (product.ordersCount ?? 0) + getOrdersCount(product.id)
  const status = getSourcingDealStatus(product, now, effectiveCount)
  const { canAdd, reasonKey, reasonParams } = getAddToCartReason(product, now, effectiveCount)
  const reason = reasonKey ? t(reasonKey, reasonParams) : ''
  const maxOrders = product.maxOrders ?? 0
  // Kijelzés: mindig a teljes rendelhető mennyiség (maxOrders - ordersCount). A kosár ne csökkentse.
  const displayAvailable = Math.max(0, maxOrders - (product.ordersCount ?? 0))
  const maxQty = getMaxQty(product, effectiveCount)
  const [addQty, setAddQty] = useState(1)
  const safeAddQty = maxQty > 0 ? Math.min(Math.max(1, addQty), maxQty) : 1
  const { hufToEur } = useEuroRate()
  const priceHuf = product.discountPriceHuf ?? product.priceHuf
  const priceEur = hufToEur(priceHuf)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (product.type !== 'sourcing_deal') return null

  const previewFrom = product.previewFrom ? new Date(product.previewFrom).getTime() : 0
  const saleFrom = product.saleFrom ? new Date(product.saleFrom).getTime() : 0
  const saleTo = product.saleTo ? new Date(product.saleTo).getTime() : 0
  const nowMs = now.getTime()
  const countdownToPreview = previewFrom - nowMs
  const countdownToSale = saleFrom - nowMs
  const countdownToEnd = saleTo - nowMs

  const statusLabel =
    !status && countdownToPreview > 0
      ? t('sourcing.previewLabel')
      : status === 'preview'
        ? t('sourcing.previewLabel')
        : status === 'sale'
          ? t('sourcing.saleLabel')
          : status === 'soldout'
            ? t('sourcing.soldoutLabel')
            : t('sourcing.closedLabel')

  const handleAddToCart = () => {
    if (!canAdd) return
    if (maxQty < 1) {
      toast(t('sourcing.availableCount', { count: displayAvailable }))
      return
    }
    placeOrder(product.id, safeAddQty)
    addItem(product.id, safeAddQty)
    router.push('/kosar')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 p-4 sm:p-5">
        <p className="font-heading font-semibold text-foreground mb-2">{statusLabel}</p>
        {!status && countdownToPreview > 0 && (
          <p className="text-sm text-muted mb-1">
            {t('sourcing.saleStarts')} <strong className="text-foreground">{formatCountdown(countdownToPreview)}</strong>
          </p>
        )}
        {status === 'preview' && countdownToSale > 0 && (
          <p className="text-sm text-muted mb-1">
            {t('sourcing.previewStarts')} <strong className="text-foreground">{formatCountdown(countdownToSale)}</strong>
          </p>
        )}
        {status === 'sale' && countdownToEnd > 0 && (
          <p className="text-sm text-muted mb-1">
            {t('sourcing.remaining')} <strong className="text-foreground">{formatCountdown(countdownToEnd)}</strong>
          </p>
        )}
        {(status === 'sale' || status === 'soldout' || status === 'closed') && (
          <p className="text-sm text-muted">
            {t('sourcing.availableCount', { count: displayAvailable })}
          </p>
        )}
        <p className="text-sm text-muted mt-2">
          {t('sourcing.shippingNote')} <strong className="text-foreground">{t('sourcing.shippingDays')}</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {!canAdd && (
          <button
            type="button"
            disabled
            className="px-6 py-3 rounded-lg bg-[var(--border)] text-muted font-heading font-semibold cursor-not-allowed text-left"
          >
            {reason || t('status.notAvailable')}
          </button>
        )}
        {canAdd && maxQty > 0 && (
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

      <p className="text-sm text-muted italic">{t('sourcing.legal')}</p>
    </div>
  )
}
