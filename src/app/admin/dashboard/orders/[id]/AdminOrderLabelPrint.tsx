'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

export type LabelOrderItem = {
  name: string | null
  productId: string
  qty: number
}

export type LabelOrderData = {
  id: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  shippingPostalCode: string | null
  shippingCity: string | null
  shippingStreet: string | null
  shippingHouseNumber: string | null
  deliveryNotes: string | null
  addressType: string | null
  items: LabelOrderItem[]
  printedAt: string | null
}

function formatAddressLines(o: LabelOrderData): string[] {
  const line1 = [o.shippingStreet, o.shippingHouseNumber].filter(Boolean).join(' ')
  const line2 = [o.shippingPostalCode, o.shippingCity].filter(Boolean).join(' ')
  return [line1, line2].filter(Boolean)
}

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
      // Rövid késleltetés, hogy a print CSS és DOM frissüljön
      await new Promise((r) => setTimeout(r, 50))
      window.print()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hiba a nyomtatáskor')
    } finally {
      setPrinting(false)
    }
  }

  const recipientName = order.customerName?.trim() || 'Címzett'
  const addressLines = formatAddressLines(order)
  const notes = order.deliveryNotes?.trim() || ''
  const addressTypeLabel =
    order.addressType === 'business'
      ? 'Cég / Munkahely'
      : order.addressType === 'home'
        ? 'Lakás / Magáncím'
        : order.addressType?.trim() || ''
  const contents = order.items
    .map((i) => `${i.qty}× ${i.name?.trim() || i.productId}`)
    .join(', ')

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

      {/* Előnézet + nyomtatási lap */}
      <div
        id="admin-shipping-label"
        className="rounded-xl border border-[var(--border)] bg-white p-6 text-black print:rounded-none print:border-0 print:p-0"
      >
        <div className="shipping-label mx-auto max-w-[420px] border-2 border-black p-5 font-sans text-[13px] leading-snug">
          <div className="mb-4 border-b border-black pb-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-600">Feladó</p>
            <p className="text-base font-bold">Gulumen</p>
            <p>gulumen.hu</p>
            <p>info@gulumen.hu</p>
          </div>

          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-wide text-neutral-600">Címzett</p>
            <p className="text-lg font-bold">{recipientName}</p>
            {addressTypeLabel && (
              <p className="text-[12px] font-semibold uppercase tracking-wide">{addressTypeLabel}</p>
            )}
            {order.customerPhone && <p>Tel: {order.customerPhone}</p>}
            {addressLines.length > 0 ? (
              addressLines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>—</p>
            )}
            {order.customerEmail && <p className="mt-1 text-neutral-700">{order.customerEmail}</p>}
          </div>

          {notes && (
            <div className="mb-4 border-2 border-black bg-neutral-100 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide">Megjegyzés a futárnak</p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] font-bold leading-snug">{notes}</p>
            </div>
          )}

          <div className="border-t border-black pt-3">
            <p className="text-[10px] uppercase tracking-wide text-neutral-600">Csomag tartalma</p>
            <p className="mt-1 font-medium">{contents || '—'}</p>
            <p className="mt-3 font-mono text-[11px] text-neutral-700">Rendelés: {order.id}</p>
          </div>
        </div>
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
