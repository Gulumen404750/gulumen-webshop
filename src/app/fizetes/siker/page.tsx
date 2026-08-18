'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLocale } from '@/context/LocaleContext'
import { useCart } from '@/context/CartContext'
import { useCatCoupon } from '@/context/CatCouponContext'
import { useAuth } from '@/context/AuthContext'
import { usePointWallet } from '@/hooks/usePointWallet'
import type { Order } from '@/lib/orders'
import { trackPurchase } from '@/lib/analytics'
import {
  applyStashedPointsRedeemOnce,
  stashPendingPointsRedeem,
  syncPointWalletAfterPayment,
} from '@/lib/point-wallet-client'

const POLL_INTERVAL_MS = 1500
const POLL_MAX_ATTEMPTS = 8
const GIVE_UP_MS = 10 * 1000

/** Sikeres checkout után a kosár ürítendő – sourcing authorize = sourcing_pending. */
const CART_CLEAR_STATUSES = new Set([
  'paid',
  'fulfilled',
  'sourcing_pending',
  'payment_pending', // Dummy / webhook késés: a siker oldalon már létrejött a rendelés
])

function shouldClearCartForOrders(orders: Order[]): boolean {
  if (!orders.length) return false
  // Ha minden rendelés cancelled/failed, ne ürítsünk (hibaág)
  const allFailed = orders.every((o) => o.status === 'cancelled' || o.status === 'sourcing_failed')
  if (allFailed) return false
  return orders.some((o) => CART_CLEAR_STATUSES.has(o.status))
}

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
  const { userId } = useAuth()
  const { refresh: refreshWallet } = usePointWallet(!!userId)
  const [order, setOrder] = useState<Order | null>(null)
  const [ordersByGroup, setOrdersByGroup] = useState<Order[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const pollCountRef = useRef(0)
  const didClearCartRef = useRef(false)
  const didFinalizeRewardsRef = useRef(false)
  const didTrackPurchaseRef = useRef(false)
  const didOptimisticPointsRef = useRef(false)

  // Stripe-ról visszatérve azonnal mutassuk a levont pontokat a fejlécben is
  useEffect(() => {
    void applyStashedPointsRedeemOnce()
  }, [])

  const applyOptimisticPointsFromOrders = (orders: Order[]) => {
    if (didOptimisticPointsRef.current) return
    const pointsUsed = orders.reduce((sum, o) => sum + (o.pointsUsed ?? 0), 0)
    if (pointsUsed <= 0) return
    didOptimisticPointsRef.current = true
    // Ha a checkout már stash-elt (balanceBefore-ral), ne írjuk felül
    stashPendingPointsRedeem(pointsUsed, undefined, { replace: false })
    void applyStashedPointsRedeemOnce()
  }

  const finalizeRewardsOnce = (orders: Order[]) => {
    applyOptimisticPointsFromOrders(orders)
    if (didFinalizeRewardsRef.current) return
    // payment_pending is is számít: Dummy / pending checkout a siker oldalon zárul le
    const actionable = orders.filter((o) =>
      ['paid', 'fulfilled', 'sourcing_pending', 'payment_pending'].includes(o.status)
    )
    if (!actionable.length) return
    didFinalizeRewardsRef.current = true
    // Státuszemeléshez Stripe session kell; orderGroupId/orderId önmagában csak reward finalize.
    const body: Record<string, string> = {}
    if (sessionId) body.sessionId = sessionId
    else {
      const groupId = actionable[0]?.orderGroupId ?? orderGroupId
      if (groupId) body.orderGroupId = groupId
      else if (actionable[0]?.id) body.orderId = actionable[0].id
    }
    if (!Object.keys(body).length) {
      didFinalizeRewardsRef.current = false
      return
    }
    void fetch('/api/checkout/finalize-rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          didFinalizeRewardsRef.current = false
          return
        }
        const data = (await res.json().catch(() => ({}))) as {
          balance?: number
          pointsUsed?: number
          pointsEarned?: number
        }
        markUsed()
        if (typeof data.pointsEarned === 'number' && data.pointsEarned > 0) {
          setPointsEarned(data.pointsEarned)
        }
        if (typeof data.balance === 'number') {
          void syncPointWalletAfterPayment(data.balance)
        } else {
          void syncPointWalletAfterPayment()
        }
        void refreshWallet()
        // Friss státusz a lezárás után
        if (orderGroupId) {
          try {
            const fresh = await fetchOrdersByGroup(orderGroupId)
            setOrdersByGroup(fresh)
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        didFinalizeRewardsRef.current = false
      })
  }

  const clearCartOnce = (orders: Order[]) => {
    finalizeRewardsOnce(orders)
    if (!didTrackPurchaseRef.current) {
      const paid = orders.filter((o) =>
        ['paid', 'fulfilled', 'sourcing_pending', 'payment_pending'].includes(o.status)
      )
      if (paid.length) {
        didTrackPurchaseRef.current = true
        paid.forEach((o) => trackPurchase(o.id, o.totalHuf))
      }
    }
    if (didClearCartRef.current) return
    if (!shouldClearCartForOrders(orders)) return
    didClearCartRef.current = true
    clearCart()
  }

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
            clearCartOnce(data)
            const allTerminal = data.every((o) =>
              ['paid', 'fulfilled', 'cancelled', 'sourcing_failed', 'sourcing_pending'].includes(o.status)
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
    // clearCartOnce depends on clearCart/markUsed/refreshWallet; intentionally inline via refs+stable deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderGroupId, t, clearCart, markUsed, refreshWallet])

  useEffect(() => {
    if (!sessionId || orderGroupId) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const handleOrder = (data: Order) => {
      if (cancelled) return
      setOrder(data)
      setLoading(false)
      clearCartOnce([data])
      const terminal = ['paid', 'fulfilled', 'cancelled', 'sourcing_failed', 'sourcing_pending'].includes(
        data.status
      )
      return terminal
    }

    const poll = () => {
      if (cancelled) return
      fetchOrderBySession(sessionId)
        .then((data: Order) => {
          const terminal = handleOrder(data)
          if (terminal) return
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
        const terminal = handleOrder(data)
        if (terminal) return
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
  }, [sessionId, orderGroupId, t, clearCart, markUsed, refreshWallet])

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
        {pointsEarned > 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 -mt-4 mb-6">
            {t('payment.pointsEarnedSuccess', { points: String(pointsEarned) }) ||
              `+${pointsEarned} pont jóváírva a kártyás fizetés után.`}
          </p>
        )}
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
          {pointsEarned > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 -mt-4 mb-6">
              {t('payment.pointsEarnedSuccess', { points: String(pointsEarned) }) ||
                `+${pointsEarned} pont jóváírva a kártyás fizetés után.`}
            </p>
          )}
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
