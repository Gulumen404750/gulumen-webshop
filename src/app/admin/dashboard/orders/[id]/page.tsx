import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { AdminOrderDetailActions } from './AdminOrderDetailActions'
import { AdminOrderLabelPrint } from './AdminOrderLabelPrint'
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge'
import { adminOrderKindClasses, getAdminOrderVisualKind } from '@/lib/admin-order-badges'

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

  const kind = getAdminOrderVisualKind(order.status, order.printedAt)
  const kindClasses = adminOrderKindClasses(kind)
  const billingSame = order.billingSameAsShipping !== false
  const shippingAddress = formatHuAddress({
    postalCode: order.shippingPostalCode,
    city: order.shippingCity,
    street: order.shippingStreet,
    houseNumber: order.shippingHouseNumber,
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
        <AdminOrderStatusBadge status={order.status} printedAt={order.printedAt} />
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
      </div>

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
            <p className="text-sm font-medium text-muted">Szállítási cím</p>
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
      </div>

      <div className="print:hidden">
        <h2 className="text-lg font-semibold mb-2">Tételek</h2>
        <ul className="space-y-1">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4">
              <span>{i.name ?? i.productId}</span>
              <span>{i.qty} db</span>
              <span>{i.priceHuf.toLocaleString('hu-HU')} Ft</span>
            </li>
          ))}
        </ul>
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
