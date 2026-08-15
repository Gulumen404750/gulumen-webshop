'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { CustomerOrderShippingEdit } from '@/components/CustomerOrderShippingEdit'

type OrderRow = {
  id: string
  status: string
  orderType: string | null
  orderGroupId: string | null
  createdAt: string
  totalHuf: number
  customerName: string | null
  customerPhone: string | null
  shipping: {
    postalCode: string
    city: string
    street: string
    houseNumber: string
  } | null
  deliveryNotes: string | null
  items: Array<{
    productId: string
    name: string | null
    qty: number
    priceHuf: number
    fulfillmentType: string
  }>
  paidAt: string | null
  printedAt: string | null
  shippingAddressChangedAt: string | null
  addressChanged: boolean
  canEditShipping: boolean
}

function statusLabel(status: string, t: (key: string) => string): string {
  const key = `orders.status.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}

export default function MyOrdersPage() {
  const { t, locale } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authChecked) return
    if (!isLoggedIn) {
      router.replace('/profil')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/me/orders', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || t('orders.loadError'))
        if (!cancelled) setOrders(Array.isArray(data.orders) ? data.orders : [])
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('orders.loadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authChecked, isLoggedIn, router, t])

  if (!authChecked || !isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted" aria-hidden />
      </div>
    )
  }

  const dateLocale =
    locale === 'hu' ? 'hu-HU' : locale === 'de' ? 'de-DE' : locale === 'ro' ? 'ro-RO' : 'en-GB'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t('orders.title')}</h1>
        <Link href="/profil" className="text-sm text-muted hover:text-foreground">
          ← {t('orders.backToProfile')}
        </Link>
      </div>

      {loading && (
        <p className="text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          {t('orders.loading')}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
          <p className="text-foreground mb-2">{t('orders.empty')}</p>
          <Link href="/termekek" className="text-accent font-medium hover:underline">
            {t('orders.browseProducts')}
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {orders.map((order) => (
          <li
            key={order.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-heading font-semibold text-foreground">{order.id}</p>
                <p className="text-xs text-muted mt-0.5">
                  {new Date(order.createdAt).toLocaleString(dateLocale)}
                  {order.orderType ? ` · ${t(`orders.type.${order.orderType}`) || order.orderType}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {statusLabel(order.status, t)}
                </p>
                <p className="text-sm tabular-nums text-foreground mt-0.5">
                  {order.totalHuf.toLocaleString('hu-HU')} Ft
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 text-sm border-t border-[var(--border)] pt-3 mb-3">
              {order.items.map((item) => (
                <li key={`${order.id}-${item.productId}-${item.name}`} className="flex justify-between gap-3">
                  <span className="text-foreground min-w-0">
                    {item.name || item.productId} × {item.qty}
                  </span>
                  <span className="tabular-nums text-muted shrink-0">
                    {(item.priceHuf * item.qty).toLocaleString('hu-HU')} Ft
                  </span>
                </li>
              ))}
            </ul>

            {(order.customerName || order.shipping) && (
              <div className="text-xs text-muted space-y-1 border-t border-[var(--border)] pt-3">
                {order.customerName && (
                  <p>
                    {t('orders.customer')}: {order.customerName}
                    {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                  </p>
                )}
                {order.shipping && (
                  <p>
                    {t('orders.shippingAddress')}: {order.shipping.postalCode} {order.shipping.city},{' '}
                    {order.shipping.street} {order.shipping.houseNumber}
                  </p>
                )}
                {order.addressChanged && (
                  <p className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <Flame className="h-3.5 w-3.5" aria-hidden />
                    {t('orders.addressChangedBadge')}
                  </p>
                )}
              </div>
            )}

            {order.canEditShipping && (
              <CustomerOrderShippingEdit
                orderId={order.id}
                initial={{
                  customerName: order.customerName ?? '',
                  customerPhone: order.customerPhone ?? '',
                  shippingPostalCode: order.shipping?.postalCode ?? '',
                  shippingCity: order.shipping?.city ?? '',
                  shippingStreet: order.shipping?.street ?? '',
                  shippingHouseNumber: order.shipping?.houseNumber ?? '',
                  deliveryNotes: order.deliveryNotes ?? '',
                }}
                labels={{
                  title: t('orders.editShippingTitle'),
                  hint: t('orders.editShippingHint'),
                  name: t('orders.editName'),
                  phone: t('orders.editPhone'),
                  postalCode: t('orders.editPostalCode'),
                  city: t('orders.editCity'),
                  street: t('orders.editStreet'),
                  houseNumber: t('orders.editHouseNumber'),
                  notes: t('orders.editNotes'),
                  save: t('orders.editSave'),
                  saving: t('orders.editSaving'),
                  cancel: t('orders.editCancel'),
                  success: t('orders.editSuccess'),
                  open: t('orders.editShippingOpen'),
                }}
                onSaved={(next) => {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === order.id
                        ? {
                            ...o,
                            customerName: next.customerName,
                            customerPhone: next.customerPhone,
                            shipping: next.shipping,
                            deliveryNotes: next.deliveryNotes,
                            shippingAddressChangedAt: next.shippingAddressChangedAt,
                            addressChanged: true,
                            canEditShipping: next.canEditShipping,
                          }
                        : o
                    )
                  )
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
