'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProductName, getProductById as getProductByIdFromData } from '@/lib/data'
import { useCart } from '@/context/CartContext'
import { useProducts } from '@/context/ProductsContext'
import { useLocale } from '@/context/LocaleContext'
import { useAuth } from '@/context/AuthContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useLuckySpin } from '@/hooks/useLuckySpin'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { CheckoutSourcingModal } from '@/components/CheckoutSourcingModal'
import {
  computeCheckoutTotals,
  applyLuckySpinLockedPrices,
} from '@/lib/checkout'

type Props = { isOpen: boolean; onClose: () => void }

export function CartDrawer({ isOpen, onClose }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const { items, removeItem } = useCart()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { userId } = useAuth()
  const { isDiscountActive, discountPercent } = useCatCoupon()
  const { data: luckySpinData } = useLuckySpin(!!userId)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  useFocusTrap(drawerRef, isOpen && !showCheckoutModal)

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

  const checkoutPreview = useMemo(() => {
    const cartLines = items.map((item) => {
      const p = getProductById(item.productId)
      return {
        productId: item.productId,
        qty: item.qty,
        priceHuf: p ? (p.discountPriceHuf ?? p.priceHuf) : 0,
        fulfillmentType: (p?.type === 'sourcing_deal' ? 'procurement' : 'stock') as 'stock' | 'procurement',
        name: p?.name,
      }
    })
    const lockedLines = applyLuckySpinLockedPrices(cartLines, luckySpinRecord)
    return computeCheckoutTotals({
      lines: lockedLines,
      coupon: { percent: isDiscountActive ? discountPercent : 0 },
      luckySpin: luckySpinRecord,
    })
  }, [items, getProductById, luckySpinRecord, isDiscountActive, discountPercent])

  const {
    subtotalHuf,
    couponDiscountHuf,
    luckySpinDiscountHuf,
    merchandiseTotalHuf,
  } = checkoutPreview
  const luckySpinDiscountActive = checkoutPreview.luckySpin.active
  const luckySpinDiscountPercent = checkoutPreview.luckySpin.discountPercent

  const sortedItems = useMemo(() => {
    const promo: typeof items = []
    const normal: typeof items = []
    for (const item of items) {
      if (spinProductIds.has(item.productId)) promo.push(item)
      else normal.push(item)
    }
    return [...promo, ...normal]
  }, [items, spinProductIds])

  const hasSourcingItems = useMemo(() => {
    return items.some((item) => getProductById(item.productId)?.type === 'sourcing_deal')
  }, [items])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('cart.title')}
        className="fixed top-0 right-0 bottom-0 z-[60] w-full max-w-md bg-[var(--card-bg)] border-l border-[var(--border)] shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="font-heading text-lg font-bold text-foreground">{t('cart.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border)]"
            aria-label={t('buttons.close')}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-muted py-8">{t('cart.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {sortedItems.map((item) => {
                const product = getProductById(item.productId)
                const name = product ? getProductName(product, locale) : item.productId
                const catalogUnitHuf = product ? (product.discountPriceHuf ?? product.priceHuf) : 0
                const isPromo = spinProductIds.has(item.productId)
                const lockedUnitHuf = luckySpinRecord?.priceSnapshot?.[item.productId]
                const unitPriceHuf = lockedUnitHuf != null && lockedUnitHuf > 0 ? lockedUnitHuf : catalogUnitHuf
                const showPromoPrice = isPromo && luckySpinDiscountActive
                const discountedUnitHuf = showPromoPrice && luckySpinDiscountPercent > 0
                  ? Math.round(unitPriceHuf * (1 - luckySpinDiscountPercent))
                  : unitPriceHuf
                const img = product?.image?.trim() ? product.image : ''
                const isLocalImg = img?.startsWith('/')
                const lineKey = `${item.productId}-${item.options?.colorHex ?? item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`
                return (
                  <li key={lineKey} className="flex gap-3 p-3 rounded-lg border border-[var(--border)]">
                    <div className="w-14 h-14 shrink-0 rounded-lg bg-[var(--border)] relative overflow-hidden">
                      {img ? (
                        isLocalImg ? (
                          <Image src={img} alt="" fill className="object-cover" sizes="56px" />
                        ) : (
                          <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                        )
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm line-clamp-2">{name}</p>
                      {isPromo && (
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-accent mt-0.5">
                          {t('luckySpin.weeklyOffer')}
                        </span>
                      )}
                      {(item.options?.colorName || item.options?.materialName) && (
                        <p className="text-foreground text-xs">
                          {item.options?.materialName && <span>{t('product.material') || 'Anyag'}: {item.options.materialName}</span>}
                          {item.options?.materialName && item.options?.colorName && ' · '}
                          {item.options?.colorName && <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>}
                        </p>
                      )}
                      <p className="text-muted text-xs mt-0.5">
                        {showPromoPrice ? (
                          <>
                            <span className="line-through mr-1.5">{unitPriceHuf.toLocaleString('hu-HU')} Ft</span>
                            <span className="text-discount font-medium">{discountedUnitHuf.toLocaleString('hu-HU')} Ft</span>
                          </>
                        ) : (
                          <span>{discountedUnitHuf.toLocaleString('hu-HU')} Ft</span>
                        )}
                        {' '}× {item.qty}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId, item.options)}
                        className="text-xs text-muted hover:text-red-600"
                      >
                        {t('cart.remove')}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-[var(--border)] space-y-2">
            <div className="flex justify-between text-sm text-foreground">
              <span>{t('cart.subtotal')}</span>
              <span>{subtotalHuf.toLocaleString('hu-HU')} Ft</span>
            </div>
            {isDiscountActive && couponDiscountHuf > 0 && (
              <div className="flex justify-between text-sm text-discount">
                <span>{t('cart.discountLabel', { percent: Math.round(discountPercent * 100) })}</span>
                <span>−{couponDiscountHuf.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            {luckySpinDiscountHuf > 0 && (
              <div className="flex justify-between text-sm text-discount">
                <span>{t('luckySpin.cartDiscount')}</span>
                <span>−{luckySpinDiscountHuf.toLocaleString('hu-HU')} Ft</span>
              </div>
            )}
            <div className="flex justify-between font-heading font-semibold text-foreground pt-1">
              <span>{t('cart.total')}</span>
              <span>{merchandiseTotalHuf.toLocaleString('hu-HU')} Ft</span>
            </div>
            <Link
              href="/kosar"
              className="block w-full py-3 text-center border-2 border-[var(--border)] text-foreground font-heading font-semibold rounded-lg hover:bg-[var(--border)] transition-colors"
              onClick={onClose}
            >
              {t('cart.title')}
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose()
                if (hasSourcingItems) {
                  setShowCheckoutModal(true)
                } else {
                  router.push('/fizetes')
                }
              }}
              className="block w-full py-3 text-center bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('buttons.checkout')}
            </button>
          </div>
        )}
      </div>
      <CheckoutSourcingModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onConfirm={() => {
          setShowCheckoutModal(false)
          router.push('/fizetes')
        }}
      />
    </>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
