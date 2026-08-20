'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { writeTypedCoupon } from '@/lib/typed-coupon-storage'
import { useLocale } from '@/context/LocaleContext'
import type { CartItem } from '@/lib/cart-storage'

function RestoreCartInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { replaceItems } = useCart()
  const { t } = useLocale()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? ''
    if (!token) {
      setStatus('error')
      return
    }

    let cancelled = false
    fetch(`/api/cart/restore?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          items?: CartItem[]
          coupon?: {
            code: string
            discountType: 'percent' | 'fixed'
            discountValue: number
            minOrderHuf: number | null
            source?: string
            eligibleItems?: { productId: string; qty: number; options?: CartItem['options'] }[]
          } | null
        } | null
        if (cancelled) return
        if (!res.ok || !data?.ok || !Array.isArray(data.items) || data.items.length === 0) {
          setStatus('error')
          return
        }
        replaceItems(data.items)
        if (data.coupon?.code) {
          writeTypedCoupon({
            code: data.coupon.code,
            discountType: data.coupon.discountType,
            discountValue: data.coupon.discountValue,
            minOrderHuf: data.coupon.minOrderHuf,
            source: data.coupon.source ?? 'abandoned_cart',
            eligibleItems: Array.isArray(data.coupon.eligibleItems)
              ? data.coupon.eligibleItems.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  options: item.options,
                }))
              : [],
          })
        }
        router.replace('/kosar')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [searchParams, replaceItems, router])

  if (status === 'error') {
    return (
      <main className="min-h-[50vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-xl font-heading font-semibold text-white mb-2">{t('cart.restoreFailedTitle')}</h1>
        <p className="text-muted max-w-md">{t('cart.restoreFailedBody')}</p>
        <a href="/kosar" className="mt-6 inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90">
          {t('buttons.openCart')}
        </a>
      </main>
    )
  }

  return (
    <main className="min-h-[50vh] flex items-center justify-center px-4">
      <p className="text-muted">{t('cart.restoreLoading')}</p>
    </main>
  )
}

export default function RestoreCartPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[50vh] flex items-center justify-center px-4">
          <p className="text-muted">…</p>
        </main>
      }
    >
      <RestoreCartInner />
    </Suspense>
  )
}
