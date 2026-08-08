'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
import { getLuckySpinNextTierRemaining } from '@/lib/gamification/lucky-spin'
import { PaymentTrustBadges } from '@/components/PaymentTrustBadges'
import { WELCOME_CHECKOUT_COUPON_PERCENT } from '@/lib/coupon-config'

function createCheckoutIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

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
  /** Checkout welcome 10% + hírlevél (csak ha még nem feliratkozott / nem váltotta be). */
  const [welcomeOfferEligible, setWelcomeOfferEligible] = useState(false)
  const [welcomeOfferAccepted, setWelcomeOfferAccepted] = useState(false)
  const [welcomeOfferBusy, setWelcomeOfferBusy] = useState(false)
  const [welcomeOfferError, setWelcomeOfferError] = useState<string | null>(null)
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
  const checkoutInFlightRef = useRef(false)
  const idempotencyKeyRef = useRef<string | null>(null)

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
  let usingWelcomeOffer = false
  if (welcomeOfferAccepted && !couponActive) {
    effectiveCouponPercent = WELCOME_CHECKOUT_COUPON_PERCENT
    usingWelcomeOffer = true
  } else if (couponActive && discountPercent > 0) {
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
  const luckySpinDiscountPercent = luckySpinDiscount.discountPercent
  const luckySpinNextTierRemaining = getLuckySpinNextTierRemaining(luckySpinDiscount.qualifyingItemCount)

  useEffect(() => {
    if (couponActive) setCouponExpanded(true)
  }, [couponActive])

  useEffect(() => {
    if (!couponActive && !welcomeOfferAccepted && userId) {
      fetch(`/api/loyalty?email=${encodeURIComponent(userId)}`)
        .then((r) => r.json())
        .then((d) => setLoyaltyPercent(d.loyaltyPercent ?? 0))
        .catch(() => setLoyaltyPercent(0))
    } else {
      setLoyaltyPercent(0)
    }
  }, [couponActive, welcomeOfferAccepted, userId])

  // Welcome ajánlat elérhetőség (bejelentkezett vagy érvényes vendég e-mail)
  useEffect(() => {
    const email = (userId || guestEmail).trim().toLowerCase()
    if (couponActive) {
      setWelcomeOfferEligible(false)
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Vendég: e-mail nélkül is mutathatjuk a dobozt, de elfogadáshoz kell e-mail
      if (!userId) {
        setWelcomeOfferEligible(true)
      } else {
        setWelcomeOfferEligible(false)
      }
      return
    }

    let cancelled = false
    fetch(`/api/checkout/welcome-offer?email=${encodeURIComponent(email)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.claimedPending) {
          // Előzőleg elfogadta (még nem fizetett) – tartsuk a 10%-ot
          setWelcomeOfferAccepted(true)
          setWelcomeOfferEligible(false)
          return
        }
        setWelcomeOfferEligible(Boolean(data.eligible))
        if (!data.eligible && data.hasRedeemedWelcomeCoupon) {
          setWelcomeOfferAccepted(false)
        }
      })
      .catch(() => {
        if (!cancelled) setWelcomeOfferEligible(false)
      })
    return () => {
      cancelled = true
    }
    // welcomeOfferAccepted szándékosan nincs a deps-ben (ne loopoljon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, guestEmail, couponActive])

  const loyaltyDiscountOnTotal =
    !couponActive && !usingWelcomeOffer && loyaltyPercent > 0 ? couponDiscountOnTotal : 0
  const effectiveCouponDiscountHuf =
    (couponActive || usingWelcomeOffer) && couponDiscountOnTotal > 0
      ? couponDiscountOnTotal
      : loyaltyDiscountOnTotal > 0
        ? loyaltyDiscountOnTotal
        : 0
  const totalEur = hufToEur(cardTotalHuf)

  const handleWelcomeOfferToggle = async (checked: boolean) => {
    setWelcomeOfferError(null)
    if (!checked) {
      setWelcomeOfferAccepted(false)
      return
    }
    const email = (userId || guestEmail).trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWelcomeOfferError(
        t('payment.welcomeOfferEmailRequired') ||
          'A 10% kedvezményhez add meg az e-mail címed (vendég vásárlás).'
      )
      setWelcomeOfferAccepted(false)
      return
    }
    if (couponActive) {
      setWelcomeOfferError(
        t('payment.welcomeOfferCouponConflict') ||
          'Már van aktív kuponod – a welcome 10% nem kombinálható vele.'
      )
      return
    }

    setWelcomeOfferBusy(true)
    try {
      const res = await fetch('/api/checkout/welcome-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWelcomeOfferAccepted(false)
        setWelcomeOfferEligible(false)
        setWelcomeOfferError(data.error || t('payment.welcomeOfferError') || 'Az ajánlat nem elérhető.')
        return
      }
      setWelcomeOfferAccepted(true)
      setWelcomeOfferEligible(false)
    } catch {
      setWelcomeOfferAccepted(false)
      setWelcomeOfferError(t('payment.welcomeOfferError') || 'Az ajánlat nem elérhető.')
    } finally {
      setWelcomeOfferBusy(false)
    }
  }

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
    const discountedUnitHuf = showPromoPrice && luckySpinDiscountPercent > 0
      ? Math.round(unitPriceHuf * (1 - luckySpinDiscountPercent))
      : unitPriceHuf
    const lineKey = `${item.productId}-${item.options?.colorHex ?? ''}-${item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`

    return (
      <li key={lineKey} className="flex justify-between gap-3 text-sm">
        <div className="min-w-0">
          <span className="text-foreground">{name} × {item.qty}</span>
          {item.options?.colorName && (
            <p className="text-xs text-muted mt-0.5">
              <span>{t('product.color')}: {item.options.colorName}</span>
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

  const handlePayByCard = useCallback(async () => {
    if (checkoutInFlightRef.current || loading || checkoutResult) return

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

    checkoutInFlightRef.current = true
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createCheckoutIdempotencyKey()
    }

    setLoading(true)
    trackBeginCheckout(cardTotalHuf)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map(({ productId, qty, options }) => ({
            productId,
            qty,
            ...(options && (options.colorName != null || options.colorHex != null || options.materialName != null) ? { options } : {}),
          })),
          customer: { email },
          isDiscountActive: couponActive && !welcomeOfferAccepted,
          discountPercent: couponActive && !welcomeOfferAccepted ? discountPercent : undefined,
          welcomeOfferAccepted: welcomeOfferAccepted || undefined,
          pointsDiscountHuf: pointsDiscountHuf > 0 ? pointsDiscountHuf : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const isTimedOfferError = res.status === 400 && (data.code === 'timed_offer_unavailable' || data.error?.includes('timed'))
        setError(isTimedOfferError ? t('payment.timedOfferNoLongerAvailable') : (data.error || t('payment.errorCreateSession')))
        idempotencyKeyRef.current = null
        checkoutInFlightRef.current = false
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
        checkoutInFlightRef.current = false
        setLoading(false)
        setTimeout(() => {
          router.push(`/fizetes/siker?order_group_id=${encodeURIComponent(data.orderGroupId)}`)
        }, 2000)
        return
      }
      setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments || [] })
      void refreshWallet()
      checkoutInFlightRef.current = false
      setLoading(false)
      setTimeout(() => {
        router.push(`/fizetes/siker?order_group_id=${encodeURIComponent(data.orderGroupId)}`)
      }, 2500)
    } catch {
      setError(t('payment.errorCreateSession'))
      idempotencyKeyRef.current = null
      checkoutInFlightRef.current = false
      setLoading(false)
    }
  }, [
    loading,
    checkoutResult,
    userId,
    guestEmail,
    t,
    cardTotalHuf,
    items,
    couponActive,
    discountPercent,
    welcomeOfferAccepted,
    pointsDiscountHuf,
    refreshWallet,
    router,
  ])

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

        {luckySpinRecord && luckySpinNextTierRemaining != null && luckySpinDiscount.qualifyingItemCount > 0 && (
          <p className="text-xs text-muted mb-3 leading-tight">
            {t('luckySpin.cartProgress').replace(
              '{remaining}',
              String(luckySpinNextTierRemaining)
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
                        percent: Math.round(luckySpinDiscountPercent * 100),
                      })}
                    </span>
                    <span className="tabular-nums">−{luckySpinDiscount.discountHuf.toLocaleString('hu-HU')} Ft</span>
                  </div>
                )}
                {effectiveCouponDiscountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span className="inline-flex items-center gap-1.5">
                      <span>
                        {usingWelcomeOffer
                          ? t('payment.welcomeOfferDiscountLine', {
                              percent: Math.round(WELCOME_CHECKOUT_COUPON_PERCENT * 100),
                            }) ||
                            `Hírlevél welcome kedvezmény (${Math.round(WELCOME_CHECKOUT_COUPON_PERCENT * 100)}%)`
                          : couponActive
                            ? t('payment.couponDiscountWithCode', {
                                percent: Math.round(
                                  (couponActive ? discountPercent : loyaltyPercent / 100) * 100
                                ),
                              })
                            : t('payment.loyaltyDiscountLine', { percent: loyaltyPercent })}
                      </span>
                      {!usingWelcomeOffer && (
                        <button
                          type="button"
                          title={t('payment.couponScopeHint')}
                          aria-label={t('payment.couponScopeHint')}
                          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] leading-none opacity-70 hover:opacity-100"
                        >
                          i
                        </button>
                      )}
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

      {(welcomeOfferEligible || welcomeOfferAccepted) && !couponActive && (
        <section
          className={`mb-8 rounded-xl border-2 p-5 transition-colors ${
            welcomeOfferAccepted
              ? 'border-emerald-600/50 bg-emerald-600/10'
              : 'border-accent/50 bg-gradient-to-br from-accent/10 via-[var(--card-bg)] to-amber-500/10'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">
            {t('payment.welcomeOfferBadge') || 'Exkluzív ajánlat'}
          </p>
          <h2 className="font-heading text-lg font-bold text-foreground mb-2">
            {t('payment.welcomeOfferTitle') ||
              'Szeretnél 10% kedvezményt ebből a vásárlásból?'}
          </h2>
          <p className="text-sm text-muted mb-4">
            {t('payment.welcomeOfferDesc') ||
              'Iratkozz fel hírlevelünkre, és a kedvezményt azonnal levonjuk a végösszegből!'}
          </p>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-[var(--border)] bg-background/80 p-3">
            <input
              id="welcome-offer"
              type="checkbox"
              checked={welcomeOfferAccepted}
              disabled={welcomeOfferBusy || (welcomeOfferAccepted && !welcomeOfferEligible)}
              onChange={(e) => void handleWelcomeOfferToggle(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
            />
            <span className="text-sm text-foreground font-medium">
              {t('payment.welcomeOfferCheckbox') ||
                'Igen, kérem a 10% kedvezményt, és elfogadom a marketing megkereséseket!'}
            </span>
          </label>
          {welcomeOfferBusy && (
            <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('payment.welcomeOfferSaving') || 'Kedvezmény aktiválása…'}
            </p>
          )}
          {welcomeOfferAccepted && !welcomeOfferBusy && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
              {t('payment.welcomeOfferApplied') ||
                '✓ 10% kedvezmény alkalmazva. Hírlevél feliratkozás rögzítve.'}
            </p>
          )}
          {welcomeOfferError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
              {welcomeOfferError}
            </p>
          )}
          {!userId && !guestEmail.trim() && (
            <p className="text-xs text-muted mt-2">
              {t('payment.welcomeOfferEmailHint') ||
                'Vendégként előbb add meg az e-mail címed a fenti mezőben.'}
            </p>
          )}
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
        <PaymentTrustBadges className="mb-4" />
        <button
          type="button"
          onClick={handlePayByCard}
          disabled={loading || !!checkoutResult}
          aria-busy={loading}
          aria-disabled={loading || !!checkoutResult}
          className="w-full py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden />}
          <span>
            {loading
              ? t('payment.redirecting')
              : checkoutResult
                ? (t('checkout.redirecting') || 'Átirányítás…')
                : t('payment.payWithCard')}
          </span>
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
