'use client'

import { useEffect, useState } from 'react'
import { LocaleLink as Link } from '@/components/LocaleLink'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { localizePath } from '@/i18n/routing'
import { useEuroRate } from '@/context/EuroRateContext'
import { trackBeginCheckout } from '@/lib/analytics'
import { getProductById as getProductByIdFromData, getProductName } from '@/lib/data'
import { useProducts } from '@/context/ProductsContext'

export default function PaymentPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { userId } = useAuth()
  const { items, subtotalHuf, discountHuf, totalHuf, isDiscountActive } = useCart()
  const { getProductById: getProductByIdFromContext } = useProducts()
  const getProductById = (id: string) => getProductByIdFromContext(id) ?? getProductByIdFromData(id)
  const { isDiscountActive: couponActive, discountPercent } = useCatCoupon()
  const { hufToEur, formatEur } = useEuroRate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loyaltyPercent, setLoyaltyPercent] = useState(0)
  const [guestEmail, setGuestEmail] = useState('')

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

  const loyaltyDiscountHuf = !couponActive && loyaltyPercent > 0 ? Math.round(subtotalHuf * (loyaltyPercent / 100)) : 0
  const displayTotalHuf = couponActive ? totalHuf : subtotalHuf - loyaltyDiscountHuf
  const subtotalEur = hufToEur(subtotalHuf)
  const discountEur = hufToEur(couponActive ? discountHuf : loyaltyDiscountHuf)
  const totalEur = hufToEur(displayTotalHuf)

  useEffect(() => {
    if (items.length === 0) {
      router.replace(localizePath('/kosar', locale))
    }
  }, [items.length, router])

  const [checkoutResult, setCheckoutResult] = useState<{
    orderGroupId: string
    payments: Array<{ orderType: 'in_stock' | 'sourcing'; type: string; url?: string; clientSecret?: string; message?: string }>
  } | null>(null)

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
    trackBeginCheckout(displayTotalHuf)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ productId, qty, options }) => ({
            productId,
            qty,
            ...(options && (options.colorName != null || options.colorHex != null || options.materialName != null) ? { options } : {}),
          })),
          customer: { email },
          isDiscountActive: couponActive,
          discountPercent: couponActive ? discountPercent : undefined,
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
          router.push(localizePath('/fizetes/siker', locale, `?order_group_id=${encodeURIComponent(data.orderGroupId)}`))
        }, 2000)
        return
      }
      setCheckoutResult({ orderGroupId: data.orderGroupId, payments: data.payments || [] })
      setLoading(false)
      setTimeout(() => {
        router.push(localizePath('/fizetes/siker', locale, `?order_group_id=${encodeURIComponent(data.orderGroupId)}`))
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
        {items.length > 0 && (
          <ul className="mb-4 space-y-1 text-sm text-muted border-b border-[var(--border)] pb-3">
            {items.map((item) => {
              const product = getProductById(item.productId)
              const name = product ? getProductName(product, locale) : item.productId
              return (
                <li key={item.productId} className="flex justify-between gap-2">
                  <span className="truncate">{name} × {item.qty}</span>
                  {(item.options?.colorName || item.options?.materialName) && (
                    <span className="shrink-0">
                      {item.options?.materialName && <span>{t('product.material') || 'Anyag'}: {item.options.materialName}</span>}
                      {item.options?.materialName && item.options?.colorName && ' · '}
                      {item.options?.colorName && <span>{t('product.color') || 'Szín'}: {item.options.colorName}</span>}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <div className="space-y-2">
          <div className="flex justify-between text-foreground">
            <span>{t('cart.subtotal')}</span>
            <span>{subtotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(subtotalEur)})</span></span>
          </div>
          {couponActive && discountHuf > 0 && (
            <div className="flex justify-between text-discount">
              <span>{t('cart.discountLabel', { percent: Math.round(discountPercent * 100) })}</span>
              <span>−{discountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(discountEur)})</span></span>
            </div>
          )}
          {!couponActive && loyaltyDiscountHuf > 0 && (
            <div className="flex justify-between text-discount">
              <span>{t('cart.loyaltyDiscountLabel', { percent: loyaltyPercent })}</span>
              <span>−{loyaltyDiscountHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(discountEur)})</span></span>
            </div>
          )}
          <div className="flex justify-between font-heading font-bold text-lg text-foreground pt-2 border-t border-[var(--border)]">
            <span>{t('cart.total')}</span>
            <span>{displayTotalHuf.toLocaleString('hu-HU')} Ft <span className="text-muted">(€{formatEur(totalEur)})</span></span>
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
