import { ShippingLabelQrCode } from '@/components/admin/ShippingLabelQrCode'
import {
  formatShippingLabelItemLine,
  shippingLabelQrText,
  type ShippingLabelProductionItem,
} from '@/lib/shipping-label'

export type ShippingLabelItem = ShippingLabelProductionItem

export type ShippingLabelOrder = {
  id: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  shippingPostalCode: string | null
  shippingCity: string | null
  shippingStreet: string | null
  shippingHouseNumber: string | null
  deliveryNotes?: string | null
  addressType?: string | null
  items: ShippingLabelItem[]
  qrDataUrl?: string | null
}

function formatAddressLines(o: ShippingLabelOrder): string[] {
  const line1 = [o.shippingStreet, o.shippingHouseNumber].filter(Boolean).join(' ')
  const line2 = [o.shippingPostalCode, o.shippingCity].filter(Boolean).join(' ')
  return [line1, line2].filter(Boolean)
}

/** Egy szállítási címke (nyomtatás / előnézet). */
export function ShippingLabelCard({ order }: { order: ShippingLabelOrder }) {
  const recipientName = order.customerName?.trim() || 'Címzett'
  const addressLines = formatAddressLines(order)
  const notes = order.deliveryNotes?.trim() || ''
  const addressTypeLabel =
    order.addressType === 'business'
      ? 'Cég / Munkahely'
      : order.addressType === 'home'
        ? 'Lakás / Magáncím'
        : order.addressType?.trim() || ''
  const qrValue = shippingLabelQrText(order.id, order.items)
  const itemLines = order.items.map(formatShippingLabelItemLine)

  return (
    <div
      className="shipping-label mx-auto max-w-[420px] border-2 border-black bg-white p-5 font-sans text-[13px] leading-snug text-black"
      style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-black pb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-neutral-600">Feladó</p>
          <p className="text-base font-bold">Gulumen</p>
          <p>gulumen.hu</p>
          <p>postmaster@gulumen.com</p>
        </div>
        <ShippingLabelQrCode
          value={qrValue}
          src={order.qrDataUrl}
          alt={`QR-kód: rendelés ${order.id}, gyártási tételek`}
        />
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
        {itemLines.length > 0 ? (
          <div className="mt-1 space-y-1">
            {itemLines.map((line, index) => (
              <p key={`${index}-${line}`} className="text-[11px] font-medium leading-snug">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-1 font-medium">—</p>
        )}
        <p className="mt-3 font-mono text-[11px] text-neutral-700">Rendelés: {order.id}</p>
      </div>
    </div>
  )
}
