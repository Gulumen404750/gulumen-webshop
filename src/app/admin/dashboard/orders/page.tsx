'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdminOrdersListSkeleton } from '@/components/AdminTableSkeleton'
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge'
import { ShippingLabelCard } from '@/components/admin/ShippingLabelCard'
import { getOrderPrintRowStyles, isOrderPrinted } from '@/lib/admin-order-badges'
import { shippingLabelItemsFromOrderItems, shippingLabelQrText } from '@/lib/shipping-label'

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
  customerPhone: string | null
  shippingPostalCode: string | null
  shippingCity: string | null
  shippingStreet: string | null
  shippingHouseNumber: string | null
  deliveryNotes: string | null
  addressType: string | null
  paidAt: string | null
  printedAt: string | null
  shippingAddressChangedAt: string | null
  amountPaid: number | null
  items: {
    productId: string
    qty: number
    name: string | null
    priceHuf: number
    sku?: string | null
    parameters?: unknown
  }[]
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportingProduction, setExportingProduction] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPrinting, setBulkPrinting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [showBulkPreview, setShowBulkPreview] = useState(false)
  const [bulkQrByOrderId, setBulkQrByOrderId] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    setSelectedIds(new Set())
    setShowBulkPreview(false)
    setBulkQrByOrderId({})
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.orders) setOrders(data.orders)
      })
      .finally(() => setLoading(false))
  }, [statusFilter])

  const allSelected = orders.length > 0 && selectedIds.size === orders.length
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  )

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)))
    }
  }

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

  const handleExportProduction = async () => {
    setExportingProduction(true)
    try {
      const params = new URLSearchParams({ format: 'production' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/orders/export?${params}`)
      if (!res.ok) throw new Error('Export sikertelen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? `gyartas-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Gyártási JSON export sikertelen.')
    } finally {
      setExportingProduction(false)
    }
  }

  const handleBulkPrint = async () => {
    if (selectedOrders.length === 0) return
    setBulkPrinting(true)
    setBulkError(null)
    setShowBulkPreview(true)
    try {
      const res = await fetch('/api/admin/orders/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedOrders.map((o) => o.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Tömeges nyomtatás jelölése sikertelen')
      }
      const printedAt =
        typeof data.printedAt === 'string' ? data.printedAt : new Date().toISOString()
      const idSet = new Set(selectedOrders.map((o) => o.id))
      // Azonnali UI: lila → zöld (printedAt = isPrinted)
      setOrders((prev) =>
        prev.map((o) => (idSet.has(o.id) ? { ...o, printedAt: o.printedAt ?? printedAt } : o))
      )
      const { generateShippingLabelQrDataUrl } = await import('@/lib/shipping-label-qr')
      const qrEntries = await Promise.all(
        selectedOrders.map(async (o) => {
          const items = shippingLabelItemsFromOrderItems(o.items)
          const url = await generateShippingLabelQrDataUrl(shippingLabelQrText(o.id, items))
          return [o.id, url] as const
        })
      )
      setBulkQrByOrderId(Object.fromEntries(qrEntries))
      await new Promise((r) => setTimeout(r, 80))
      window.print()
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Hiba a tömeges nyomtatáskor')
    } finally {
      setBulkPrinting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground print:hidden">Rendelések</h1>

      <div className="flex flex-wrap items-center gap-4 print:hidden">
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
          title="Tételes könyvelési CSV (pontosvessző, UTF-8), Excel / WPS Office-hoz"
        >
          {exporting ? 'Exportálás…' : 'Export CSV'}
        </button>
        <button
          type="button"
          onClick={handleExportProduction}
          disabled={exportingProduction}
          className="rounded-lg border border-[var(--border)] bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--border)]/30 disabled:opacity-60"
        >
          {exportingProduction ? 'Exportálás…' : 'Gyártási JSON'}
        </button>
        <button
          type="button"
          onClick={handleBulkPrint}
          disabled={bulkPrinting || selectedIds.size === 0}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-600 disabled:opacity-50"
        >
          {bulkPrinting
            ? 'Nyomtatás…'
            : `Kijelöltek nyomtatása (${selectedIds.size})`}
        </button>
        <span className="text-xs text-muted">
          Lila = még nem nyomtatott · Zöld = címke kinyomtatva
        </span>
      </div>

      {bulkError && (
        <p className="text-sm text-red-600 print:hidden">{bulkError}</p>
      )}

      {loading ? (
        <div className="print:hidden">
          <AdminOrdersListSkeleton />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] print:hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--border)]/30">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Összes kijelölése"
                    title="Összes kijelölése"
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                </th>
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
                const printed = isOrderPrinted(o.printedAt)
                const rowClass = getOrderPrintRowStyles(printed)
                const checked = selectedIds.has(o.id)
                return (
                  <tr
                    key={o.id}
                    className={`border-b transition-colors ${rowClass}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Kijelölés: ${o.id}`}
                        className="h-4 w-4 rounded border-white/30"
                      />
                    </td>
                    <td className="p-3 font-mono text-xs sm:text-sm">{o.id}</td>
                    <td className="p-3">
                      <AdminOrderStatusBadge
                        status={o.status}
                        printedAt={o.printedAt}
                        shippingAddressChangedAt={o.shippingAddressChangedAt}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{o.customerName ?? '–'}</div>
                      <div className="text-xs opacity-80">{o.customerEmail ?? ''}</div>
                    </td>
                    <td className="p-3">{o.orderType ?? '–'}</td>
                    <td className="p-3 font-semibold">{o.totalHuf.toLocaleString('hu-HU')} Ft</td>
                    <td className="p-3 opacity-90">{new Date(o.createdAt).toLocaleString('hu-HU')}</td>
                    <td className="p-3">
                      <Link
                        href={`/admin/dashboard/orders/${o.id}`}
                        className="font-medium underline underline-offset-2 hover:opacity-80"
                      >
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
        <p className="text-muted print:hidden">Nincs rendelés.</p>
      )}

      {showBulkPreview && selectedOrders.length > 0 && (
        <div
          id="admin-bulk-shipping-labels"
          className="hidden print:block space-y-0 bg-white text-black"
        >
          {selectedOrders.map((o) => (
            <div key={o.id} className="bulk-label-page py-4">
              <ShippingLabelCard
                order={{
                  id: o.id,
                  customerName: o.customerName,
                  customerPhone: o.customerPhone,
                  customerEmail: o.customerEmail,
                  shippingPostalCode: o.shippingPostalCode,
                  shippingCity: o.shippingCity,
                  shippingStreet: o.shippingStreet,
                  shippingHouseNumber: o.shippingHouseNumber,
                  deliveryNotes: o.deliveryNotes,
                  addressType: o.addressType,
                  items: shippingLabelItemsFromOrderItems(o.items),
                  qrDataUrl: bulkQrByOrderId[o.id] ?? null,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #admin-bulk-shipping-labels,
          #admin-bulk-shipping-labels * {
            visibility: visible !important;
          }
          #admin-bulk-shipping-labels {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            display: block !important;
          }
          .bulk-label-page {
            page-break-after: always;
            page-break-inside: avoid;
          }
          .bulk-label-page:last-child {
            page-break-after: auto;
          }
          .shipping-label {
            max-width: 100mm !important;
            min-height: 70mm !important;
          }
          .shipping-label img {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          .shipping-label-logo {
            width: 48px !important;
            height: 48px !important;
            max-width: 48px !important;
            flex-shrink: 0 !important;
            border-radius: 50% !important;
            object-fit: cover !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  )
}
