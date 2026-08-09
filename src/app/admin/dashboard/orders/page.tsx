'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminOrdersListSkeleton } from '@/components/AdminTableSkeleton'
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge'
import { getAdminOrderVisualKind, adminOrderKindClasses } from '@/lib/admin-order-badges'

type Order = {
  id: string
  status: string
  orderGroupId: string | null
  orderType: string | null
  totalHuf: number
  currency: string
  createdAt: string
  customerEmail: string | null
  customerName: string | null
  paidAt: string | null
  printedAt: string | null
  amountPaid: number | null
  items: { productId: string; qty: number; name: string | null; priceHuf: number }[]
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.orders) setOrders(data.orders)
      })
      .finally(() => setLoading(false))
  }, [statusFilter])

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/orders/export?${params}`)
      if (!res.ok) throw new Error('Export sikertelen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? `rendelesek-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('CSV export sikertelen.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Rendelések</h1>

      <div className="flex flex-wrap items-center gap-4">
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
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="rounded-lg border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-60"
        >
          {exporting ? 'Exportálás…' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <AdminOrdersListSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 font-medium">ID</th>
                <th className="p-3 font-medium">Státusz</th>
                <th className="p-3 font-medium">Vevő</th>
                <th className="p-3 font-medium">Típus</th>
                <th className="p-3 font-medium">Összeg</th>
                <th className="p-3 font-medium">Dátum</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const kind = getAdminOrderVisualKind(o.status, o.printedAt)
                const rowClass = adminOrderKindClasses(kind).row
                return (
                  <tr
                    key={o.id}
                    className={`border-b border-[var(--border)] hover:opacity-95 ${rowClass}`}
                  >
                    <td className="p-3 font-mono text-xs">{o.id}</td>
                    <td className="p-3">
                      <AdminOrderStatusBadge status={o.status} printedAt={o.printedAt} />
                    </td>
                    <td className="p-3">
                      <div>{o.customerName ?? '–'}</div>
                      <div className="text-xs text-muted">{o.customerEmail ?? ''}</div>
                    </td>
                    <td className="p-3">{o.orderType ?? '–'}</td>
                    <td className="p-3">{o.totalHuf.toLocaleString('hu-HU')} Ft</td>
                    <td className="p-3 text-muted">{new Date(o.createdAt).toLocaleString('hu-HU')}</td>
                    <td className="p-3">
                      <Link href={`/admin/dashboard/orders/${o.id}`} className="text-accent hover:underline">
                        Részletek
                      </Link>
                    </td>
                  </tr>
                )
              })}
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
