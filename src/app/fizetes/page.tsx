'use client'

/** Fizetési oldal – Railway src watch-path 2026-08-20T20:12. */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useDisplayMoney } from '@/hooks/useDisplayMoney'
import { formatDisplayDate } from '@/lib/display-money'
import { checkoutErrorI18nKey } from '@/lib/checkout-client-errors'
import {
  readCheckoutPointsSelection,
  writeCheckoutPointsSelection,
} from '@/lib/checkout-points-selection'
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
} from '@/lib/checkout'
import { GIFT_POINTS_MAX_COVERAGE } from '@/lib/gamification/constants'
import { getLuckySpinNextTierRemaining } from '@/lib/gamification/lucky-spin'
import { PaymentTrustBadges } from '@/components/PaymentTrustBadges'
import { PaymentMethodPicker } from '@/components/PaymentMethodPicker'
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD,
  KLARNA_MIN_AMOUNT_HUF,
  isKlarnaEligible,
  type CheckoutPaymentMethod,
} from '@/lib/checkout-payment-methods'
import { WELCOME_CHECKOUT_COUPON_PERCENT, capCombinedCouponPercent } from '@/lib/coupon-config'
import { isAbandonedCartSource } from '@/lib/abandoned-cart-offer'
import { CouponSelector } from '@/components/CouponSelector'
import { GiftPointClaimForm } from '@/components/GiftPointClaimForm'
import type { CodeRedeemSuccess } from '@/components/GiftPointClaimForm'
import { localeNoticeText, type LocaleNotice } from '@/lib/locale-notice'
import {
  buildPromoCoupons,
  calculateSelectedCouponPercent,
  canToggleCoupon,
  fixedHufFromCoupon,
  isFixedAmountCoupon,
  isFixedSelectableCoupon,
  isGamificationCouponId,
  nextCouponSelection,
  toCheckoutSelectedCouponId,
  type SelectableCouponId,
} from '@/lib/coupon-selection'
import { listActiveCheckoutCoupons } from '@/lib/gamification/user-coupons'
import { readTypedCoupon, writeTypedCoupon, type StoredTypedCoupon } from '@/lib/typed-coupon-storage'

function createCheckoutIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export default function PaymentPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { money, copy, hufToEur, formatEur } = useDisplayMoney()
  const { userId } = useAuth()
  const { items, clearCart } = useCart()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { catStatus, registrationStatus } = useCatCoupon()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<LocaleNotice | null>(null)
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
  const [useGiftPoints, setUseGiftPoints] = useState(false)
  const [useActivityPoints, setUseActivityPoints] = useState(false)
  const [pointsSelectionReady, setPointsSelectionReady] = useState(false)
  const [couponCodeInput, setCouponCodeInput] = useState('')
  const [typedCoupon, setTypedCoupon] = useState<StoredTypedCoupon | null>(null)
  const [selectedCouponIds, setSelectedCouponIds] = useState<SelectableCouponId[]>([])
  const [birthdayCouponBanner, setBirthdayCouponBanner] = useState<{
    code: string
    percent: number
    validUntil: string
  } | null>(null)
  /** Checkout welcome 10% + hírlevél (csak ha még nem feliratkozott / nem váltotta be). */
  const [welcomeOfferEligible, setWelcomeOfferEligible] = useState(false)
  const [welcomeOfferBusy, setWelcomeOfferBusy] = useState(false)
  const [welcomeOfferError, setWelcomeOfferError] = useState<LocaleNotice | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>(DEFAULT_CHECKOUT_PAYMENT_METHOD)
  const [checkoutResult, setCheckoutResult] = useState<{
    orderGroupId: string
    payments: Array<{ orderType: 'in_stock' | 'sourcing'; type: string; url?: string; clientSecret?: string; message?: string }>
  } | null>(null)
  const [pointsPreview, setPointsPreview] = useState<{
    maxUsablePointsDiscountHuf: number
    maxUsablePoints: number
    balance: number
    giftPointsAvailable: number
    giftBalance: number
    activityBalance: number
    giftExpiresAt: string | null
    maxGiftDiscountHuf: number
    maxActivityDiscountHuf: number
    giftCoveragePercent: number
    activityCoveragePercent: number
    maxCoveragePercent: number
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

  const gamificationCoupons = useMemo(() => {
    const active = listActiveCheckoutCoupons(wallet?.coupons ?? [])
    if (active.length > 0) {
      return active.map((coupon) => {
        const checkoutCode = coupon.checkoutCode || coupon.code
        const isFixed = isFixedAmountCoupon(coupon)
        const fixedHuf = fixedHufFromCoupon(coupon)
        return {
          code: checkoutCode,
          percent: isFixed ? 0 : coupon.discountPercent,
          ...(fixedHuf ? { fixedHuf } : {}),
          validUntil: coupon.validUntil
            ? formatDisplayDate(coupon.validUntil, locale)
            : undefined,
          label: isFixed
            ? t('payment.couponFixedName', { code: coupon.code })
            : t('payment.couponGamificationLabel', {
                percent:
                  coupon.discountPercent > 1
                    ? coupon.discountPercent
                    : Math.round(coupon.discountPercent * 100),
              }),
        }
      })
    }
    if (!wallet?.hasActiveCoupon || !wallet.activeCouponCode) return []
    const percent = wallet.activeCouponPercent ?? 0
    if (percent <= 0) return []
    return [
      {
        code: wallet.activeCouponCode,
        percent,
        validUntil: wallet.activeCouponValidUntil
          ? formatDisplayDate(wallet.activeCouponValidUntil, locale)
          : undefined,
        label: t('payment.couponGamificationLabel', {
          percent: percent > 1 ? percent : Math.round(percent * 100),
        }),
      },
    ]
  }, [wallet, locale, t])

  const availableCoupons = useMemo(
    () =>
      buildPromoCoupons({
        catClaimed: catStatus === 'claimed',
        registrationClaimed: registrationStatus === 'claimed',
        welcomeEligible: welcomeOfferEligible,
        birthday: birthdayCouponBanner
          ? {
              code: birthdayCouponBanner.code,
              percent: birthdayCouponBanner.percent,
              validUntil: formatDisplayDate(birthdayCouponBanner.validUntil, locale),
            }
          : null,
        gamification: gamificationCoupons,
        labels: {
          cat: t('payment.couponCatLabel'),
          registration: t('payment.couponRegistrationLabel'),
          loyalty: t('payment.loyaltyDiscountLine', { percent: loyaltyPercent }),
          welcome: t('payment.welcomeOfferDiscountLine', {
            percent: Math.round(WELCOME_CHECKOUT_COUPON_PERCENT * 100),
          }),
          birthday: t('payment.birthdayCouponTitle', {
            percent: birthdayCouponBanner?.percent ?? 15,
          }),
        },
      }),
    [
      catStatus,
      registrationStatus,
      welcomeOfferEligible,
      birthdayCouponBanner,
      gamificationCoupons,
      loyaltyPercent,
      locale,
      t,
    ]
  )

  const couponSelection = useMemo(
    () => calculateSelectedCouponPercent(availableCoupons, selectedCouponIds),
    [availableCoupons, selectedCouponIds]
  )

  const isAbandonedTypedCoupon = isAbandonedCartSource(typedCoupon?.source)

  const abandonedCartOffer =
    isAbandonedTypedCoupon && typedCoupon?.discountType === 'percent'
      ? {
          percent: capCombinedCouponPercent(typedCoupon.discountValue / 100),
          eligibleItems: typedCoupon.eligibleItems ?? [],
        }
      : null

  const effectiveCouponPercent =
    typedCoupon?.discountType === 'percent' && !isAbandonedTypedCoupon
      ? capCombinedCouponPercent(typedCoupon.discountValue / 100)
      : couponSelection.finalPercent

  const effectiveFixedHuf =
    typedCoupon?.discountType === 'fixed'
      ? typedCoupon.discountValue
      : couponSelection.gamificationFixedHuf

  const usePoints = useGiftPoints || useActivityPoints
  const hasBlockingCouponExtra =
    (Boolean(typedCoupon) && !isAbandonedTypedCoupon) ||
    selectedCouponIds.length > 0 ||
    effectiveCouponPercent > 0 ||
    Boolean(effectiveFixedHuf && effectiveFixedHuf > 0)
  const hasCouponExtra = hasBlockingCouponExtra

  const loyaltyFraction = loyaltyPercent > 0 ? loyaltyPercent / 100 : 0

  const checkoutPreview = computeCheckoutTotals({
    lines: lockedLines,
    coupon: {
      percent: effectiveCouponPercent,
      ...(effectiveFixedHuf && effectiveFixedHuf > 0 ? { fixedHuf: effectiveFixedHuf } : {}),
    },
    luckySpin: luckySpinRecord,
    loyaltyPercent: loyaltyFraction,
    abandonedCart: abandonedCartOffer,
    points:
      usePoints && !hasBlockingCouponExtra && pointsPreview
        ? {
            requestedDiscountHuf: Math.max(
              pointsPreview.balance,
              pointsPreview.maxUsablePointsDiscountHuf,
              pointsPreview.maxGiftDiscountHuf,
              pointsPreview.maxActivityDiscountHuf
            ),
            userBalance: pointsPreview.balance,
            giftPointsAvailable: pointsPreview.giftBalance || pointsPreview.giftPointsAvailable,
            spendGift: useGiftPoints,
            spendActivity: useActivityPoints,
          }
        : undefined,
  })

  const couponDiscountOnTotal = checkoutPreview.couponDiscountHuf
  const loyaltyDiscountHuf = checkoutPreview.loyaltyDiscountHuf
  const luckySpinDiscount = checkoutPreview.luckySpin
  const displayTotalHuf = checkoutPreview.afterCouponAndLuckyHuf
  const pointsDiscountHuf = checkoutPreview.pointsDiscountHuf
  const giftPointsUsedPreview = checkoutPreview.giftPointsUsed
  const activityPointsUsedPreview = checkoutPreview.activityPointsUsed
  const pointsUsedPreview = checkoutPreview.pointsUsed
  const shippingHuf = checkoutPreview.shippingHuf
  const cardTotalHuf = checkoutPreview.finalTotalHuf
  const invoiceMerchandiseHuf = checkoutPreview.invoiceMerchandiseHuf
  const invoiceTotalHuf = checkoutPreview.invoiceTotalHuf
  const payableHuf = usePoints ? invoiceTotalHuf : cardTotalHuf
  const klarnaEligible = isKlarnaEligible(payableHuf)
  const freeShippingRemainingHuf = checkoutPreview.freeShippingRemainingHuf
  const effectiveCouponDiscountHuf = couponDiscountOnTotal > 0 ? couponDiscountOnTotal : 0
  const percentCouponDiscountHuf = checkoutPreview.percentCouponDiscountHuf
  const fixedCouponDiscountHuf = checkoutPreview.fixedCouponDiscountHuf
  const fixedCouponUnusedHuf = checkoutPreview.fixedCouponUnusedHuf
  const showFixedRemainderWarning =
    Boolean(effectiveFixedHuf && effectiveFixedHuf > 0) &&
    ((effectiveFixedHuf ?? 0) > checkoutPreview.subtotalHuf || fixedCouponUnusedHuf > 0)

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
    if (!hasBlockingCouponExtra) return
    setUseGiftPoints(false)
    setUseActivityPoints(false)
  }, [hasBlockingCouponExtra])

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
    const email = (userId || guestEmail).trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoyaltyPercent(0)
      return
    }
    fetch(`/api/loyalty?email=${encodeURIComponent(email)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setLoyaltyPercent(Number(d.loyaltyPercent) || 0))
      .catch(() => setLoyaltyPercent(0))
  }, [userId, guestEmail])

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

  // Birthday / pontból váltott kód szinkron a kijelöléssel – begépelt admin kódot ne törölje
  useEffect(() => {
    if (typedCoupon) {
      setCouponCodeInput(typedCoupon.code)
      return
    }
    const dbCode = couponSelection.birthdayCode || couponSelection.gamificationCode
    if (dbCode) {
      setCouponCodeInput(dbCode)
      return
    }
    if (
      !selectedCouponIds.includes('birthday') &&
      !selectedCouponIds.some((id) => isGamificationCouponId(id))
    ) {
      setCouponCodeInput('')
    }
  }, [couponSelection.birthdayCode, couponSelection.gamificationCode, selectedCouponIds, typedCoupon])

  const autoSelectedGamificationRef = useRef<string | null>(null)
  useEffect(() => {
    if (useGiftPoints || useActivityPoints) return
    const firstFixed = availableCoupons.find(
      (c) => isGamificationCouponId(c.id) && (c.fixedHuf ?? 0) > 0
    )
    const first = firstFixed ?? availableCoupons.find((c) => isGamificationCouponId(c.id))
    if (!first) {
      autoSelectedGamificationRef.current = null
      return
    }
    if (typedCoupon?.discountType === 'fixed' && (first.fixedHuf ?? 0) > 0) {
      return
    }
    const selectionId = first.id
    if (autoSelectedGamificationRef.current === selectionId) return
    autoSelectedGamificationRef.current = selectionId
    setSelectedCouponIds((prev) => {
      const alreadyHasFixed = prev.some((id) =>
        isFixedSelectableCoupon(availableCoupons.find((c) => c.id === id))
      )
      if (alreadyHasFixed && isFixedSelectableCoupon(first)) return prev
      if (prev.some((id) => id === selectionId)) return prev
      if (prev.length > 0 && !(first.fixedHuf && first.fixedHuf > 0)) return prev
      if (!canToggleCoupon(availableCoupons, new Set(prev), selectionId, true)) return prev
      return nextCouponSelection(availableCoupons, new Set(prev), selectionId, true)
    })
  }, [availableCoupons, typedCoupon, useGiftPoints, useActivityPoints])

  useEffect(() => {
    const stored = readTypedCoupon()
    if (stored) {
      setTypedCoupon(stored)
      if (stored.discountType === 'percent' && !isAbandonedCartSource(stored.source)) {
        setSelectedCouponIds((prev) =>
          prev.filter((id) => isFixedSelectableCoupon(availableCoupons.find((c) => c.id === id)))
        )
      }
    }
    const pointsSel = readCheckoutPointsSelection()
    if (pointsSel) {
      setUseGiftPoints(pointsSel.useGiftPoints)
      setUseActivityPoints(pointsSel.useActivityPoints)
    }
    setPointsSelectionReady(true)
  }, [])

  useEffect(() => {
    if (!pointsSelectionReady) return
    writeCheckoutPointsSelection({ useGiftPoints, useActivityPoints })
  }, [pointsSelectionReady, useGiftPoints, useActivityPoints])

  const totalEur = hufToEur(cardTotalHuf)

  const applyTypedCoupon = (coupon: StoredTypedCoupon) => {
    setTypedCoupon(coupon)
    writeTypedCoupon(coupon)
    setCouponCodeInput(coupon.code)
    if (isAbandonedCartSource(coupon.source)) return
    setUseGiftPoints(false)
    setUseActivityPoints(false)
    setSelectedCouponIds((prev) => {
      if (coupon.discountType === 'fixed') {
        return prev.filter((id) => !isFixedSelectableCoupon(availableCoupons.find((c) => c.id === id)))
      }
      return prev.filter((id) => isFixedSelectableCoupon(availableCoupons.find((c) => c.id === id)))
    })
  }

  const clearTypedCoupon = () => {
    setTypedCoupon(null)
    writeTypedCoupon(null)
    setCouponCodeInput('')
  }

  const handleRedeemedCode = (result: CodeRedeemSuccess) => {
    if (result.kind === 'gift_points') {
      void refreshWallet()
      const couponExtra = Boolean(typedCoupon) || selectedCouponIds.length > 0
      if (!couponExtra) setUseGiftPoints(true)
      return
    }
    applyTypedCoupon({
      code: result.checkoutCode || result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      minOrderHuf: result.minOrderHuf,
    })
    void refreshWallet()
  }

  const handleCouponSelectionChange = async (next: SelectableCouponId[]) => {
    const nextCoupons = next
      .map((id) => availableCoupons.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
    const nextHasFixed = nextCoupons.some((c) => isFixedSelectableCoupon(c))
    const nextHasPercent = nextCoupons.some((c) => (c.percent ?? 0) > 0 && !isFixedSelectableCoupon(c))
    if (typedCoupon?.discountType === 'fixed' && nextHasFixed) {
      clearTypedCoupon()
    } else if (
      typedCoupon?.discountType === 'percent' &&
      !isAbandonedCartSource(typedCoupon.source) &&
      nextHasPercent
    ) {
      clearTypedCoupon()
    }
    setWelcomeOfferError(null)
    if (next.length > 0) {
      setUseGiftPoints(false)
      setUseActivityPoints(false)
    }
    const turningWelcomeOn = next.includes('welcome') && !selectedCouponIds.includes('welcome')
    if (turningWelcomeOn) {
      const email = (userId || guestEmail).trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setWelcomeOfferError({ key: 'payment.welcomeOfferEmailRequired' })
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
          setWelcomeOfferError({ key: 'payment.welcomeOfferError' })
          return
        }
      } catch {
        setWelcomeOfferError({ key: 'payment.welcomeOfferError' })
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
        </div>
        <span className="shrink-0 text-right text-muted tabular-nums">
          {showPromoPrice ? (
            <>
              <span className="line-through block">{money(unitPriceHuf)}</span>
              <span className="text-discount font-medium">{money(discountedUnitHuf)}</span>
            </>
          ) : (
            <span>{money(unitPriceHuf)}</span>
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
            giftPointsAvailable: data.giftPointsAvailable ?? 0,
            giftBalance: data.giftBalance ?? data.giftPointsAvailable ?? 0,
            activityBalance: data.activityBalance ?? Math.max(0, (data.balance ?? 0) - (data.giftPointsAvailable ?? 0)),
            giftExpiresAt: data.giftExpiresAt ?? null,
            maxGiftDiscountHuf: data.maxGiftDiscountHuf ?? 0,
            maxActivityDiscountHuf: data.maxActivityDiscountHuf ?? 0,
            giftCoveragePercent: data.giftCoveragePercent ?? GIFT_POINTS_MAX_COVERAGE,
            activityCoveragePercent: data.activityCoveragePercent ?? MAX_CART_POINTS_COVERAGE,
            maxCoveragePercent: data.maxCoveragePercent ?? MAX_CART_POINTS_COVERAGE,
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

  useEffect(() => {
    idempotencyKeyRef.current = null
  }, [paymentMethod])

  useEffect(() => {
    if (!klarnaEligible && paymentMethod === 'klarna') {
      setPaymentMethod(DEFAULT_CHECKOUT_PAYMENT_METHOD)
    }
  }, [klarnaEligible, paymentMethod])

  const payButtonLabel =
    paymentMethod === 'paypal'
      ? t('payment.payWithPaypal')
      : paymentMethod === 'apple_pay'
        ? t('payment.payWithApplePay')
        : paymentMethod === 'google_pay'
          ? t('payment.payWithGooglePay')
          : paymentMethod === 'klarna'
            ? t('payment.payWithKlarna')
            : t('payment.payWithCard')

  const handlePayByCard = useCallback(async () => {
    if (checkoutInFlightRef.current || loading || checkoutResult) return
    if (paymentMethod === 'klarna' && !klarnaEligible) {
      setError({ key: 'payment.errorKlarnaMinAmount' })
      return
    }

    setError(null)
    setCheckoutResult(null)
    if (!userId && !guestEmail.trim()) {
      setError({ key: 'payment.emailRequired' })
      return
    }
    const email = userId || guestEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError({ key: 'payment.emailInvalid' })
      return
    }
    if (!customerName.trim()) {
      setError({ key: 'payment.nameRequired' })
      return
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 7) {
      setError({ key: 'payment.phoneRequired' })
      return
    }
    if (
      !shippingPostalCode.trim() ||
      !shippingCity.trim() ||
      !shippingStreet.trim() ||
      !shippingHouseNumber.trim()
    ) {
      setError({ key: 'payment.shippingRequired' })
      return
    }
    if (
      !billingSameAsShipping &&
      (!billingPostalCode.trim() ||
        !billingCity.trim() ||
        !billingStreet.trim() ||
        !billingHouseNumber.trim())
    ) {
      setError({ key: 'payment.billingRequired' })
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
          couponCode:
            typedCoupon?.code ||
            couponSelection.fixedCouponCode ||
            couponSelection.percentCouponCode ||
            couponSelection.birthdayCode ||
            couponSelection.gamificationCode ||
            couponCodeInput.trim() ||
            undefined,
          couponCodes: [
                typedCoupon?.code,
                couponSelection.fixedCouponCode,
                couponSelection.percentCouponCode,
                couponSelection.birthdayCode,
                couponSelection.gamificationCode,
                couponCodeInput.trim(),
              ]
                .map((code) => code?.trim())
                .filter((code): code is string => Boolean(code))
                .filter((code, index, all) => all.findIndex((c) => c.toUpperCase() === code.toUpperCase()) === index)
                .slice(0, 2),
          welcomeOfferAccepted: couponSelection.useWelcome ? true : undefined,
          selectedCoupons: couponSelection.selectedIds
            .filter((id) => id !== 'loyalty')
            .map((id) => toCheckoutSelectedCouponId(id)),
          pointsDiscountHuf:
            !hasBlockingCouponExtra && pointsDiscountHuf > 0 ? pointsDiscountHuf : undefined,
          useGiftPoints: !hasBlockingCouponExtra && usePoints ? useGiftPoints : undefined,
          useActivityPoints: !hasBlockingCouponExtra && usePoints ? useActivityPoints : undefined,
          paymentMethod,
          locale,
        }),
      })
      const data = await res.json().catch(() => ({} as { code?: string; error?: string }))
      if (!res.ok) {
        const code = typeof data.code === 'string' ? data.code : undefined
        const detail = typeof data.error === 'string' ? data.error.trim() : ''
        const resolvedCode =
          code || (detail.includes('timed') ? 'timed_offer_unavailable' : undefined)
        const resolvedKey = checkoutErrorI18nKey(resolvedCode, res.status)
        const hideDetail =
          resolvedKey === 'payment.errorKlarnaMinAmount' ||
          resolvedKey === 'payment.timedOfferNoLongerAvailable' ||
          resolvedKey === 'payment.errorOutOfStock' ||
          detail === 'Validation failed'
        setError({
          key: resolvedKey,
          params:
            resolvedKey === 'payment.couponMinOrder'
              ? { amount: money(typeof data.minOrderHuf === 'number' ? data.minOrderHuf : 0) }
              : undefined,
          detail: detail && !hideDetail ? detail : undefined,
        })
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
      setError({ key: 'payment.errorCreateSession' })
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
    money,
    cardTotalHuf,
    items,
    couponSelection,
    couponCodeInput,
    typedCoupon,
    pointsDiscountHuf,
    pointsUsedPreview,
    pointsPreview?.balance,
    usePoints,
    useGiftPoints,
    useActivityPoints,
    paymentMethod,
    klarnaEligible,
    locale,
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
                {money(promoSubtotalHuf)}
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
                {money(normalSubtotalHuf)}
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
                  <span className="tabular-nums">{money(promoSubtotalHuf)}</span>
                </div>
              )}
              {normalSubtotalHuf > 0 && (
                <div className="flex justify-between text-foreground">
                  <span>{t('payment.subtotalNormal')}</span>
                  <span className="tabular-nums">{money(normalSubtotalHuf)}</span>
                </div>
              )}
            </div>
          </div>

          {(luckySpinDiscount.discountHuf > 0 ||
            effectiveCouponDiscountHuf > 0 ||
            loyaltyDiscountHuf > 0 ||
            pointsDiscountHuf > 0 ||
            showFixedRemainderWarning) && (
            <div className="border-t border-[var(--border)] pt-3">
              <h3 className="font-heading font-semibold text-foreground mb-2">{t('payment.discountsSection')}</h3>
              <div className="space-y-1.5">
                {loyaltyDiscountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span>{t('payment.loyaltyDiscountLine', { percent: loyaltyPercent })}</span>
                    <span className="tabular-nums">−{money(loyaltyDiscountHuf)}</span>
                  </div>
                )}
                {luckySpinDiscount.discountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span>
                      {t('payment.luckySpinDiscountLine', {
                        percent: Math.round(luckySpinDiscountPercent * 100),
                      })}
                    </span>
                    <span className="tabular-nums">−{money(luckySpinDiscount.discountHuf)}</span>
                  </div>
                )}
                {percentCouponDiscountHuf > 0 && (
                  <div className="flex justify-between text-discount">
                    <span className="inline-flex items-center gap-1.5">
                      <span>
                        {typedCoupon?.discountType === 'fixed'
                          ? t('payment.couponDiscountFixed', {
                              amount: money(typedCoupon.discountValue),
                              code: typedCoupon.code,
                            })
                          : t('payment.couponDiscountWithCode', {
                              percent: Math.round(effectiveCouponPercent * 100),
                            })}
                        {couponSelection.capped
                          ? ` (${t('payment.couponCappedHint')})`
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
                    <span className="tabular-nums">−{money(percentCouponDiscountHuf)}</span>
                  </div>
                )}
                {(fixedCouponDiscountHuf > 0 || showFixedRemainderWarning) && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-discount">
                      <span>
                        {t('payment.couponDiscountFixed', {
                          amount: money(effectiveFixedHuf ?? 0),
                          code: typedCoupon?.code || couponSelection.gamificationCode || '',
                        })}
                      </span>
                      <span className="tabular-nums">−{money(fixedCouponDiscountHuf)}</span>
                    </div>
                    {showFixedRemainderWarning && (
                      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                        {t('payment.couponFixedRemainderWarning')}
                      </p>
                    )}
                  </div>
                )}
                {giftPointsUsedPreview > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>{t('payment.giftPointsDiscount')}</span>
                    <span className="tabular-nums">−{money(giftPointsUsedPreview)}</span>
                  </div>
                )}
                {activityPointsUsedPreview > 0 && (
                  <div className="flex justify-between text-accent">
                    <span>{t('payment.activityPointsDiscount')}</span>
                    <span className="tabular-nums">−{money(activityPointsUsedPreview)}</span>
                  </div>
                )}
                {pointsDiscountHuf > 0 && giftPointsUsedPreview === 0 && activityPointsUsedPreview === 0 && (
                  <div className="flex justify-between text-accent">
                    <span>{t('payment.pointsDiscount')}</span>
                    <span className="tabular-nums">−{money(pointsDiscountHuf)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
            {usePoints && (
              <div className="flex justify-between text-foreground">
                <span>{t('payment.invoiceMerchandise')}</span>
                <span className="tabular-nums">{money(invoiceMerchandiseHuf)}</span>
              </div>
            )}
            <div className="flex justify-between text-foreground">
              <span>{t('payment.shippingFee')}</span>
              <span className="tabular-nums">
                {shippingHuf === 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {t('payment.shippingFreeBadge')}
                  </span>
                ) : (
                  money(shippingHuf)
                )}
              </span>
            </div>
            {freeShippingRemainingHuf > 0 && (
              <p className="text-xs text-muted">
                {t('cart.freeShippingProgress', { amount: money(freeShippingRemainingHuf) })}
              </p>
            )}
            {freeShippingRemainingHuf === 0 && checkoutPreview.merchandiseTotalHuf > 0 && shippingHuf === 0 && (
              <p className="text-xs text-green-600 dark:text-green-400">{t('cart.freeShippingReached')}</p>
            )}
            {usePoints && (
              <p className="text-xs text-muted">
                {t('payment.invoiceRemainderHint', copy)}
              </p>
            )}
            <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2 mt-1">
              <span>{usePoints ? (t('payment.invoiceDue')) : t('payment.totalDue')}</span>
              <span className="tabular-nums">
                {money(usePoints ? invoiceTotalHuf : cardTotalHuf)}{' '}
                {locale === 'hu' && (
                  <span className="text-muted text-sm font-normal">(€{formatEur(totalEur)})</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {t('payment.customerDetailsTitle')}
        </h2>
        <p className="text-xs text-muted -mt-2">
          {userId
            ? t('payment.customerDetailsLoggedInHint')
            : t('payment.guestCheckoutNote')}
        </p>

        {!userId && (
          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium text-foreground mb-1">
              {t('payment.emailLabel')} <span className="text-muted">*</span>
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
              {t('payment.fullNameLabel')} <span className="text-muted">*</span>
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
              {t('payment.phoneLabel')} <span className="text-muted">*</span>
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
            {t('payment.shippingAddressTitle')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="checkout-shipping-postal" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.postalCodeLabel')} *
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
                {t('payment.cityLabel')} *
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
                {t('payment.streetLabel')} *
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
                {t('payment.houseNumberLabel')} *
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
                {t('payment.addressTypeLabel')}
              </label>
              <select
                id="checkout-address-type"
                value={addressType}
                onChange={(e) => setAddressType(e.target.value === 'business' ? 'business' : 'home')}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground"
              >
                <option value="home">{t('payment.addressTypeHome')}</option>
                <option value="business">{t('payment.addressTypeBusiness')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="checkout-delivery-notes" className="block text-sm font-medium text-foreground mb-1">
                {t('payment.deliveryNotesLabel')}{' '}
                <span className="text-muted font-normal">({t('common.optional')})</span>
              </label>
              <textarea
                id="checkout-delivery-notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder={
                  t('payment.deliveryNotesPlaceholder')
                }
                className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-background text-foreground resize-y min-h-[5rem]"
              />
              <p className="mt-1.5 text-xs text-muted">
                {t('payment.deliveryNotesHint')}
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
            {t('payment.billingSameAsShipping')}
          </span>
        </label>

        {!billingSameAsShipping && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('payment.billingAddressTitle')}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="checkout-billing-postal" className="block text-sm font-medium text-foreground mb-1">
                  {t('payment.postalCodeLabel')} *
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
                  {t('payment.cityLabel')} *
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
                  {t('payment.streetLabel')} *
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
                  {t('payment.houseNumberLabel')} *
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

      <GiftPointClaimForm
        className="mb-8"
        onSuccess={handleRedeemedCode}
      />

      {typedCoupon && (
        <div className="mb-4 -mt-4 space-y-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">
              {typedCoupon.discountType === 'fixed'
                ? t('giftClaim.couponSuccessFixed', {
                    amount: money(typedCoupon.discountValue),
                    code: typedCoupon.code,
                  })
                : t('giftClaim.couponSuccessPercent', {
                    percent: typedCoupon.discountValue,
                    code: typedCoupon.code,
                  })}
            </p>
            <button
              type="button"
              onClick={clearTypedCoupon}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t('payment.couponRemove')}
            </button>
          </div>
          {typedCoupon.discountType === 'fixed' && showFixedRemainderWarning && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {t('payment.couponFixedRemainderWarning')}{' '}
              {t('payment.couponFixedRemainderHint')}
            </p>
          )}
        </div>
      )}

      {loyaltyPercent > 0 && (
        <div className="mb-8 p-4 rounded-xl border border-accent/40 bg-accent/5">
          <p className="font-heading text-sm font-semibold text-foreground">
            {t('payment.loyaltyDiscountLine', { percent: loyaltyPercent })}
          </p>
          <p className="text-sm text-muted mt-1">{t('payment.loyaltyAutoAppliedHint')}</p>
        </div>
      )}

      <CouponSelector
        coupons={availableCoupons}
        selectedIds={selectedCouponIds}
        onChange={(next) => void handleCouponSelectionChange(next)}
        disabled={usePoints}
        exclusiveHint={t('payment.extraExclusiveHint')}
        title={t('payment.couponSelectorTitle')}
        hint={
          t('payment.couponSelectorHint')
        }
        emptyText={
          (wallet?.balance ?? 0) > 0 ||
          (pointsPreview?.giftBalance ?? 0) > 0 ||
          (pointsPreview?.activityBalance ?? 0) > 0
            ? t('payment.couponSelectorEmptyWithPoints')
            : t('payment.couponSelectorEmpty')
        }
        capReachedText={
          t('payment.couponCapReached')
        }
        selectedPercentDisplay={Math.round(couponSelection.finalPercent * 100)}
        capped={couponSelection.capped}
      />
      {showFixedRemainderWarning && !typedCoupon && (
        <p className="text-xs text-red-600 dark:text-red-400 -mt-4 mb-6" role="alert">
          {t('payment.couponFixedRemainderWarning')} {t('payment.couponFixedRemainderHint')}
        </p>
      )}
      {welcomeOfferBusy && (
        <p className="text-xs text-muted -mt-6 mb-6 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('payment.welcomeOfferSaving')}
        </p>
      )}
      {welcomeOfferError && (
        <p className="text-xs text-red-600 dark:text-red-400 -mt-4 mb-6" role="alert">
          {localeNoticeText(t, welcomeOfferError)}
        </p>
      )}
      {!userId && selectedCouponIds.includes('welcome') && !guestEmail.trim() && (
        <p className="text-xs text-muted -mt-4 mb-6">
          {t('payment.welcomeOfferEmailHint')}
        </p>
      )}

      {userId && pointsPreview && (pointsPreview.giftBalance > 0 || pointsPreview.maxActivityDiscountHuf > 0) && (
        <section className="mb-8 p-4 rounded-xl border border-accent/30 bg-accent/5 space-y-3">
          <p className="text-sm font-medium text-foreground">
            {t('payment.pointsWalletsTitle')}
          </p>
          <p className="text-xs text-muted">{t('payment.extraExclusiveHint')}</p>
          {pointsPreview.giftBalance > 0 && (
            <label className={`flex items-start gap-3 ${hasCouponExtra ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={useGiftPoints}
                disabled={hasCouponExtra}
                onChange={(e) => {
                  const on = e.target.checked
                  setUseGiftPoints(on)
                  if (on) {
                    setSelectedCouponIds([])
                    clearTypedCoupon()
                  }
                }}
                className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
              />
              <span className="text-sm text-foreground">
                {t('payment.useGiftPoints', {
                  points: String(pointsPreview.maxGiftDiscountHuf || pointsPreview.giftBalance),
                  amount: money(pointsPreview.maxGiftDiscountHuf || pointsPreview.giftBalance),
                })}
                {pointsPreview.giftExpiresAt && (
                  <span className="block text-xs text-muted mt-0.5">
                    {t('payment.giftPointsExpires', {
                      date: formatDisplayDate(pointsPreview.giftExpiresAt, locale),
                    })}
                  </span>
                )}
              </span>
            </label>
          )}
          {pointsPreview.maxActivityDiscountHuf > 0 && (
            <label className={`flex items-start gap-3 ${hasCouponExtra ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={useActivityPoints}
                disabled={hasCouponExtra}
                onChange={(e) => {
                  const on = e.target.checked
                  setUseActivityPoints(on)
                  if (on) {
                    setSelectedCouponIds([])
                    clearTypedCoupon()
                  }
                }}
                className="mt-1 w-4 h-4 rounded border-[var(--border)] text-accent focus:ring-accent"
              />
              <span className="text-sm text-foreground">
                {t('payment.useActivityPoints', {
                  points: String(pointsPreview.maxActivityDiscountHuf),
                  amount: money(pointsPreview.maxActivityDiscountHuf),
                })}
              </span>
            </label>
          )}
          <p className="text-xs text-muted ml-7">
            {t('payment.pointsRate', copy)}
          </p>
          {usePoints && (
            <p className="text-xs text-muted ml-7">
              {t('payment.pointsNoStackHint', copy)}
            </p>
          )}
        </section>
      )}

      <section className="mb-8 p-4 rounded-xl border-2 border-[var(--border)] bg-[var(--card-bg)]">
        <p className="text-sm text-muted mb-3">{t('payment.methodsIntro')}</p>
        <PaymentMethodPicker
          value={paymentMethod}
          onChange={setPaymentMethod}
          disabled={loading || !!checkoutResult}
          unavailableMethods={klarnaEligible ? [] : ['klarna']}
          title={t('payment.methodsTitle')}
          expressBadge={t('payment.expressCheckoutBadge')}
          methods={{
            card: {
              label: t('payment.methodCard'),
              hint: t('payment.methodCardHint'),
            },
            paypal: {
              label: t('payment.methodPaypal'),
              hint: t('payment.methodPaypalHint'),
            },
            apple_pay: {
              label: t('payment.methodApplePay'),
              hint: t('payment.methodApplePayHint'),
            },
            google_pay: {
              label: t('payment.methodGooglePay'),
              hint: t('payment.methodGooglePayHint'),
            },
            klarna: {
              label: t('payment.methodKlarna'),
              hint: klarnaEligible
                ? t('payment.methodKlarnaHint', { amount: money(payableHuf) })
                : t('payment.methodKlarnaMinHint', {
                    min: money(KLARNA_MIN_AMOUNT_HUF),
                    amount: money(payableHuf),
                  }),
            },
          }}
        />
        {paymentMethod === 'klarna' && klarnaEligible && (
          <p className="text-xs text-muted mb-3">
            {t('payment.methodKlarnaNote', { amount: money(payableHuf) })}
          </p>
        )}
        {userId && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
            {usePoints
              ? t('payment.cashEarnHintPointsUsed')
              : paymentMethod === 'klarna'
                ? t('payment.cashEarnHintInstallment')
                : t('payment.cashEarnHint', copy)}
          </p>
        )}
        <p className="text-xs text-muted mb-4">{t('payment.secureNote')}</p>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4" role="alert">
            {localeNoticeText(t, {
              ...error,
              params:
                error.key === 'payment.errorKlarnaMinAmount'
                  ? { min: money(KLARNA_MIN_AMOUNT_HUF) }
                  : error.params,
            })}
          </p>
        )}
        {checkoutResult && (
          <div className="mb-4 p-4 rounded-lg bg-[var(--border)]/50 space-y-2" role="status">
            {checkoutResult.payments.some((p) => p.orderType === 'in_stock') && (
              <p className="text-sm text-foreground">
                {t('checkout.statusStock')}
              </p>
            )}
            {checkoutResult.payments.some((p) => p.orderType === 'sourcing') && (
              <p className="text-sm text-foreground">
                {t('checkout.statusSourcing')}
              </p>
            )}
            <p className="text-xs text-muted mt-2">
              {t('checkout.redirectToSummary')}
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
                ? (t('checkout.redirecting'))
                : payButtonLabel}
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
