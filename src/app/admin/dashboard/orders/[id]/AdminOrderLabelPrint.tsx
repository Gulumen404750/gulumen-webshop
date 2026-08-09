'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShippingLabelCard, type ShippingLabelOrder } from '@/components/admin/ShippingLabelCard'

export type LabelOrderData = ShippingLabelOrder & { printedAt: string | null }

export function AdminOrderLabelPrint({ order }: { order: LabelOrderData }) {
  const router = useRouter()
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markPrinted = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${order.id}/print`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || 'Nyomtatás jelölése sikertelen')
    }
    return data as { printedAt?: string }
  }, [order.id])

  const handlePrint = async () => {
    setPrinting(true)
    setError(null)
    try {
      await markPrinted()
      router.refresh()
      await new Promise((r) => setTimeout(r, 50))
      window.print()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba a nyomtatáskor')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {printing ? 'Nyomtatás…' : 'Címke nyomtatása'}
        </button>
        {order.printedAt && (
          <span className="text-sm text-muted">
            Utoljára nyomtatva: {new Date(order.printedAt).toLocaleString('hu-HU')}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      <div
        id="admin-shipping-label"
        className="rounded-xl border border-[var(--border)] bg-white p-6 print:rounded-none print:border-0 print:p-0"
      >
        <ShippingLabelCard order={order} />
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #admin-shipping-label,
          #admin-shipping-label * {
            visibility: visible !important;
          }
          #admin-shipping-label {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm !important;
            background: white !important;
          }
          .shipping-label {
            max-width: 100mm !important;
            min-height: 70mm !important;
            page-break-inside: avoid;
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
