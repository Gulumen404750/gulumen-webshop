import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { AdminOrderDetailActions } from './AdminOrderDetailActions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/dashboard/orders" className="text-muted hover:text-foreground">
          ← Rendelések
        </Link>
        <h1 className="text-2xl font-heading font-bold text-foreground">Rendelés: {order.id}</h1>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
        <p><span className="font-medium">Státusz:</span> {order.status}</p>
        <p><span className="font-medium">Típus:</span> {order.orderType ?? '–'}</p>
        <p><span className="font-medium">Csoport ID:</span> {order.orderGroupId ?? '–'}</p>
        <p><span className="font-medium">Összeg:</span> {order.totalHuf.toLocaleString('hu-HU')} Ft (kedvezmény: {order.discountHuf} Ft)</p>
        <p><span className="font-medium">Fizetve:</span> {order.paidAt ? new Date(order.paidAt).toLocaleString('hu-HU') : '–'} {order.amountPaid != null && `(${order.amountPaid} ${order.currencyPaid ?? 'HUF'})`}</p>
        <p><span className="font-medium">Email:</span> {order.customerEmail ?? '–'}</p>
        <p><span className="font-medium">Létrehozva:</span> {order.createdAt.toLocaleString('hu-HU')}</p>
      </div>

      <div>
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

      {order.orderType === 'sourcing' && (
        <AdminOrderDetailActions
          orderId={order.id}
          status={order.status}
        />
      )}
    </div>
  )
}
