'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useMemo, useState } from 'react'
import { getProductById, getAddToCartReason, getMaxQty, getStockById, getProductName } from '@/lib/data'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useLocale } from '@/context/LocaleContext'
import { useToast } from '@/context/ToastContext'
import { useEuroRate } from '@/context/EuroRateContext'

export default function CartPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { items, addItem, removeItem, updateQty, clearCart, subtotalHuf, discountHuf, totalHuf, isDiscountActive } = useCart()
  const { t, locale } = useLocale()
  const { toast } = useToast()
  const { hufToEur, formatEur } = useEuroRate()
  const { markUsed, discountPercent } = useCatCoupon()
  const { getOrdersCount, placeOrder, cancelOrder } = useSourcingDealOrders()
  const processedAddIdRef = useRef<string | null>(null)
  const [showSourcingDisclaimer, setShowSourcingDisclaimer] = useState(false)
  const [acceptedSourcingDisclaimer, setAcceptedSourcingDisclaimer] = useState(false)
  const disclaimerRef = useRef<HTMLDivElement>(null)

  const { stockItems, sourcingItems } = useMemo(() => {
    const stock: typeof items = []
    const sourcing: typeof items = []
    for (const item of items) {
      const product = getProductById(item.productId)
      if (product?.type === 'sourcing_deal') sourcing.push(item)
      else stock.push(item)
    }
    return { stockItems: stock, sourcingItems: sourcing }
  }, [items])

  const hasSourcingItems = sourcingItems.length > 0

  const { subtotalEur, discountEur, totalEur } = useMemo(() => {
    const subEur = hufToEur(subtotalHuf)
    const discEur = hufToEur(discountHuf)
    return {
      subtotalEur: subEur,
      discountEur: discEur,
      totalEur: hufToEur(totalHuf),
    }
  }, [subtotalHuf, discountHuf, totalHuf, hufToEur])

  useEffect(() => {
    const addId = searchParams.get('add')
    if (!addId) {
      processedAddIdRef.current = null
      return
    }
    if (processedAddIdRef.current === addId) return
    const product = getProductById(addId)
    if (!product) return
    const priceHuf = product.discountPriceHuf ?? product.priceHuf
    const priceEur = product.discountPriceEur ?? product.priceEur
    const type = product.type === 'sourcing_deal' ? 'sourcing_deal' : 'stock'
    const ordersOverride = product.type === 'sourcing_deal' ? (product.ordersCount ?? 0) + getOrdersCount(product.id) : undefined
    const { canAdd } = getAddToCartReason(product, new Date(), ordersOverride)
    if (!canAdd) return
    const maxQty =
      product.type === 'sourcing_deal'
        ? getMaxQty(product, ordersOverride)
        : getStockById(product.id)
    const currentQty = items.find((x) => x.productId === product.id)?.qty ?? 0
    if (currentQty >= maxQty) {
      const maxAllowed = product?.type === 'sourcing_deal'
        ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
        : getStockById(product.id)
      toast(product?.type === 'sourcing_deal' ? t('sourcing.availableCount', { count: maxAllowed }) : t('product.inStockCount', { count: maxAllowed }))
      router.replace('/kosar')
      return
    }
    processedAddIdRef.current = addId
    const requestedQty = Math.max(1, parseInt(searchParams.get('qty') || '1', 10) || 1)
    const addQty = Math.min(requestedQty, maxQty - currentQty)
    addItem(product.id, addQty)
    router.replace('/kosar')
  }, [searchParams, router, addItem, getOrdersCount, items, t, toast])

  const handleCompleteOrder = () => {
    let corrected = false
    for (const item of items) {
      const product = getProductById(item.productId)
      const isSourcingOrder = product?.type === 'sourcing_deal'
      const maxAllowedInCart = isSourcingOrder && product
        ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
        : getStockById(item.productId)
      if (item.qty > maxAllowedInCart) {
        corrected = true
        updateQty(item.productId, maxAllowedInCart)
        toast(t('cart.stockChangedAvailable', { count: maxAllowedInCart }))
      }
    }
    if (corrected) return
    router.push('/fizetes')
  }

  const handleCheckoutClick = () => {
    if (hasSourcingItems && !showSourcingDisclaimer) {
      setShowSourcingDisclaimer(true)
      setTimeout(() => disclaimerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
      return
    }
    handleCompleteOrder()
  }

  const justOrdered = searchParams.get('ordered') === '1'
  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('cart.title')}</h1>
        {justOrdered ? (
          <p className="text-foreground mb-4">{t('cart.thanksOrder')}</p>
        ) : (
          <p className="text-muted mb-4">{t('cart.empty')}</p>
        )}
        <Link href="/termekek" className="inline-block text-accent font-medium hover:underline">
          {t('buttons.browseProducts')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('cart.title')}</h1>

      {stockItems.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{t('cart.blockStockTitle')}</h2>
          <p className="text-sm text-muted mb-3">{t('cart.blockStockDispatch')}</p>
          <ul className="space-y-4">
            {stockItems.map((item) => {
              const product = getProductById(item.productId)
              const maxAllowedInCart = getStockById(item.productId)
              const priceHuf = product ? (product.discountPriceHuf ?? product.priceHuf) : 0
              const priceEur = hufToEur(priceHuf)
              const img = product?.image?.startsWith('/') ? product.image : ''
              return (
                <li key={item.productId} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                    {img ? (
                      <Image src={img} alt={product ? getProductName(product, locale) : ''} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">{t('product.noImage')}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{product ? getProductName(product, locale) : item.productId}</p>
                    <p className="text-muted text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft × {item.qty}
                      {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
                    </p>
                    <p className="text-foreground text-sm font-medium mt-1">{t('cart.availableUpTo', { count: maxAllowedInCart })}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
                      <button
                        type="button"
                        onClick={() => { if (item.qty <= 1) return; updateQty(item.productId, item.qty - 1) }}
                        disabled={item.qty <= 1}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.decreaseQty')}
                      >−</button>
                      <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => { if (item.qty >= maxAllowedInCart) return; updateQty(item.productId, item.qty + 1) }}
                        disabled={item.qty >= maxAllowedInCart}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.increaseQty')}
                      >+</button>
                    </div>
                    <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
                    <button type="button" onClick={() => removeItem(item.productId)} className="text-muted hover:text-red-600 text-sm font-medium">{t('cart.remove')}</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {sourcingItems.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{t('cart.blockSourcingTitle')}</h2>
          <p className="text-sm text-muted mb-3">{t('cart.blockSourcingDelivery')}</p>
          <ul className="space-y-4">
            {sourcingItems.map((item) => {
              const product = getProductById(item.productId)
              const maxAllowedInCart = product ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0)) : 0
              const priceHuf = product ? (product.discountPriceHuf ?? product.priceHuf) : 0
              const priceEur = hufToEur(priceHuf)
              const img = product?.image?.startsWith('/') ? product.image : ''
              return (
                <li key={item.productId} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                    {img ? (
                      <Image src={img} alt={product ? getProductName(product, locale) : ''} fill className="object-cover" sizes="80px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">{t('product.noImage')}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{product ? getProductName(product, locale) : item.productId}</p>
                    <p className="text-muted text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft × {item.qty}
                      {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
                    </p>
                    <p className="text-foreground text-sm font-medium mt-1">{t('cart.availableUpTo', { count: maxAllowedInCart })}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
                      <button
                        type="button"
                        onClick={() => { if (item.qty <= 1) return; updateQty(item.productId, item.qty - 1); cancelOrder(item.productId, 1) }}
                        disabled={item.qty <= 1}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.decreaseQty')}
                      >−</button>
                      <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => { if (item.qty >= maxAllowedInCart) return; updateQty(item.productId, item.qty + 1); placeOrder(item.productId, 1) }}
                        disabled={item.qty >= maxAllowedInCart}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.increaseQty')}
                      >+</button>
                    </div>
                    <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
                    <button type="button" onClick={() => { cancelOrder(item.productId, item.qty); removeItem(item.productId) }} className="text-muted hover:text-red-600 text-sm font-medium">{t('cart.remove')}</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted mb-4">{t('cart.deliveryNote')}</p>
      {hasSourcingItems && showSourcingDisclaimer && (
        <div ref={disclaimerRef} className="mb-6 p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
          <label className="flex gap-3 cursor-pointer items-start">
            <input
              type="checkbox"
              checked={acceptedSourcingDisclaimer}
              onChange={(e) => setAcceptedSourcingDisclaimer(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
              aria-describedby="sourcing-disclaimer-text"
            />
            <span id="sourcing-disclaimer-text" className="text-sm text-foreground">
              {t('cart.sourcingDisclaimerAccept')}
            </span>
          </label>
        </div>
      )}
      <div className="border-t border-[var(--border)] pt-6 space-y-2">
        <div className="flex justify-between text-foreground">
          <span>{t('cart.subtotal')}</span>
          <span>{subtotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(subtotalEur)})</span></span>
        </div>
        {isDiscountActive && discountHuf > 0 && (
          <div className="flex justify-between text-discount">
            <span>{t('cart.discountLabel', { percent: Math.round(discountPercent * 100) })}</span>
            <span>−{discountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(discountEur)})</span></span>
          </div>
        )}
        <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2">
          <span>{t('cart.total')}</span>
          <span>{totalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(totalEur)})</span></span>
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={handleCheckoutClick}
          disabled={hasSourcingItems && showSourcingDisclaimer && !acceptedSourcingDisclaimer}
          className="py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('buttons.checkout')}
        </button>
        <Link
          href="/termekek"
          className="py-3 px-6 border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] text-center transition-colors"
        >
          {t('buttons.continueShopping')}
        </Link>
      </div>
    </div>
  )
}
