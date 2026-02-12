'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { useEuroRate } from '@/context/EuroRateContext'

export default function PaymentPage() {
  const router = useRouter()
  const { t } = useLocale()
  const { userId } = useAuth()
  const { items, subtotalHuf, discountHuf, totalHuf, isDiscountActive } = useCart()
  const { isDiscountActive: couponActive, discountPercent } = useCatCoupon()
  const { hufToEur, formatEur } = useEuroRate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loyaltyPercent, setLoyaltyPercent] = useState(0)

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
      router.replace('/kosar')
    }
  }, [items.length, router])

  const handlePayByCard = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ productId, qty }) => ({ productId, qty })),
          isDiscountActive: couponActive,
          discountPercent: couponActive ? discountPercent : undefined,
          customer_email: userId ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t('payment.errorCreateSession'))
        setLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
        return
      }
      setError(t('payment.errorCreateSession'))
    } catch {
      setError(t('payment.errorCreateSession'))
    }
    setLoading(false)
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

      <section className="mb-8 p-4 rounded-xl border-2 border-[var(--border)] bg-[var(--card-bg)]">
        <p className="text-sm text-muted mb-3">{t('payment.cardOnly')}</p>
        <p className="text-xs text-muted mb-4">{t('payment.secureNote')}</p>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handlePayByCard}
          disabled={loading}
          className="w-full py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('payment.redirecting') : t('payment.payWithCard')}
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
