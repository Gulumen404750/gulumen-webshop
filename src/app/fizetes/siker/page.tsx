'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale } from '@/context/LocaleContext'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import type { Order } from '@/lib/orders'
import { trackPurchase } from '@/lib/analytics'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 8
const GIVE_UP_MS = 10 * 1000

function fetchOrderBySession(sessionId: string): Promise<Order> {
  return fetch(
    `/api/orders/by-session?session_id=${encodeURIComponent(sessionId)}`
  ).then((res) => {
    if (!res.ok) throw new Error('Order not found')
    return res.json()
  })
}

function fetchOrdersByGroup(orderGroupId: string): Promise<Order[]> {
  return fetch(
    `/api/orders/by-group?order_group_id=${encodeURIComponent(orderGroupId)}`
  ).then((res) => {
    if (!res.ok) throw new Error('Orders not found')
    return res.json()
  })
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const orderGroupId = searchParams.get('order_group_id')
  const { t } = useLocale()
  const { clearCart } = useCart()
  const { markUsed } = useCatCoupon()
  const [order, setOrder] = useState<Order | null>(null)
  const [ordersByGroup, setOrdersByGroup] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const pollCountRef = useRef(0)
  const didMarkUsedRef = useRef(false)

  useEffect(() => {
    if (!sessionId && !orderGroupId) {
      setError(t('payment.successMissingSession'))
      setLoading(false)
    }
  }, [sessionId, orderGroupId, t])

  useEffect(() => {
    if (orderGroupId) {
      let cancelled = false
      const poll = () => {
        if (cancelled) return
        fetchOrdersByGroup(orderGroupId)
          .then((data: Order[]) => {
            if (cancelled) return
            setOrdersByGroup(data)
            setLoading(false)
            const anyPaidOrFulfilled = data.some((o) => o.status === 'paid' || o.status === 'fulfilled')
            if (anyPaidOrFulfilled && !didMarkUsedRef.current) {
              didMarkUsedRef.current = true
              clearCart()
              data.filter((o) => o.status === 'paid' || o.status === 'fulfilled').forEach((o) => trackPurchase(o.id, o.totalHuf))
              markUsed()
            }
            const allTerminal = data.every((o) =>
              ['paid', 'fulfilled', 'cancelled', 'sourcing_failed'].includes(o.status)
            )
            if (!allTerminal && pollCountRef.current < POLL_MAX_ATTEMPTS) {
              pollCountRef.current += 1
              setTimeout(poll, POLL_INTERVAL_MS)
            }
          })
          .catch(() => {
            if (cancelled) return
            setError(t('payment.successLoadError'))
            setLoading(false)
          })
      }
      poll()
      return () => {
        cancelled = true
      }
    }
    return () => {}
  }, [orderGroupId, t, clearCart, markUsed])

  useEffect(() => {
    if (!sessionId || orderGroupId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = () => {
      if (cancelled) return
      fetchOrderBySession(sessionId)
        .then((data: Order) => {
          if (cancelled) return
          setOrder(data)
          setLoading(false)
          if (data.status === 'paid') {
            if (!didMarkUsedRef.current) {
              didMarkUsedRef.current = true
              trackPurchase(data.id, data.totalHuf)
              clearCart()
              markUsed()
            }
            return
          }
          pollCountRef.current += 1
          if (pollCountRef.current < POLL_MAX_ATTEMPTS) {
            timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
          }
        })
        .catch(() => {
          if (cancelled) return
          setError(t('payment.successLoadError'))
          setLoading(false)
        })
    }

    fetchOrderBySession(sessionId)
      .then((data: Order) => {
        if (cancelled) return
        setOrder(data)
        setLoading(false)
        if (data.status === 'paid') {
          if (!didMarkUsedRef.current) {
            didMarkUsedRef.current = true
            trackPurchase(data.id, data.totalHuf)
            clearCart()
            markUsed()
          }
          return
        }
        pollCountRef.current = 1
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('payment.successLoadError'))
        setLoading(false)
      })

    const giveUpId = setTimeout(() => {
      if (cancelled) return
      setGaveUp(true)
    }, GIVE_UP_MS)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      clearTimeout(giveUpId)
    }
  }, [sessionId, orderGroupId, t, clearCart, markUsed])

  if (orderGroupId && ordersByGroup && ordersByGroup.length > 0) {
    const allTerminal = ordersByGroup.every((o) =>
      ['paid', 'fulfilled', 'cancelled', 'sourcing_failed'].includes(o.status)
    )
    const stockOrder = ordersByGroup.find((o) => o.orderType === 'in_stock')
    const sourcingOrder = ordersByGroup.find((o) => o.orderType === 'sourcing')
    const renderOrderStatus = (o: Order) =>
      o.status === 'paid' || o.status === 'fulfilled' ? (
        <span className="text-green-600 dark:text-green-400">{t('payment.statusPaid')}</span>
      ) : o.status === 'payment_pending' || o.status === 'sourcing_pending' ? (
        <span className="text-amber-600 dark:text-amber-400">{allTerminal ? t('payment.statusPaid') : (t('payment.statusProcessing') || 'Feldolgozás…')}</span>
      ) : (
        <span className="text-muted">{o.status}</span>
      )
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          {t('payment.successTitle')}
        </h1>
        <p className="text-muted mb-6">{t('payment.successMessage')}</p>
        <section className="mb-8 space-y-6">
          {stockOrder && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                {t('checkout.orderTypeStock') || 'Raktári rendelés'}
              </h2>
              <p className="font-mono text-sm text-foreground font-medium">{stockOrder.id}</p>
              <p className="text-sm text-muted mt-1">
                {stockOrder.totalHuf.toLocaleString('hu-HU')} Ft – {renderOrderStatus(stockOrder)}
              </p>
            </div>
          )}
          {sourcingOrder && (
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
                {t('checkout.orderTypeSourcing') || 'Beszerzéses rendelés'}
              </h2>
              <p className="font-mono text-sm text-foreground font-medium">{sourcingOrder.id}</p>
              <p className="text-sm text-muted mt-1">
                {sourcingOrder.totalHuf.toLocaleString('hu-HU')} Ft – {renderOrderStatus(sourcingOrder)}
              </p>
            </div>
          )}
        </section>
        <Link
          href="/termekek"
          className="inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {t('buttons.continueShopping')}
        </Link>
      </div>
    )
  }

  if (orderGroupId && loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-muted">{t('payment.successLoading')}</p>
      </div>
    )
  }

  if (orderGroupId && (error || !ordersByGroup?.length)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-4">{t('payment.title')}</h1>
        <p className="text-muted mb-4">{error ?? t('payment.successLoadError')}</p>
        <Link href="/kosar" className="inline-block text-accent font-medium hover:underline">
          ← {t('payment.backToCart')}
        </Link>
      </div>
    )
  }

  if (loading && !order && !orderGroupId) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <p className="text-muted">{t('payment.successLoading')}</p>
      </div>
    )
  }

  if (error || (!order && !gaveUp)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-4">
          {t('payment.title')}
        </h1>
        <p className="text-muted mb-4">{error ?? t('payment.successLoadError')}</p>
        <Link
          href="/kosar"
          className="inline-block text-accent font-medium hover:underline"
        >
          ← {t('payment.backToCart')}
        </Link>
      </div>
    )
  }

  if (gaveUp && order?.status !== 'paid') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
          {t('payment.title')}
        </h1>
        <p className="text-muted mb-4">{t('payment.successPendingTimeout')}</p>
        <p className="text-sm text-muted mb-4">{t('payment.orderId')}: {order?.id ?? '–'}</p>
        <Link
          href="/kapcsolat"
          className="inline-block text-accent font-medium hover:underline"
        >
          {t('nav.contact')}
        </Link>
      </div>
    )
  }

  if (!order) return null

  const hasStock = order.items.some((i) => i.fulfillmentType === 'stock')
  const hasProcurement = order.items.some((i) => i.fulfillmentType === 'procurement')
  const isPending = order.status === 'pending'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {isPending ? (
        <>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t('payment.successProcessingTitle')}
          </h1>
          <p className="text-muted mb-6">{t('payment.successProcessingMessage')}</p>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            {t('payment.successTitle')}
          </h1>
          <p className="text-muted mb-6">{t('payment.successMessage')}</p>
        </>
      )}

      <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
        <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
          {t('payment.orderId')}
        </h2>
        <p className="font-mono text-foreground font-medium">{order.id}</p>
        <p className="text-sm text-muted mt-2">
          {t('payment.totalPaid')}: {order.totalHuf.toLocaleString('hu-HU')} Ft
          {order.status === 'paid' && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              ({t('payment.statusPaid')})
            </span>
          )}
          {order.status === 'pending' && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              ({t('payment.statusProcessing')})
            </span>
          )}
        </p>
      </section>

      {order.status === 'paid' && (
        <section className="mb-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
          <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
            {t('payment.nextSteps')}
          </h2>
          <ul className="list-disc list-inside text-foreground space-y-1 text-sm">
            <li>{t('payment.nextStepsEmail')}</li>
            {hasStock && <li>{t('payment.nextStepsShippingStock')}</li>}
            {hasProcurement && <li>{t('payment.nextStepsShippingProcurement')}</li>}
          </ul>
        </section>
      )}

      <Link
        href="/termekek"
        className="inline-block py-3 px-6 bg-accent text-white font-heading font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {t('buttons.continueShopping')}
      </Link>
    </div>
  )
}
