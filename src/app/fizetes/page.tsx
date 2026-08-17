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
import { getProductById as getProductByIdFromData } from '@/lib/data'
import { useProducts } from '@/context/ProductsContext'
import { resolveCartLine } from '@/lib/cart-line'
import { usePointWallet } from '@/hooks/usePointWallet'
import { optimisticRedeemPoints, stashPendingPointsRedeem } from '@/lib/point-wallet-client'
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
import { CouponSelector } from '@/components/CouponSelector'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  type SelectableCouponId,
} from '@/lib/coupon-selection'

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
  const { items, clearCart } = useCart()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { catStatus, registrationStatus } = useCatCoupon()
  const { hufToEur, formatEur } = useEuroRate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loyaltyPercent, setLoyaltyPercent] = useState(0)
  const [guestEmail, setGuestEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [shippingPostalCode, setShippingPostalCode] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingStreet, setShippingStreet] = useState('')
  const [shippingHouseNumber, setShippingHouseNumber] = useState('')
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true)
  const [billingPostalCode, setBillingPostalCode] = useState('')
  const [billingCity, setBillingCity] = useState('')
  const [billingStreet, setBillingStreet] = useState('')
  const [billingHouseNumber, setBillingHouseNumber] = useState('')
  const [addressType, setAddressType] = useState<'home' | 'business'>('home')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [usePoints, setUsePoints] = useState(false)
  const [couponCodeInput, setCouponCodeInput] = useState('')
  const [selectedCouponIds, setSelectedCouponIds] = useState<SelectableCouponId[]>([])
  const [birthdayCouponBanner, setBirthdayCouponBanner] = useState<{
    code: string
    percent: number
    validUntil: string
  } | null>(null)
  /** Checkout welcome 10% + hírlevél (csak ha még nem feliratkozott / nem váltotta be). */
  const [welcomeOfferEligible, setWelcomeOfferEligible] = useState(false)
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

  const availableCoupons = useMemo(
    () =>
      buildPromoCoupons({
        catClaimed: catStatus === 'claimed',
        registrationClaimed: registrationStatus === 'claimed',
        loyaltyPercent,
        welcomeEligible: welcomeOfferEligible,
        birthday: birthdayCouponBanner
          ? {
              code: birthdayCouponBanner.code,
              percent: birthdayCouponBanner.percent,
              validUntil: birthdayCouponBanner.validUntil,
            }
          : null,
        labels: {
          cat: t('payment.couponCatLabel') || 'Macska játék kupon',
          registration: t('payment.couponRegistrationLabel') || 'Regisztrációs kupon',
          loyalty: t('payment.loyaltyDiscountLine', { percent: loyaltyPercent }) || `Hűségkedvezmény (${loyaltyPercent}%)`,
          welcome: t('payment.welcomeOfferDiscountLine', {
            percent: Math.round(WELCOME_CHECKOUT_COUPON_PERCENT * 100),
          }) || 'Hírlevél welcome kedvezmény (10%)',
          birthday: t('payment.birthdayCouponTitle', {
            percent: birthdayCouponBanner?.percent ?? 15,
          }) || 'Születésnapi kupon',
        },
      }),
    [
      catStatus,
      registrationStatus,
      loyaltyPercent,
      welcomeOfferEligible,
      birthdayCouponBanner,
      t,
    ]
  )

  const couponSelection = useMemo(
    () => calculateSelectedCouponPercent(availableCoupons, selectedCouponIds),
    [availableCoupons, selectedCouponIds]
  )

  const effectiveCouponPercent = couponSelection.finalPercent

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
  const pointsUsedPreview = checkoutPreview.pointsUsed
  const shippingHuf = checkoutPreview.shippingHuf
  const cardTotalHuf = checkoutPreview.finalTotalHuf
  const freeShippingRemainingHuf = checkoutPreview.freeShippingRemainingHuf
  const effectiveCouponDiscountHuf = couponDiscountOnTotal > 0 ? couponDiscountOnTotal : 0

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

  // Profil: születésnapi kupon + mentett név előtöltés
  useEffect(() => {
    if (!userId) {
      setBirthdayCouponBanner(null)
      return
    }
    let cancelled = false
    fetch('/api/me/profile', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (typeof data.user?.name === 'string' && data.user.name.trim()) {
          setCustomerName((prev) => prev || data.user.name.trim())
        }
        if (!data.birthdayCoupon?.code) return
        const bc = data.birthdayCoupon as { code: string; percent: number; validUntil: string }
        setBirthdayCouponBanner({
          code: bc.code,
          percent: bc.percent,
          validUntil: bc.validUntil,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setLoyaltyPercent(0)
      return
    }
    fetch(`/api/loyalty?email=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setLoyaltyPercent(d.loyaltyPercent ?? 0))
      .catch(() => setLoyaltyPercent(0))
  }, [userId])

  // Welcome ajánlat elérhetőség (lista elemként; nincs auto-apply)
  useEffect(() => {
    const email = (userId || guestEmail).trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (!userId) setWelcomeOfferEligible(true)
      else setWelcomeOfferEligible(false)
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
          setWelcomeOfferEligible(true)
          setSelectedCouponIds((prev) =>
            prev.includes('welcome') ? prev : [...prev, 'welcome']
          )
          return
        }
        setWelcomeOfferEligible(Boolean(data.eligible))
      })
      .catch(() => {
        if (!cancelled) setWelcomeOfferEligible(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, guestEmail])

  // Birthday kód szinkron a kijelöléssel
  useEffect(() => {
    if (couponSelection.birthdayCode) {
      setCouponCodeInput(couponSelection.birthdayCode)
    } else if (!selectedCouponIds.includes('birthday')) {
      setCouponCodeInput('')
    }
  }, [couponSelection.birthdayCode, selectedCouponIds])

  const totalEur = hufToEur(cardTotalHuf)

  const handleCouponSelectionChange = async (next: SelectableCouponId[]) => {
    setWelcomeOfferError(null)
    const turningWelcomeOn = next.includes('welcome') && !selectedCouponIds.includes('welcome')
    if (turningWelcomeOn) {
      const email = (userId || guestEmail).trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setWelcomeOfferError(
          t('payment.welcomeOfferEmailRequired') ||
            'A 10% kedvezményhez add meg az e-mail címed (vendég vásárlás).'
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
          setWelcomeOfferError(data.error || t('payment.welcomeOfferError') || 'Az ajánlat nem elérhető.')
          return
        }
      } catch {
        setWelcomeOfferError(t('payment.welcomeOfferError') || 'Az ajánlat nem elérhető.')
        return
      } finally {
        setWelcomeOfferBusy(false)
      }
    }
    setSelectedCouponIds(next)
  }

  const renderLineItem = (item: (typeof items)[number]) => {
    const product = getProductById(item.productId)
    const resolved = resolveCartLine(item, product, locale)
    const line = lockedLines.find((l) => l.productId === item.productId)
    const unitPriceHuf = line?.priceHuf ?? resolved.priceHuf
    const isPromo = spinProductIds.has(item.productId)
    const showPromoPrice = isPromo && luckySpinDiscountActive
    const discountedUnitHuf = showPromoPrice && luckySpinDiscountPercent > 0
      ? Math.round(unitPriceHuf * (1 - luckySpinDiscountPercent))
      : unitPriceHuf
    const lineKey = `${item.productId}-${item.options?.colorHex ?? ''}-${item.options?.colorName ?? ''}-${item.options?.materialName ?? ''}`

    return (
      <li key={lineKey} className="flex justify-between gap-3 text-sm">
        <div className="min-w-0">
          <span className="text-foreground">{resolved.name} × {item.qty}</span>
          {item.options?.colorName && (
            <p className="text-xs text-muted mt-0.5">
              <span>{t('product.color')}: {item.options.colorName}</span>
            </p>
          )}
          {item.options?.materialName && (
            <p className="text-xs text-muted mt-0.5">
              <span>{t('product.material')}: {item.options.materialName}</span>
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
    if (!customerName.trim()) {
      setError(t('payment.nameRequired') || 'A teljes név kötelező.')
      return
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 7) {
      setError(t('payment.phoneRequired') || 'Érvényes telefonszám kötelező.')
      return
    }
    if (
      !shippingPostalCode.trim() ||
      !shippingCity.trim() ||
      !shippingStreet.trim() ||
      !shippingHouseNumber.trim()
    ) {
      setError(t('payment.shippingRequired') || 'A szállítási cím minden mezője kötelező.')
      return
    }
    if (
      !billingSameAsShipping &&
      (!billingPostalCode.trim() ||
        !billingCity.trim() ||
        !billingStreet.trim() ||
        !billingHouseNumber.trim())
    ) {
      setError(t('payment.billingRequired') || 'A számlázási cím minden mezője kötelező.')
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
          customer: {
            email,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            shipping: {
              postalCode: shippingPostalCode.trim(),
              city: shippingCity.trim(),
              street: shippingStreet.trim(),
              houseNumber: shippingHouseNumber.trim(),
            },
            billingSameAsShipping,
            addressType,
            ...(deliveryNotes.trim() ? { deliveryNotes: deliveryNotes.trim() } : {}),
            ...(billingSameAsShipping
              ? {}
              : {
                  billing: {
                    postalCode: billingPostalCode.trim(),
                    city: billingCity.trim(),
                    street: billingStreet.trim(),
                    houseNumber: billingHouseNumber.trim(),
                  },
                }),
          },
          // Kedvezmény % NEM a kliensről – szerver couponCode + selectedCoupons alapján számol
          couponCode: couponSelection.birthdayCode || couponCodeInput.trim() || undefined,
          welcomeOfferAccepted: couponSelection.useWelcome ? true : undefined,
          selectedCoupons: couponSelection.selectedIds,
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
      // Azonnali UI: pontok levonása a fejlécből / profilból (ne várjunk webhookra)
      const pointsUsedNow =
        typeof data.pointsApplied?.pointsUsed === 'number'
          ? data.pointsApplied.pointsUsed
          : pointsUsedPreview > 0
            ? pointsUsedPreview
            : 0
      if (pointsUsedNow > 0) {
        const balanceBefore =
          pointsPreview?.balance ?? wallet?.balance ?? pointsUsedNow
        stashPendingPointsRedeem(pointsUsedNow, balanceBefore)
        void optimisticRedeemPoints(pointsUsedNow, {
          persist: true,
          balanceBefore,
        })
      }
      const redirectPayment = data.payments?.find((p: { type: string }) => p.type === 'redirect')
      if (redirectPayment?.url) {
        // Stripe / külső redirect: kosár a siker oldalon ürül (megszakításkor megmarad)
        window.location.href = redirectPayment.url
        return
      }
      const clientSecretPayment = data.payments?.find((p: { type: string }) => p.type === 'client_secret')
      if (clientSecretPayment?.clientSecret) {
        setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments })
        checkoutInFlightRef.current = false
        setLoading(false)
        clearCart()
        setTimeout(() => {
          router.push(`/fizetes/siker?order_group_id=${encodeURIComponent(data.orderGroupId)}`)
        }, 2000)
        return
      }
      setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments || [] })
      void refreshWallet()
      checkoutInFlightRef.current = false
      setLoading(false)
      clearCart()
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
    customerName,
    customerPhone,
    shippingPostalCode,
    shippingCity,
    shippingStreet,
    shippingHouseNumber,
    billingSameAsShipping,
    billingPostalCode,
    billingCity,
    billingStreet,
    billingHouseNumber,
    addressType,
    deliveryNotes,
    t,
    cardTotalHuf,
    items,
    couponSelection,
    couponCodeInput,
    pointsDiscountHuf,
    pointsUsedPreview,
    pointsPreview?.balance,
    wallet?.balance,
    refreshWallet,
    router,
    clearCart,
  ])

  if (items.length === 0 && !checkoutResult) {
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
                        {t('payment.couponDiscountWithCode', {
                          percent: Math.round(effectiveCouponPercent * 100),
                        })}
                        {couponSelection.capped
                          ? ` (${t('payment.couponCappedHint') || 'max. 20%'})`
                          : ''}
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

      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('payment.customerDetailsTitle') || 'Szállítási adatok'}
        </h2>
        <p className="text-xs text-muted -mt-2">
          {userId
            ? t('payment.customerDetailsLoggedInHint') || 'A rendeléshez add meg a kapcsolattartási és szállítási adatokat.'
            : t('payment.guestCheckoutNote') || 'Regisztráció opcionális. A rendeléshez add meg az adataidat.'}
        </p>

        {!userId && (
          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium text-foreground mb-1">
              {t('payment.emailLabel') || 'E-mail'} <span className="text-muted">*</span>
            </label>
            <input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="pelda@email.hu"
              autoComplete="email"
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              required
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="checkout-name" className="block text-sm font-medium text-foreground mb-1">
              {t('payment.fullNameLabel') || 'Teljes név'} <span className="text-muted">*</span>
            </label>
            <input
              id="checkout-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              autoComplete="name"
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="checkout-phone" className="block text-sm font-medium text-foreground mb-1">
              {t('payment.phoneLabel') || 'Telefonszám'} <span className="text-muted">*</span>
            </label>
            <input
              id="checkout-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+36 30 123 4567"
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              required
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('payment.shippingAddressTitle') || 'Szállítási cím'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="checkout-shipping-postal" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.postalCodeLabel') || 'Irányítószám'} *
              </label>
              <input
                id="checkout-shipping-postal"
                type="text"
                value={shippingPostalCode}
                onChange={(e) => setShippingPostalCode(e.target.value)}
                autoComplete="postal-code"
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                required
              />
            </div>
            <div>
              <label htmlFor="checkout-shipping-city" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.cityLabel') || 'Város'} *
              </label>
              <input
                id="checkout-shipping-city"
                type="text"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                autoComplete="address-level2"
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                required
              />
            </div>
            <div>
              <label htmlFor="checkout-shipping-street" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.streetLabel') || 'Utca'} *
              </label>
              <input
                id="checkout-shipping-street"
                type="text"
                value={shippingStreet}
                onChange={(e) => setShippingStreet(e.target.value)}
                autoComplete="address-line1"
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                required
              />
            </div>
            <div>
              <label htmlFor="checkout-shipping-house" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.houseNumberLabel') || 'Házszám'} *
              </label>
              <input
                id="checkout-shipping-house"
                type="text"
                value={shippingHouseNumber}
                onChange={(e) => setShippingHouseNumber(e.target.value)}
                autoComplete="address-line2"
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="checkout-address-type" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.addressTypeLabel') || 'Cím típusa'}
              </label>
              <select
                id="checkout-address-type"
                value={addressType}
                onChange={(e) => setAddressType(e.target.value === 'business' ? 'business' : 'home')}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              >
                <option value="home">{t('payment.addressTypeHome') || 'Lakás / Magáncím'}</option>
                <option value="business">{t('payment.addressTypeBusiness') || 'Cég / Munkahely'}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="checkout-delivery-notes" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.deliveryNotesLabel') || 'Megjegyzés a futárnak / Cím pontosítása'}{' '}
                <span className="text-muted font-normal">({t('common.optional')})</span>
              </label>
              <textarea
                id="checkout-delivery-notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder={
                  t('payment.deliveryNotesPlaceholder') ||
                  'Pl. kapukód, emelet, ajtó, csengő neve…'
                }
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground resize-y min-h-[5rem]"
              />
              <p className="mt-1.5 text-xs text-muted">
                {t('payment.deliveryNotesHint') ||
                  'Segítség a futárnak: kapukód, emelet/ajtó, csengő neve, kapu színe, munkahely neve.'}
              </p>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="checkout-billing-same"
            type="checkbox"
            checked={billingSameAsShipping}
            onChange={(e) => setBillingSameAsShipping(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
          />
          <span className="text-sm text-foreground">
            {t('payment.billingSameAsShipping') || 'A számlázási cím megegyezik a szállítási címmel'}
          </span>
        </label>

        {!billingSameAsShipping && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('payment.billingAddressTitle') || 'Számlázási cím'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="checkout-billing-postal" className="block text-sm font-medium text-foreground mb-1">
                  {t('payment.postalCodeLabel') || 'Irányítószám'} *
                </label>
                <input
                  id="checkout-billing-postal"
                  type="text"
                  value={billingPostalCode}
                  onChange={(e) => setBillingPostalCode(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label htmlFor="checkout-billing-city" className="block text-sm font-medium text-foreground mb-1">
                  {t('payment.cityLabel') || 'Város'} *
                </label>
                <input
                  id="checkout-billing-city"
                  type="text"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label htmlFor="checkout-billing-street" className="block text-sm font-medium text-foreground mb-1">
                  {t('payment.streetLabel') || 'Utca'} *
                </label>
                <input
                  id="checkout-billing-street"
                  type="text"
                  value={billingStreet}
                  onChange={(e) => setBillingStreet(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label htmlFor="checkout-billing-house" className="block text-sm font-medium text-foreground mb-1">
                  {t('payment.houseNumberLabel') || 'Házszám'} *
                </label>
                <input
                  id="checkout-billing-house"
                  type="text"
                  value={billingHouseNumber}
                  onChange={(e) => setBillingHouseNumber(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
                  required
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <CouponSelector
        coupons={availableCoupons}
        selectedIds={selectedCouponIds}
        onChange={(next) => void handleCouponSelectionChange(next)}
        title={t('payment.couponSelectorTitle') || 'Elérhető kuponok'}
        hint={
          t('payment.couponSelectorHint') ||
          'Válaszd ki manuálisan a kedvezmény(eke)t. Összesen legfeljebb 20%.'
        }
        emptyText={t('payment.couponSelectorEmpty') || 'Jelenleg nincs felhasználható kuponod.'}
        capReachedText={
          t('payment.couponCapReached') ||
          'A kiválasztott kuponok összege nem haladhatja meg a 20%-ot.'
        }
        selectedPercentDisplay={Math.round(couponSelection.finalPercent * 100)}
        capped={couponSelection.capped}
      />
      {welcomeOfferBusy && (
        <p className="text-xs text-muted -mt-6 mb-6 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('payment.welcomeOfferSaving') || 'Kedvezmény aktiválása…'}
        </p>
      )}
      {welcomeOfferError && (
        <p className="text-xs text-red-600 dark:text-red-400 -mt-4 mb-6" role="alert">
          {welcomeOfferError}
        </p>
      )}
      {!userId && selectedCouponIds.includes('welcome') && !guestEmail.trim() && (
        <p className="text-xs text-muted -mt-4 mb-6">
          {t('payment.welcomeOfferEmailHint') ||
            'Vendégként előbb add meg az e-mail címed a fenti mezőben.'}
        </p>
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
