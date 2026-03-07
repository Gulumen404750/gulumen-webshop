'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Order = {
  id: string
  status: string
  orderGroupId: string | null
  orderType: string | null
  totalHuf: number
  currency: string
  createdAt: string
  customerEmail: string | null
  paidAt: string | null
  amountPaid: number | null
  items: { productId: string; qty: number; name: string | null; priceHuf: number }[]
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.orders) setOrders(data.orders)
      })
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Rendelések</h1>

      <div className="flex flex-wrap gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-foreground"
        >
          <option value="">Összes státusz</option>
          <option value="pending">pending</option>
          <option value="payment_pending">payment_pending</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
          <option value="sourcing_pending">sourcing_pending</option>
          <option value="sourcing_failed">sourcing_failed</option>
          <option value="fulfilled">fulfilled</option>
          <option value="cancelled">cancelled</option>
        </select>
      </div>

      {loading ? (
        <p className="text-muted">Betöltés…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">ID</th>
                <th className="p-3 font-medium">Státusz</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Összeg</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Dátum</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--border)]/20">
                  <td className="p-3 font-mono text-xs">{o.id}</td>
                  <td className="p-3">{o.status}</td>
                  <td className="p-3">{o.orderType ?? '–'}</td>
                  <td className="p-3">{o.totalHuf.toLocaleString('hu-HU')} Ft</td>
                  <td className="p-3">{o.customerEmail ?? '–'}</td>
                  <td className="p-3 text-muted">{new Date(o.createdAt).toLocaleString('hu-HU')}</td>
                  <td className="p-3">
                    <Link href={`/admin/dashboard/orders/${o.id}`} className="text-accent hover:underline">
                      Részletek
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <p className="text-muted">Nincs rendelés.</p>
      )}
    </div>
  )
}
