'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useMemo } from 'react'
import { getProductById, getAddToCartReason, getMaxQty, getStockById, getProductName } from '@/lib/data'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useSourcingDealOrders } from '@/context/SourcingDealOrdersContext'
import { useLocale } from '@/context/LocaleContext'
import { useToast } from '@/context/ToastContext'

export default function CartPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { items, addItem, removeItem, updateQty, clearCart, subtotalHuf, discountHuf, totalHuf, isDiscountActive } = useCart()
  const { t, locale } = useLocale()
  const { toast } = useToast()
  const { markUsed } = useCatCoupon()
  const { getOrdersCount, placeOrder, cancelOrder } = useSourcingDealOrders()
  const processedAddIdRef = useRef<string | null>(null)

  const { subtotalEur, discountEur, totalEur } = useMemo(() => {
    let subEur = 0
    for (const item of items) {
      const p = getProductById(item.productId)
      const priceEur = p ? (p.discountPriceEur ?? p.priceEur) : 0
      subEur += priceEur * item.qty
    }
    const discountRatio = subtotalHuf > 0 ? discountHuf / subtotalHuf : 0
    const discEur = Math.round(subEur * discountRatio * 100) / 100
    return {
      subtotalEur: subEur,
      discountEur: discEur,
      totalEur: Math.round((subEur - discEur) * 100) / 100,
    }
  }, [items, subtotalHuf, discountHuf])

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
    markUsed()
    clearCart()
    router.push('/kosar?ordered=1')
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
      <ul className="space-y-4 mb-8">
        {items.map((item) => {
          const product = getProductById(item.productId)
          const isSourcing = product?.type === 'sourcing_deal'
          // Maximum összesen kosárban tartható: készlet VAGY (sourcing) maxOrders - már leadott rendelések.
          const maxAllowedInCart = isSourcing && product
            ? Math.max(0, (product.maxOrders ?? 0) - (product.ordersCount ?? 0))
            : getStockById(item.productId)
          const priceHuf = product ? (product.discountPriceHuf ?? product.priceHuf) : 0
          const priceEur = product ? (product.discountPriceEur ?? product.priceEur) : 0
          const img = product?.image?.startsWith('/') ? product.image : ''
          const deliveryText = product?.type === 'sourcing_deal'
            ? t('cart.deliverySourcing')
            : t('cart.deliveryStock')
          return (
          <li
            key={item.productId}
            className="flex gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]"
          >
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
                {priceEur > 0 && <span className="ml-1">(€{priceEur})</span>}
              </p>
              <p className="text-muted text-xs mt-0.5">{deliveryText}</p>
              <p className="text-foreground text-sm font-medium mt-1">
                {t('cart.availableUpTo', { count: maxAllowedInCart })}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card-bg)]">
                <button
                  type="button"
                  onClick={() => {
                    if (item.qty <= 1) return
                    updateQty(item.productId, item.qty - 1)
                    if (isSourcing) cancelOrder(item.productId, 1)
                  }}
                  disabled={item.qty <= 1}
                  className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('cart.decreaseQty')}
                >
                  −
                </button>
                <span className="w-10 h-9 flex items-center justify-center text-sm font-medium text-foreground border-x border-[var(--border)]">
                  {item.qty}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (item.qty >= maxAllowedInCart) return
                    updateQty(item.productId, item.qty + 1)
                    if (isSourcing) placeOrder(item.productId, 1)
                  }}
                  disabled={item.qty >= maxAllowedInCart}
                  className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('cart.increaseQty')}
                >
                  +
                </button>
              </div>
              <span className="text-muted text-sm whitespace-nowrap">{item.qty} db</span>
              <button
                type="button"
                onClick={() => {
                  if (isSourcing) cancelOrder(item.productId, item.qty)
                  removeItem(item.productId)
                }}
                className="text-muted hover:text-red-600 text-sm font-medium"
              >
                {t('cart.remove')}
              </button>
            </div>
          </li>
          )
        })}
      </ul>
      <p className="text-sm text-muted mb-4">{t('cart.deliveryNote')}</p>
      <div className="border-t border-[var(--border)] pt-6 space-y-2">
        <div className="flex justify-between text-foreground">
          <span>{t('cart.subtotal')}</span>
          <span>{subtotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{subtotalEur.toLocaleString('hu-HU')})</span></span>
        </div>
        {isDiscountActive && discountHuf > 0 && (
          <div className="flex justify-between text-discount">
            <span>{t('cart.discount')}</span>
            <span>−{discountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{discountEur.toLocaleString('hu-HU')})</span></span>
          </div>
        )}
        <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2">
          <span>{t('cart.total')}</span>
          <span>{totalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{totalEur.toLocaleString('hu-HU')})</span></span>
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={handleCompleteOrder}
          className="py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
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
