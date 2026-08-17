import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Flame } from 'lucide-react'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { AdminOrderDetailActions } from './AdminOrderDetailActions'
import { AdminOrderLabelPrint } from './AdminOrderLabelPrint'
import { AdminOrderCustomerEditForm } from './AdminOrderCustomerEditForm'
import { AdminOrderProductionJson } from './AdminOrderProductionJson'
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge'
import {
  adminOrderKindClasses,
  getAdminOrderVisualKind,
  hasShippingAddressChanged,
} from '@/lib/admin-order-badges'
import { formatAddressTypeLabel } from '@/lib/checkout-customer'
import { buildProductionJobPayload, orderItemSpecForAdmin } from '@/lib/production-payload'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

function formatHuAddress(parts: {
  postalCode: string | null
  city: string | null
  street: string | null
  houseNumber: string | null
}): string {
  const street = [parts.street, parts.houseNumber].filter(Boolean).join(' ')
  const cityLine = [parts.postalCode, parts.city].filter(Boolean).join(' ')
  return [street, cityLine].filter(Boolean).join(', ') || '—'
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params
  if (!isDbConfigured()) {
    return <p className="text-muted">Adatbázis nincs konfigurálva.</p>
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) notFound()

  const production = buildProductionJobPayload({
    orderId: order.id,
    orderGroupId: order.orderGroupId,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
    items: order.items,
  })

  const kind = getAdminOrderVisualKind(order.status, order.printedAt)
  const kindClasses = adminOrderKindClasses(kind)
  const billingSame = order.billingSameAsShipping !== false
  const addressChanged = hasShippingAddressChanged(order.shippingAddressChangedAt)
  const shippingAddress = formatHuAddress({
    postalCode: order.shippingPostalCode,
    city: order.shippingCity,
    street: order.shippingStreet,
    houseNumber: order.shippingHouseNumber,
  })
  const originalShippingAddress = formatHuAddress({
    postalCode: order.originalShippingPostalCode,
    city: order.originalShippingCity,
    street: order.originalShippingStreet,
    houseNumber: order.originalShippingHouseNumber,
  })
  const billingAddress = formatHuAddress({
    postalCode: order.billingPostalCode,
    city: order.billingCity,
    street: order.billingStreet,
    houseNumber: order.billingHouseNumber,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/dashboard/orders" className="text-muted hover:text-foreground print:hidden">
          ← Rendelések
        </Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">Rendelés: {order.id}</h1>
        <AdminOrderStatusBadge
          status={order.status}
          printedAt={order.printedAt}
          shippingAddressChangedAt={order.shippingAddressChangedAt}
        />
      </div>

      <div className={`rounded-xl border border-[var(--border)] p-4 space-y-2 ${kindClasses.row}`}>
        <p><span className="font-medium">Státusz:</span> {order.status}</p>
        <p><span className="font-medium">Típus:</span> {order.orderType ?? '–'}</p>
        <p><span className="font-medium">Csoport ID:</span> {order.orderGroupId ?? '–'}</p>
        <p><span className="font-medium">Összeg:</span> {order.totalHuf.toLocaleString('hu-HU')} Ft (kedvezmény: {order.discountHuf} Ft)</p>
        <p><span className="font-medium">Fizetve:</span> {order.paidAt ? new Date(order.paidAt).toLocaleString('hu-HU') : '–'} {order.amountPaid != null && `(${order.amountPaid} ${order.currencyPaid ?? 'HUF'})`}</p>
        <p><span className="font-medium">Email:</span> {order.customerEmail ?? '–'}</p>
        <p><span className="font-medium">Címke:</span> {order.printedAt ? `kinyomtatva (${new Date(order.printedAt).toLocaleString('hu-HU')})` : 'még nincs nyomtatva'}</p>
        <p><span className="font-medium">Létrehozva:</span> {order.createdAt.toLocaleString('hu-HU')}</p>
        {addressChanged && order.shippingAddressChangedAt && (
          <p className="font-medium text-amber-200">
            Cím módosítva: {new Date(order.shippingAddressChangedAt).toLocaleString('hu-HU')}
          </p>
        )}
      </div>

      {addressChanged && (
        <div className="rounded-xl border-2 border-amber-500/60 bg-amber-950/25 p-4 space-y-4 print:hidden">
          <div className="flex items-center gap-2 text-amber-100">
            <Flame className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-semibold">Cím módosítva a vásárló által</h2>
          </div>
          <p className="text-sm text-amber-100/90">
            A futár / címke felé a <strong>módosított</strong> címet használd. Az eredeti cím csak
            referencia.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-sm font-semibold text-muted">Eredeti szállítási cím (fizetéskor)</p>
              <p className="text-sm">{order.originalCustomerName ?? '–'}</p>
              <p className="text-sm">{originalShippingAddress}</p>
              {order.originalCustomerPhone && (
                <p className="text-sm text-muted">Tel: {order.originalCustomerPhone}</p>
              )}
            </div>
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 space-y-1">
              <p className="text-sm font-semibold text-amber-100">Módosított szállítási cím (aktuális)</p>
              <p className="text-sm font-medium">{order.customerName ?? '–'}</p>
              <p className="text-sm font-medium">{shippingAddress}</p>
              {order.customerPhone && (
                <p className="text-sm text-muted">Tel: {order.customerPhone}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-3 print:hidden">
        <h2 className="text-lg font-semibold">Vevő és szállítás</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">Vevő</p>
            <p><span className="font-medium">Név:</span> {order.customerName ?? '–'}</p>
            <p><span className="font-medium">Telefon:</span> {order.customerPhone ?? '–'}</p>
            <p><span className="font-medium">Email:</span> {order.customerEmail ?? '–'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">
              {addressChanged ? 'Aktuális szállítási cím' : 'Szállítási cím'}
            </p>
            <p>
              <span className="font-medium">Típus:</span> {formatAddressTypeLabel(order.addressType)}
            </p>
            <p>{shippingAddress}</p>
            {!billingSame && (
              <>
                <p className="mt-3 text-sm font-medium text-muted">Számlázási cím</p>
                <p>{billingAddress}</p>
              </>
            )}
            {billingSame && (
              <p className="text-sm text-muted">Számlázási cím megegyezik a szállítási címmel.</p>
            )}
          </div>
        </div>
        {order.deliveryNotes?.trim() && (
          <div className="mt-4 rounded-lg border-2 border-amber-500/60 bg-amber-50/80 px-3 py-2 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Megjegyzés a futárnak
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{order.deliveryNotes.trim()}</p>
          </div>
        )}
        <AdminOrderCustomerEditForm
          orderId={order.id}
          initial={{
            customerName: order.customerName ?? '',
            customerPhone: order.customerPhone ?? '',
            customerEmail: order.customerEmail ?? '',
            shippingPostalCode: order.shippingPostalCode ?? '',
            shippingCity: order.shippingCity ?? '',
            shippingStreet: order.shippingStreet ?? '',
            shippingHouseNumber: order.shippingHouseNumber ?? '',
            billingSameAsShipping: order.billingSameAsShipping !== false,
            billingPostalCode: order.billingPostalCode ?? '',
            billingCity: order.billingCity ?? '',
            billingStreet: order.billingStreet ?? '',
            billingHouseNumber: order.billingHouseNumber ?? '',
            deliveryNotes: order.deliveryNotes ?? '',
          }}
        />
      </div>

      <div className="print:hidden">
        <h2 className="text-lg font-semibold mb-2">Tételek (gyártási adatok)</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--border)]/30 text-left">
                <th className="p-3 font-medium">Termék neve</th>
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Anyag</th>
                <th className="p-3 font-medium">Szín</th>
                <th className="p-3 font-medium text-right">Darabszám</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const spec = orderItemSpecForAdmin(item)
                return (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-medium">{spec.nev || item.productId}</td>
                    <td className="p-3 font-mono text-xs">{spec.sku || 'nincs SKU'}</td>
                    <td className="p-3">{spec.anyag || '—'}</td>
                    <td className="p-3">{spec.szin || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{spec.darabszam}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-semibold mt-6 mb-2">Gyártási recept (JSON / AI)</h2>
        <p className="text-xs text-muted mb-2">
          Strukturált adat a Bambu Lab P1S farm és az automatika számára. A vásárlói webshopon nem
          jelenik meg.
        </p>
        <AdminOrderProductionJson
          json={
            production.receptek.length === 1
              ? production.receptek[0]
              : {
                  rendeles_azonosito: production.rendeles_azonosito,
                  termekek: production.termekek,
                }
          }
          filename={`gyartas-${order.id}.json`}
        />
        <a
          href={`/api/admin/orders/${order.id}/production`}
          className="inline-block mt-3 text-sm text-accent hover:underline print:hidden"
        >
          Gyártási JSON API
        </a>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold print:hidden">Szállítási címke</h2>
        <AdminOrderLabelPrint
          order={{
            id: order.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            shippingPostalCode: order.shippingPostalCode,
            shippingCity: order.shippingCity,
            shippingStreet: order.shippingStreet,
            shippingHouseNumber: order.shippingHouseNumber,
            deliveryNotes: order.deliveryNotes,
            addressType: order.addressType,
            items: order.items.map((i) => ({
              name: i.name,
              productId: i.productId,
              qty: i.qty,
            })),
            printedAt: order.printedAt?.toISOString() ?? null,
          }}
        />
      </div>

      {order.orderType === 'sourcing' && (
        <div className="print:hidden">
          <AdminOrderDetailActions
            orderId={order.id}
            status={order.status}
          />
        </div>
      )}
    </div>
  )
}
