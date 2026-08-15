export type ShippingLabelItem = {
  name: string | null
  productId: string
  qty: number
}

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
  const contents = order.items
    .map((i) => `${i.qty}× ${i.name?.trim() || i.productId}`)
    .join(', ')

  return (
    <div className="shipping-label mx-auto max-w-[420px] border-2 border-black bg-white p-5 font-sans text-[13px] leading-snug text-black">
      <div className="mb-4 border-b border-black pb-3">
        <p className="text-[10px] uppercase tracking-wide text-neutral-600">Feladó</p>
        <p className="text-base font-bold">Gulumen</p>
        <p>gulumen.hu</p>
        <p>postmaster@gulumen.com</p>
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
  )
}
