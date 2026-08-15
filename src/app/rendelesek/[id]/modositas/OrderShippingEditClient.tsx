'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Flame, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLocale } from '@/context/LocaleContext'
import { CustomerOrderShippingEdit } from '@/components/CustomerOrderShippingEdit'

type OrderDetail = {
  id: string
  status: string
  totalHuf: number
  customerName: string | null
  customerPhone: string | null
  shipping: {
    postalCode: string
    city: string
    street: string
    houseNumber: string
  }
  deliveryNotes: string | null
  canEditShipping: boolean
  canEditReason: string | null
  addressChanged: boolean
}

export default function OrderShippingEditClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = typeof params.id === 'string' ? params.id : ''
  const token = useMemo(() => searchParams.get('t')?.trim() || '', [searchParams])
  const { t } = useLocale()
  const { isLoggedIn, authChecked } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!orderId) {
      setError(t('orders.editPageNotFound'))
      setLoading(false)
      return
    }

    if (token) {
      let cancelled = false
      setLoading(true)
      setError(null)
      fetch(
        `/api/orders/${encodeURIComponent(orderId)}/shipping-edit?t=${encodeURIComponent(token)}`,
        { credentials: 'omit' }
      )
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(
              typeof data.error === 'string' ? data.error : t('orders.editPageLoadError')
            )
          }
          if (!cancelled) setOrder(data.order as OrderDetail)
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : t('orders.editPageLoadError'))
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    if (!authChecked) return
    if (!isLoggedIn) {
      const next = `/rendelesek/${encodeURIComponent(orderId)}/modositas`
      router.replace(`/profil?next=${encodeURIComponent(next)}`)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/me/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            typeof data.error === 'string' ? data.error : t('orders.editPageLoadError')
          )
        }
        if (!cancelled) setOrder(data.order as OrderDetail)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('orders.editPageLoadError'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authChecked, isLoggedIn, orderId, router, t, token])

  if (!token && (!authChecked || (!isLoggedIn && !error))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {t('orders.editPageTitle')}
        </h1>
        <Link href="/profil/rendelesek" className="text-sm text-muted hover:text-foreground">
          ← {t('orders.title')}
        </Link>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('orders.loading')}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {!loading && order && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 sm:p-6">
          <div>
            <p className="font-mono text-sm text-foreground">{order.id}</p>
            <p className="mt-1 text-sm text-muted">
              {order.totalHuf.toLocaleString('hu-HU')} Ft · {order.status}
            </p>
            {order.addressChanged && (
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
                <Flame className="h-4 w-4" aria-hidden />
                {t('orders.addressChangedBadge')}
              </p>
            )}
          </div>

          {!order.canEditShipping ? (
            <div className="rounded-lg border border-[var(--border)] bg-background px-3 py-3 text-sm text-muted">
              {order.canEditReason || t('orders.editPageLocked')}
            </div>
          ) : (
            <CustomerOrderShippingEdit
              mode="page"
              orderId={order.id}
              editToken={token || null}
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
                setSaved(true)
                setOrder((prev) =>
                  prev
                    ? {
                        ...prev,
                        customerName: next.customerName,
                        customerPhone: next.customerPhone,
                        shipping: next.shipping,
                        deliveryNotes: next.deliveryNotes,
                        addressChanged: true,
                        canEditShipping: next.canEditShipping,
                      }
                    : prev
                )
              }}
            />
          )}

          {saved && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {t('orders.editSuccess')} {t('orders.editPageAdminNotified')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
