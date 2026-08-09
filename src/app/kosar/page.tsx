'use client'

import Link from 'next/link'
import { SafeProductImage } from '@/components/SafeProductImage'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { getProductById as getProductByIdFromData, getAddToCartReason, getMaxQty, is3DProduct } from '@/lib/data'
import { useCart, type CartItem } from '@/context/CartContext'
import { useProducts } from '@/context/ProductsContext'
import { resolveCartLine, resolveCartLinePriceHuf } from '@/lib/cart-line'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useLocale } from '@/context/LocaleContext'
import { useToast } from '@/context/ToastContext'
import { useEuroRate } from '@/context/EuroRateContext'
import { useLuckySpin } from '@/hooks/useLuckySpin'
import { CheckoutSourcingModal } from '@/components/CheckoutSourcingModal'
import { CartEmptyState } from '@/components/empty-states/CartEmptyState'
import {
  computeCheckoutTotals,
  applyLuckySpinLockedPrices,
} from '@/lib/checkout'
import { getLuckySpinNextTierRemaining } from '@/lib/gamification/lucky-spin'

export default function CartPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { items, addItem, removeItem, updateQty, clearCart } = useCart()
  const { getProductById: getProductByIdFromContext, products, productsLoaded } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { t, locale } = useLocale()
  const { toast } = useToast()
  const { hufToEur, formatEur } = useEuroRate()
  const { userId } = useAuth()
  const { markUsed, discountPercent, isDiscountActive } = useCatCoupon()
  const { data: luckySpinData } = useLuckySpin(!!userId)
  const { getOrdersCount, placeOrder, cancelOrder } = useSourcingDealOrders()
  const processedAddIdRef = useRef<string | null>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  const luckySpinRecord = useMemo(() => {
    if (!luckySpinData?.spin || !luckySpinData.isActive) return null
    return {
      id: luckySpinData.spin.id,
      userId: userId ?? '',
      weekId: luckySpinData.spin.weekId,
      productIds: luckySpinData.spin.productIds,
      priceSnapshot: Object.fromEntries(
        (luckySpinData.spin.products ?? []).map((p) => [
          p.id,
          p.discountPriceHuf ?? p.priceHuf,
        ])
      ),
      generatedAt: new Date(luckySpinData.spin.generatedAt),
      expiresAt: new Date(luckySpinData.spin.expiresAt),
    }
  }, [luckySpinData, userId])

  const spinProductIds = useMemo(
    () => new Set(luckySpinRecord?.productIds ?? []),
    [luckySpinRecord]
  )

  const isPromoItem = useCallback(
    (productId: string) => spinProductIds.has(productId),
    [spinProductIds]
  )

  const checkoutPreview = useMemo(() => {
    const cartLines = items.map((item) => {
      const p = getProductById(item.productId)
      const line = resolveCartLine(item, p, locale)
      return {
        productId: item.productId,
        qty: item.qty,
        priceHuf: line.priceHuf,
        fulfillmentType: (p?.type === 'sourcing_deal' ? 'procurement' : 'stock') as 'stock' | 'procurement',
        name: line.name,
      }
    })
    const lockedLines = applyLuckySpinLockedPrices(cartLines, luckySpinRecord)
    return computeCheckoutTotals({
      lines: lockedLines,
      coupon: { percent: isDiscountActive ? discountPercent : 0 },
      luckySpin: luckySpinRecord,
    })
  }, [items, getProductById, luckySpinRecord, isDiscountActive, discountPercent, locale])

  const {
    subtotalHuf,
    couponDiscountHuf,
    luckySpinDiscountHuf,
    merchandiseTotalHuf,
    freeShippingRemainingHuf,
  } = checkoutPreview
  const luckySpinDiscountActive = checkoutPreview.luckySpin.active
  const luckySpinDiscountPercent = checkoutPreview.luckySpin.discountPercent
  const luckySpinNextTierRemaining = getLuckySpinNextTierRemaining(
    checkoutPreview.luckySpin.qualifyingItemCount
  )
  const displayTotalHuf = merchandiseTotalHuf

  const { stockItems, threeDItems, sourcingItems, promoItems } = useMemo(() => {
    const stock: typeof items = []
    const threeD: typeof items = []
    const sourcing: typeof items = []
    const promo: typeof items = []
    for (const item of items) {
      if (isPromoItem(item.productId)) {
        promo.push(item)
        continue
      }
      const product = getProductById(item.productId)
      if (product?.type === 'sourcing_deal') {
        sourcing.push(item)
      } else if (product && is3DProduct(product)) {
        threeD.push(item)
      } else {
        stock.push(item)
      }
    }
    return { stockItems: stock, threeDItems: threeD, sourcingItems: sourcing, promoItems: promo }
  }, [items, products, isPromoItem, getProductById])

  const hasSourcingItems = sourcingItems.length > 0

  const { subtotalEur, couponDiscountEur, luckySpinDiscountEur, totalEur } = useMemo(() => {
    const subEur = hufToEur(subtotalHuf)
    const couponEur = hufToEur(couponDiscountHuf)
    const spinEur = hufToEur(luckySpinDiscountHuf)
    return {
      subtotalEur: subEur,
      couponDiscountEur: couponEur,
      luckySpinDiscountEur: spinEur,
      totalEur: hufToEur(displayTotalHuf),
    }
  }, [subtotalHuf, couponDiscountHuf, luckySpinDiscountHuf, displayTotalHuf, hufToEur])

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
    const currentQty = items.find((x) => x.productId === product.id)?.qty ?? 0
    const ordersOverride = product.type === 'sourcing_deal' ? (product.ordersCount ?? 0) + currentQty : undefined
    const { canAdd } = getAddToCartReason(product, new Date(), ordersOverride)
    if (!canAdd) return
    const maxQty = getMaxQty(product, ordersOverride)
    if (currentQty >= maxQty) {
      toast(t('cart.allAvailableAdded'))
      router.replace('/kosar')
      return
    }
    processedAddIdRef.current = addId
    const requestedQty = Math.max(1, parseInt(searchParams.get('qty') || '1', 10) || 1)
    const addQty = Math.min(requestedQty, maxQty - currentQty)
    if (product.type === 'sourcing_deal') {
      placeOrder(product.id, addQty)
    }
    addItem(product.id, addQty, undefined, product)
    if (addQty < requestedQty) {
      toast(t('cart.allAvailableAdded'))
    }
    router.replace('/kosar')
  }, [searchParams, router, addItem, placeOrder, items, t, toast, getProductById, products])

  const handleCompleteOrder = () => {
    let corrected = false
    for (const item of items) {
      const product = getProductById(item.productId)
      const isSourcingOrder = product?.type === 'sourcing_deal'
      const maxAllowedInCart = isSourcingOrder && product
        ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
        : (product ? getMaxQty(product) : 0)
      if (item.qty > maxAllowedInCart) {
        corrected = true
        updateQty(item.productId, maxAllowedInCart, item.options)
        toast(t('cart.stockChangedAvailable', { count: maxAllowedInCart }))
      }
    }
    if (corrected) return
    router.push('/fizetes')
  }

  const handleCheckoutClick = () => {
    if (hasSourcingItems) {
      setShowCheckoutModal(true)
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
          <CartEmptyState />
        )}
        {justOrdered && (
          <Link href="/termekek" className="inline-block mt-4 text-accent font-medium hover:underline">
            {t('buttons.browseProducts')}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('cart.title')}</h1>

      {!productsLoaded && items.length > 0 && (
        <p className="text-muted text-sm mb-4">Betöltés…</p>
      )}

      {promoItems.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{t('cart.blockPromoTitle')}</h2>
          <p className="text-sm text-muted mb-3">{t('cart.blockPromoDispatch')}</p>
          {luckySpinRecord && luckySpinNextTierRemaining != null && checkoutPreview.luckySpin.qualifyingItemCount > 0 && (
            <p className="text-xs text-muted mb-3 leading-tight">
              {t('luckySpin.cartProgress').replace('{remaining}', String(luckySpinNextTierRemaining))}
            </p>
          )}
          <ul className="space-y-4">
            {promoItems.map((item) => (
              <CartLineRow
                key={`promo-${item.productId}-${item.options?.colorHex ?? item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`}
                item={item}
                isPromo
                luckySpinDiscountActive={luckySpinDiscountActive}
                luckySpinDiscountPercent={luckySpinDiscountPercent}
                lockedUnitPriceHuf={luckySpinRecord?.priceSnapshot?.[item.productId]}
                getProductById={getProductById}
                locale={locale}
                t={t}
                hufToEur={hufToEur}
                formatEur={formatEur}
                updateQty={updateQty}
                removeItem={removeItem}
                onDecreaseSourcing={(productId) => cancelOrder(productId, 1)}
                onIncreaseSourcing={(productId) => placeOrder(productId, 1)}
                onRemoveSourcing={(productId, qty) => cancelOrder(productId, qty)}
              />
            ))}
          </ul>
        </section>
      )}

      {(stockItems.length > 0 || threeDItems.length > 0 || sourcingItems.length > 0) && promoItems.length > 0 && (
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">{t('cart.blockNormalTitle')}</h2>
      )}

      {stockItems.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{t('cart.blockStockTitle')}</h2>
          <p className="text-sm text-muted mb-3">{t('cart.blockStockDispatch')}</p>
          <ul className="space-y-4">
            {stockItems.map((item) => {
              const product = getProductById(item.productId)
              const line = resolveCartLine(item, product, locale)
              const maxAllowedInCart = product ? getMaxQty(product) : 99
              const priceHuf = line.priceHuf
              const priceEur = hufToEur(priceHuf)
              const lineKey = `${item.productId}-${item.options?.colorHex ?? item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`
              return (
                <li key={lineKey} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                    <SafeProductImage
                      src={line.image}
                      alt={line.name}
                      fit="cover"
                      fill
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{line.name}</p>
                    <p className="text-muted text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft × {item.qty}
                      {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
                    </p>
                    {item.options?.colorName && (
                      <p className="text-foreground text-sm mt-0.5">
                        <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>
                      </p>
                    )}
                    <p className="text-foreground text-sm font-medium mt-1">{t('cart.availableUpTo', { count: maxAllowedInCart })}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
                      <button
                        type="button"
                        onClick={() => { if (item.qty <= 1) return; updateQty(item.productId, item.qty - 1, item.options) }}
                        disabled={item.qty <= 1}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.decreaseQty')}
                      >−</button>
                      <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => { if (item.qty >= maxAllowedInCart) return; updateQty(item.productId, item.qty + 1, item.options) }}
                        disabled={item.qty >= maxAllowedInCart}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.increaseQty')}
                      >+</button>
                    </div>
                    <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
                    <button type="button" onClick={() => removeItem(item.productId, item.options)} className="text-muted hover:text-red-600 text-sm font-medium">{t('cart.remove')}</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {threeDItems.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{t('cart.block3DTitle')}</h2>
          <p className="text-sm text-muted mb-3">{t('cart.block3DDispatch')}</p>
          <ul className="space-y-4">
            {threeDItems.map((item) => {
              const product = getProductById(item.productId)
              const line = resolveCartLine(item, product, locale)
              const maxAllowedInCart = product ? getMaxQty(product) : 99
              const priceHuf = line.priceHuf
              const priceEur = hufToEur(priceHuf)
              const lineKey = `${item.productId}-${item.options?.colorHex ?? item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`
              return (
                <li key={lineKey} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                    <SafeProductImage
                      src={line.image}
                      alt={line.name}
                      fit="cover"
                      fill
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{line.name}</p>
                    <p className="text-muted text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft × {item.qty}
                      {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
                    </p>
                    {item.options?.colorName && (
                      <p className="text-foreground text-sm mt-0.5">
                        <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>
                      </p>
                    )}
                    <p className="text-foreground text-sm font-medium mt-1">{t('cart.availableUpTo', { count: maxAllowedInCart })}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
                      <button
                        type="button"
                        onClick={() => { if (item.qty <= 1) return; updateQty(item.productId, item.qty - 1, item.options) }}
                        disabled={item.qty <= 1}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.decreaseQty')}
                      >−</button>
                      <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => { if (item.qty >= maxAllowedInCart) return; updateQty(item.productId, item.qty + 1, item.options) }}
                        disabled={item.qty >= maxAllowedInCart}
                        className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('cart.increaseQty')}
                      >+</button>
                    </div>
                    <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
                    <button type="button" onClick={() => removeItem(item.productId, item.options)} className="text-muted hover:text-red-600 text-sm font-medium">{t('cart.remove')}</button>
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
          <p className="text-sm text-muted mb-3 whitespace-pre-line">{t('pages.shipping.sourcingFullDescription')}</p>
          <ul className="space-y-4">
            {sourcingItems.map((item) => {
              const product = getProductById(item.productId)
              const line = resolveCartLine(item, product, locale)
              const maxAllowedInCart = product ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0)) : 99
              const priceHuf = line.priceHuf
              const priceEur = hufToEur(priceHuf)
              return (
                <li key={item.productId} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
                  <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                    <SafeProductImage
                      src={line.image}
                      alt={line.name}
                      fit="cover"
                      fill
                      sizes="80px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{line.name}</p>
                    <p className="text-muted text-sm">
                      {priceHuf.toLocaleString('hu-HU')} Ft × {item.qty}
                      {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
                    </p>
                    {item.options?.colorName && (
                      <p className="text-foreground text-sm mt-0.5">
                        <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>
                      </p>
                    )}
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

      <p className="text-sm text-muted mb-4 whitespace-pre-line">{t('pages.shipping.fullDescription')}</p>

      {(() => {
        const remaining = freeShippingRemainingHuf
        const reached = remaining === 0 && merchandiseTotalHuf > 0
        return (
          <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
            {reached ? (
              <p className="text-foreground font-medium flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">✓</span>
                {t('cart.freeShippingReached') || 'Ingyenes szállítás elérve'}
              </p>
            ) : (
              <p className="text-muted text-sm">
                {t('cart.freeShippingProgress', { amount: remaining.toLocaleString('hu-HU') }) || `Még ${remaining.toLocaleString('hu-HU')} Ft és ingyenes a szállítás`}
              </p>
            )}
          </div>
        )
      })()}

      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted">
        <span className="flex items-center gap-1">
          <CardIcon className="w-5 h-5" />
          {t('home.trustPayment')}
        </span>
        <span className="flex items-center gap-1">
          <LockIcon className="w-5 h-5" />
          {t('payment.securePayment') || 'Biztonságos fizetés'}
        </span>
      </div>

      <CheckoutSourcingModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onConfirm={handleCompleteOrder}
      />
      <div className="border-t border-[var(--border)] pt-6 space-y-2">
        <div className="flex justify-between text-foreground">
          <span>{t('cart.subtotal')}</span>
          <span>{subtotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(subtotalEur)})</span></span>
        </div>
        {isDiscountActive && couponDiscountHuf > 0 && (
          <div className="flex justify-between text-discount">
            <span>{t('cart.discountLabel', { percent: Math.round(discountPercent * 100) })}</span>
            <span>−{couponDiscountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(couponDiscountEur)})</span></span>
          </div>
        )}
        {luckySpinDiscountHuf > 0 && (
          <div className="flex justify-between text-discount">
            <span>
              {t('payment.luckySpinDiscountLine', {
                percent: Math.round(luckySpinDiscountPercent * 100),
              })}
            </span>
            <span>−{luckySpinDiscountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(luckySpinDiscountEur)})</span></span>
          </div>
        )}
        <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2">
          <span>{t('cart.total')}</span>
          <span>{displayTotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(totalEur)})</span></span>
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={handleCheckoutClick}
          disabled={items.length === 0 || (productsLoaded && displayTotalHuf <= 0)}
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

type CartLineRowProps = {
  item: CartItem
  isPromo?: boolean
  luckySpinDiscountActive?: boolean
  luckySpinDiscountPercent?: number
  lockedUnitPriceHuf?: number
  getProductById: (id: string) => ReturnType<typeof getProductByIdFromData> | undefined
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
  hufToEur: (huf: number) => number
  formatEur: (eur: number) => string
  updateQty: (productId: string, qty: number, options?: CartItem['options']) => void
  removeItem: (productId: string, options?: CartItem['options']) => void
  onDecreaseSourcing?: (productId: string) => void
  onIncreaseSourcing?: (productId: string) => void
  onRemoveSourcing?: (productId: string, qty: number) => void
}

function CartLineRow({
  item,
  isPromo = false,
  luckySpinDiscountActive = false,
  luckySpinDiscountPercent = 0,
  lockedUnitPriceHuf,
  getProductById,
  locale,
  t,
  hufToEur,
  formatEur,
  updateQty,
  removeItem,
  onDecreaseSourcing,
  onIncreaseSourcing,
  onRemoveSourcing,
}: CartLineRowProps) {
  const product = getProductById(item.productId)
  const line = resolveCartLine(item, product, locale)
  const isSourcingOrder = product?.type === 'sourcing_deal'
  const maxAllowedInCart = isSourcingOrder && product
    ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
    : (product ? getMaxQty(product) : 99)
  const catalogUnitHuf = resolveCartLinePriceHuf(item, product)
  const unitPriceHuf = lockedUnitPriceHuf != null && lockedUnitPriceHuf > 0 ? lockedUnitPriceHuf : catalogUnitHuf
  const discountedUnitHuf = isPromo && luckySpinDiscountActive && luckySpinDiscountPercent > 0
    ? Math.round(unitPriceHuf * (1 - luckySpinDiscountPercent))
    : unitPriceHuf
  const displayUnitHuf = isPromo && luckySpinDiscountActive ? discountedUnitHuf : unitPriceHuf
  const priceEur = hufToEur(displayUnitHuf)
  const lineKey = `${item.productId}-${item.options?.colorHex ?? item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`

  return (
    <li key={lineKey} className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
      <div className="w-20 h-20 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
        <SafeProductImage
          src={line.image}
          alt={line.name}
          fit="cover"
          fill
          sizes="80px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{line.name}</p>
        <p className="text-muted text-sm">
          {isPromo && luckySpinDiscountActive ? (
            <>
              <span className="line-through mr-2">{unitPriceHuf.toLocaleString('hu-HU')} Ft</span>
              <span className="text-discount font-medium">{displayUnitHuf.toLocaleString('hu-HU')} Ft</span>
            </>
          ) : (
            <span>{displayUnitHuf.toLocaleString('hu-HU')} Ft</span>
          )}
          {' '}× {item.qty}
          {priceEur > 0 && <span className="ml-1">(€{formatEur(priceEur)})</span>}
        </p>
        {item.options?.colorName && (
          <p className="text-foreground text-sm mt-0.5">
            <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>
          </p>
        )}
        <p className="text-foreground text-sm font-medium mt-1">{t('cart.availableUpTo', { count: maxAllowedInCart })}</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
          <button
            type="button"
            onClick={() => {
              if (item.qty <= 1) return
              updateQty(item.productId, item.qty - 1, item.options)
              onDecreaseSourcing?.(item.productId)
            }}
            disabled={item.qty <= 1}
            className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('cart.decreaseQty')}
          >−</button>
          <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">{item.qty}</span>
          <button
            type="button"
            onClick={() => {
              if (item.qty >= maxAllowedInCart) return
              updateQty(item.productId, item.qty + 1, item.options)
              onIncreaseSourcing?.(item.productId)
            }}
            disabled={item.qty >= maxAllowedInCart}
            className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('cart.increaseQty')}
          >+</button>
        </div>
        <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
        <button
          type="button"
          onClick={() => {
            if (onRemoveSourcing) onRemoveSourcing(item.productId, item.qty)
            removeItem(item.productId, item.options)
          }}
          className="text-muted hover:text-red-600 text-sm font-medium"
        >
          {t('cart.remove')}
        </button>
      </div>
    </li>
  )
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}
function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
