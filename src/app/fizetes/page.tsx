'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useEuroRate } from '@/context/EuroRateContext'
import { trackBeginCheckout } from '@/lib/analytics'
import { getProductById as getProductByIdFromData, getProductName } from '@/lib/data'
import { useProducts } from '@/context/ProductsContext'
import { usePointWallet } from '@/hooks/usePointWallet'
import { useLuckySpin } from '@/hooks/useLuckySpin'
import {
  computeCheckoutTotals,
  applyLuckySpinLockedPrices,
  MAX_CART_POINTS_COVERAGE,
  POINTS_PER_HUF,
} from '@/lib/checkout'
import { LUCKY_SPIN_MIN_ITEMS, LUCKY_SPIN_DISCOUNT_PERCENT } from '@/lib/gamification/constants'

export default function PaymentPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { userId } = useAuth()
  const { items } = useCart()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { isDiscountActive: couponActive, discountPercent, activate, catStatus, status: couponStatusValue } = useCatCoupon()
  const { hufToEur, formatEur } = useEuroRate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loyaltyPercent, setLoyaltyPercent] = useState(0)
  const [guestEmail, setGuestEmail] = useState('')
  const [usePoints, setUsePoints] = useState(false)
  const [couponExpanded, setCouponExpanded] = useState(false)
  const [couponCodeInput, setCouponCodeInput] = useState('')
  const [couponMessage, setCouponMessage] = useState<string | null>(null)
  const [checkoutResult, setCheckoutResult] = useState<{
    orderGroupId: string
    payments: Array<{ orderType: 'in_stock' | 'sourcing'; type: string; url?: string; clientSecret?: string; message?: string }>
  } | null>(null)
  const [pointsPreview, setPointsPreview] = useState<{
    maxUsablePointsDiscountHuf: number
    maxUsablePoints: number
    balance: number
  } | null>(null)
  const { wallet, refresh: refreshWallet } = usePointWallet(!!userId)
  const { data: luckySpinData } = useLuckySpin(!!userId)

  const luckySpinRecord = luckySpinData?.spin && luckySpinData.isActive
    ? {
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
    : null

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

  let effectiveCouponPercent = 0
  if (couponActive && discountPercent > 0) {
    effectiveCouponPercent = discountPercent
  } else if (!couponActive && loyaltyPercent > 0) {
    effectiveCouponPercent = loyaltyPercent / 100
  }

  const checkoutPreview = computeCheckoutTotals({
    lines: lockedLines,
    coupon: { percent: effectiveCouponPercent },
    luckySpin: luckySpinRecord,
    points:
      usePoints && pointsPreview
        ? {
            requestedDiscountHuf: pointsPreview.maxUsablePointsDiscountHuf,
            userBalance: pointsPreview.balance,
          }
        : undefined,
  })

  const couponDiscountOnTotal = checkoutPreview.couponDiscountHuf
  const luckySpinDiscount = checkoutPreview.luckySpin
  const displayTotalHuf = checkoutPreview.afterCouponAndLuckyHuf
  const pointsDiscountHuf = checkoutPreview.pointsDiscountHuf
  const shippingHuf = checkoutPreview.shippingHuf
  const cardTotalHuf = checkoutPreview.finalTotalHuf
  const freeShippingRemainingHuf = checkoutPreview.freeShippingRemainingHuf

  const spinProductIds = useMemo(
    () => new Set(luckySpinRecord?.productIds ?? []),
    [luckySpinRecord]
  )

  const { promoItems, normalItems, promoSubtotalHuf, normalSubtotalHuf } = useMemo(() => {
    const promo: typeof items = []
    const normal: typeof items = []
    let promoSub = 0
    let normalSub = 0
    for (const item of items) {
      const line = lockedLines.find((l) => l.productId === item.productId)
      const lineTotal = (line?.priceHuf ?? 0) * item.qty
      if (spinProductIds.has(item.productId)) {
        promo.push(item)
        promoSub += lineTotal
      } else {
        normal.push(item)
        normalSub += lineTotal
      }
    }
    return {
      promoItems: promo,
      normalItems: normal,
      promoSubtotalHuf: promoSub,
      normalSubtotalHuf: normalSub,
    }
  }, [items, lockedLines, spinProductIds])

  const luckySpinDiscountActive = luckySpinDiscount.active

  useEffect(() => {
    if (couponActive) setCouponExpanded(true)
  }, [couponActive])

  useEffect(() => {
    if (!couponActive && userId) {
      fetch(`/api/loyalty?email=${encodeURIComponent(userId)}`)
        .then((r) => r.json())
        .then((d) => setLoyaltyPercent(d.loyaltyPercent ?? 0))
        .catch(() => setLoyaltyPercent(0))
    } else {
      setLoyaltyPercent(0)
    }
  }, [couponActive, userId])

  const loyaltyDiscountOnTotal = !couponActive && loyaltyPercent > 0 ? couponDiscountOnTotal : 0
  const effectiveCouponDiscountHuf =
    couponActive && couponDiscountOnTotal > 0
      ? couponDiscountOnTotal
      : loyaltyDiscountOnTotal > 0
        ? loyaltyDiscountOnTotal
        : 0
  const totalEur = hufToEur(cardTotalHuf)

  const handleCouponApply = () => {
    setCouponMessage(null)
    if (!userId) {
      setCouponMessage(t('coupon.loggedInRequired'))
      return
    }
    if (couponActive) {
      setCouponMessage(t('payment.couponAlreadyActive'))
      return
    }
    if (catStatus === 'used' && couponStatusValue === 'used') {
      setCouponMessage(t('coupon.alreadyActivated'))
      return
    }
    if (catStatus === 'not_claimed' && activate()) {
      setCouponMessage(t('coupon.activated'))
      setCouponCodeInput('')
      return
    }
    if (couponCodeInput.trim()) {
      setCouponMessage(t('payment.couponInvalid'))
      return
    }
    setCouponMessage(t('payment.couponNoneAvailable'))
  }

  const renderLineItem = (item: (typeof items)[number]) => {
    const product = getProductById(item.productId)
    const name = product ? getProductName(product, locale) : item.productId
    const line = lockedLines.find((l) => l.productId === item.productId)
    const unitPriceHuf = line?.priceHuf ?? 0
    const isPromo = spinProductIds.has(item.productId)
    const showPromoPrice = isPromo && luckySpinDiscountActive
    const discountedUnitHuf = showPromoPrice
      ? Math.round(unitPriceHuf * (1 - LUCKY_SPIN_DISCOUNT_PERCENT))
      : unitPriceHuf
    const lineKey = `${item.productId}-${item.options?.colorHex ?? ''}-${item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`

    return (
      <li key={lineKey} className="flex justify-between gap-3 text-sm">
        <div className="min-w-0">
          <span className="text-foreground">{name} × {item.qty}</span>
          {(item.options?.colorName || item.options?.materialName) && (
            <p className="text-xs text-muted mt-0.5">
              {item.options?.materialName && <span>{t('product.material')}: {item.options.materialName}</span>}
              {item.options?.materialName && item.options?.colorName && ' · '}
              {item.options?.colorName && <span>{t('product.color')}: {item.options.colorName}</span>}
            </p>
          )}
        </div>
        <span className="shrink-0 text-right text-muted tabular-nums">
          {showPromoPrice ? (
            <>
              <span className="line-through block">{unitPriceHuf.toLocaleString('hu-HU')} Ft</span>
              <span className="text-discount font-medium">{discountedUnitHuf.toLocaleString('hu-HU')} Ft</span>
            </>
          ) : (
            <span>{unitPriceHuf.toLocaleString('hu-HU')} Ft</span>
          )}
        </span>
      </li>
    )
  }

  useEffect(() => {
    if (!userId || displayTotalHuf <= 0) {
      setPointsPreview(null)
      return
    }
    fetch(`/api/gamification/purchase-preview?cartTotalHuf=${displayTotalHuf}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPointsPreview({
            maxUsablePointsDiscountHuf: data.maxUsablePointsDiscountHuf ?? 0,
            maxUsablePoints: data.maxUsablePoints ?? 0,
            balance: data.balance ?? 0,
          })
        }
      })
      .catch(() => setPointsPreview(null))
  }, [userId, displayTotalHuf, wallet?.balance])

  useEffect(() => {
    if (items.length === 0) {
      router.replace('/kosar')
    }
  }, [items.length, router])

  const handlePayByCard = async () => {
    setError(null)
    setCheckoutResult(null)
    if (!userId && !guestEmail.trim()) {
      setError(t('payment.emailRequired') || 'E-mail cím kötelező a rendeléshez.')
      return
    }
    const email = userId || guestEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('payment.emailInvalid') || 'Érvényes e-mail címet adj meg.')
      return
    }
    // Timed offer validity: decided by /api/checkout (fresh ordersCount + server now). No client-side block.
    setLoading(true)
    trackBeginCheckout(cardTotalHuf)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map(({ productId, qty, options }) => ({
            productId,
            qty,
            ...(options && (options.colorName != null || options.colorHex != null || options.materialName != null) ? { options } : {}),
          })),
          customer: { email },
          isDiscountActive: couponActive,
          discountPercent: couponActive ? discountPercent : undefined,
          pointsDiscountHuf: pointsDiscountHuf > 0 ? pointsDiscountHuf : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const isTimedOfferError = res.status === 400 && (data.code === 'timed_offer_unavailable' || data.error?.includes('timed'))
        setError(isTimedOfferError ? t('payment.timedOfferNoLongerAvailable') : (data.error || t('payment.errorCreateSession')))
        setLoading(false)
        return
      }
      const redirectPayment = data.payments?.find((p: { type: string }) => p.type === 'redirect')
      if (redirectPayment?.url) {
        window.location.href = redirectPayment.url
        return
      }
      const clientSecretPayment = data.payments?.find((p: { type: string }) => p.type === 'client_secret')
      if (clientSecretPayment?.clientSecret) {
        setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments })
        setLoading(false)
        setTimeout(() => {
          router.push(`/fizetes/siker?order_group_id=${encodeURIComponent(data.orderGroupId)}`)
        }, 2000)
        return
      }
      setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments || [] })
      void refreshWallet()
      setLoading(false)
      setTimeout(() => {
        router.push(`/fizetes/siker?order_group_id=${encodeURIComponent(data.orderGroupId)}`)
      }, 2500)
    } catch {
      setError(t('payment.errorCreateSession'))
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-muted">{t('cart.empty')}</p>
        <Link href="/kosar" className="inline-block mt-4 text-accent font-medium hover:underline">
          {t('payment.backToCart')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">{t('payment.title')}</h1>

      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-4">{t('payment.summary')}</h2>

        {promoItems.length > 0 && (
          <div className="mb-5 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="flex justify-between items-baseline gap-3 mb-2">
              <h3 className="text-sm font-semibold text-accent">{t('cart.blockPromoTitle')}</h3>
              <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                {promoSubtotalHuf.toLocaleString('hu-HU')} Ft
              </span>
            </div>
            <ul className="space-y-2">
              {promoItems.map(renderLineItem)}
            </ul>
          </div>
        )}

        {normalItems.length > 0 && (
          <div className="mb-5 rounded-lg border border-[var(--border)] p-3">
            <div className="flex justify-between items-baseline gap-3 mb-2">
              <h3 className="text-sm font-semibold text-foreground">
                {promoItems.length > 0 ? t('cart.blockNormalTitle') : t('payment.allItems')}
              </h3>
              <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                {normalSubtotalHuf.toLocaleString('hu-HU')} Ft
              </span>
            </div>
            <ul className="space-y-2">
              {normalItems.map(renderLineItem)}
            </ul>
          </div>
        )}

        {luckySpinRecord && !luckySpinDiscount.active && luckySpinDiscount.qualifyingItemCount > 0 && (
          <p className="text-xs text-muted mb-3">
            {t('luckySpin.cartProgress').replace(
              '{remaining}',
              String(LUCKY_SPIN_MIN_ITEMS - luckySpinDiscount.qualifyingItemCount)
            )}
          </p>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-heading font-semibold text-foreground mb-2">{t('payment.itemsTotalSection')}</h3>
            <div className="space-y-1.5">
              {promoSubtotalHuf > 0 && (
                <div className="flex justify-between text-foreground">
                  <span>{t('payment.subtotalPromo')}</span>
                  <span className="tabular-nums">{promoSubtotalHuf.toLocaleString('hu-HU')} Ft</span>
                </div>
              )}
              {normalSubtotalHuf > 0 && (
                <div className="flex justify-between text-foreground">
                  <span>{t('payment.subtotalNormal')}</span>
                  <span className="tabular-nums">{normalSubtotalHuf.toLocaleString('hu-HU')} Ft</span>
                </div>
              )}
            </div>
          </div>

          {(luckySpinDiscount.discountHuf > 0 || effectiveCouponDiscountHuf > 0 || pointsDiscountHuf > 0) && (
            <div className="border-t border-[var(--border)] pt-3">
              <h3 className="font-heading font-semibold text-foreground mb-2">{t('payment.discountsSection')}</h3>
              <div className="space-y-1.5">
                {luckySpinDiscount.discountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span>
                      {t('payment.luckySpinDiscountLine', {
                        percent: Math.round(LUCKY_SPIN_DISCOUNT_PERCENT * 100),
                      })}
                    </span>
                    <span className="tabular-nums">−{luckySpinDiscount.discountHuf.toLocaleString('hu-HU')} Ft</span>
                  </div>
                )}
                {effectiveCouponDiscountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span className="inline-flex items-center gap-1.5">
                      <span>
                        {couponActive
                          ? t('payment.couponDiscountWithCode', {
                              percent: Math.round((couponActive ? discountPercent : loyaltyPercent / 100) * 100),
                            })
                          : t('payment.loyaltyDiscountLine', { percent: loyaltyPercent })}
                      </span>
                      <button
                        type="button"
                        title={t('payment.couponScopeHint')}
                        aria-label={t('payment.couponScopeHint')}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] leading-none opacity-70 hover:opacity-100"
                      >
                        i
                      </button>
                    </span>
                    <span className="tabular-nums">−{effectiveCouponDiscountHuf.toLocaleString('hu-HU')} Ft</span>
                  </div>
                )}
                {pointsDiscountHuf > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>{t('payment.pointsDiscount')}</span>
                    <span className="tabular-nums">−{pointsDiscountHuf.toLocaleString('hu-HU')} Ft</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
            <div className="flex justify-between text-foreground">
              <span>{t('payment.shippingFee')}</span>
              <span className="tabular-nums">
                {shippingHuf === 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {t('payment.shippingFreeBadge')}
                  </span>
                ) : (
                  `${shippingHuf.toLocaleString('hu-HU')} Ft`
                )}
              </span>
            </div>
            {freeShippingRemainingHuf > 0 && (
              <p className="text-xs text-muted">
                {t('cart.freeShippingProgress', { amount: freeShippingRemainingHuf.toLocaleString('hu-HU') })}
              </p>
            )}
            {freeShippingRemainingHuf === 0 && checkoutPreview.merchandiseTotalHuf > 0 && shippingHuf === 0 && (
              <p className="text-xs text-green-600 dark:text-green-400">{t('cart.freeShippingReached')}</p>
            )}
            <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2 mt-1">
              <span>{t('payment.totalDue')}</span>
              <span className="tabular-nums">
                {cardTotalHuf.toLocaleString('hu-HU')} Ft{' '}
                <span className="text-muted text-sm font-normal">(€{formatEur(totalEur)})</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {!userId && (
        <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{t('payment.guestCheckout') || 'Vendég vásárlás'}</h2>
          <label htmlFor="guest-email" className="block text-sm font-medium text-foreground mb-1">
            E-mail <span className="text-muted">(a rendeléshez kötelező)</span>
          </label>
          <input
            id="guest-email"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="pelda@email.hu"
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground mb-2"
          />
          <p className="text-xs text-muted">{t('payment.guestCheckoutNote') || 'Regisztráció opcionális. A rendeléshez add meg az e-mail címed.'}</p>
        </section>
      )}

      {userId && pointsPreview && pointsPreview.maxUsablePointsDiscountHuf > 0 && (
        <section className="mb-8 p-4 rounded-xl border border-accent/30 bg-accent/5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
            />
            <span className="text-sm text-foreground">
              {t('payment.usePoints')
                .replace('{points}', String(pointsPreview.maxUsablePoints))
                .replace('{huf}', pointsPreview.maxUsablePointsDiscountHuf.toLocaleString('hu-HU'))
                .replace('{percent}', String(Math.round(MAX_CART_POINTS_COVERAGE * 100)))}
            </span>
          </label>
          <p className="text-xs text-muted mt-2 ml-7">
            {t('payment.pointsRate').replace('{rate}', String(POINTS_PER_HUF))}
          </p>
          {userId && luckySpinDiscount.active && usePoints && (
            <p className="text-xs text-accent mt-1 ml-7">{t('luckySpin.pointsBonusHint')}</p>
          )}
        </section>
      )}

      <section className="mb-8 p-4 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--card-bg)]">
        <button
          type="button"
          onClick={() => setCouponExpanded((v) => !v)}
          className="w-full flex items-center justify-between text-left font-heading font-semibold text-foreground"
        >
          <span>{t('payment.addCouponTitle')}</span>
          <span className="text-muted text-lg leading-none">{couponExpanded ? '−' : '+'}</span>
        </button>
        {couponExpanded && (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value)}
                placeholder={t('payment.couponPlaceholder')}
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground text-sm"
              />
              <button
                type="button"
                onClick={handleCouponApply}
                className="shrink-0 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:opacity-90"
              >
                {t('payment.couponApply')}
              </button>
            </div>
            {couponActive && (
              <p className="text-sm text-discount">
                {t('payment.couponApplied', { percent: Math.round(discountPercent * 100) })}
                {effectiveCouponDiscountHuf > 0 && (
                  <span className="ml-1">(−{effectiveCouponDiscountHuf.toLocaleString('hu-HU')} Ft)</span>
                )}
              </p>
            )}
            {couponMessage && (
              <p className="text-sm text-muted" role="status">{couponMessage}</p>
            )}
            {!userId && (
              <p className="text-xs text-muted">{t('coupon.loggedInRequired')}</p>
            )}
          </div>
        )}
        {!couponExpanded && couponActive && effectiveCouponDiscountHuf > 0 && (
          <p className="text-sm text-discount mt-2">
            {t('payment.couponDiscountLine')}: −{effectiveCouponDiscountHuf.toLocaleString('hu-HU')} Ft
          </p>
        )}
      </section>

      <section className="mb-8 p-4 rounded-xl border-2 border-[var(--border)] bg-[var(--card-bg)]">
        <p className="text-sm text-muted mb-3">{t('payment.cardOnly')}</p>
        <p className="text-xs text-muted mb-4">{t('payment.secureNote')}</p>
        <p className="flex items-center gap-2 text-sm text-foreground mb-4">
          <LockIcon className="w-5 h-5 text-accent shrink-0" />
          {t('payment.securePayment') || 'Biztonságos fizetés'}
        </p>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4" role="alert">
            {error}
          </p>
        )}
        {checkoutResult && (
          <div className="mb-4 p-4 rounded-lg bg-[var(--border)]/50 space-y-2" role="status">
            {checkoutResult.payments.some((p) => p.orderType === 'in_stock') && (
              <p className="text-sm text-foreground">
                {t('checkout.statusStock') || 'Raktári termékek: fizetés feldolgozása…'}
              </p>
            )}
            {checkoutResult.payments.some((p) => p.orderType === 'sourcing') && (
              <p className="text-sm text-foreground">
                {t('checkout.statusSourcing') || 'Limitált beszerzés: fizetés zárolása…'}
              </p>
            )}
            <p className="text-xs text-muted mt-2">
              {t('checkout.redirectToSummary') || 'Átirányítás a rendelés összefoglalóhoz…'}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handlePayByCard}
          disabled={loading || !!checkoutResult}
          className="w-full py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('payment.redirecting') : checkoutResult ? (t('checkout.redirecting') || 'Átirányítás…') : t('payment.payWithCard')}
        </button>
      </section>

      <Link
        href="/kosar"
        className="inline-block text-muted hover:text-foreground text-sm font-medium"
      >
        ← {t('payment.backToCart')}
      </Link>
    </div>
  )
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}
