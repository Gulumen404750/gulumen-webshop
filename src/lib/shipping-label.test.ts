import { describe, expect, it } from 'vitest'
import {
  buildShippingLabelQrPayload,
  formatShippingLabelItemLine,
  serializeShippingLabelQrPayload,
  shippingLabelItemsFromOrderItems,
  shippingLabelQrText,
} from './shipping-label'
import { generateShippingLabelQrDataUrl } from './shipping-label-qr'

describe('shipping label production items', () => {
  it('maps order items to manufacturing fields for the label', () => {
    expect(
      shippingLabelItemsFromOrderItems([
        {
          name: 'Rózsaszín kuka',
          productId: 'p1',
          sku: 'GUL-0000001454',
          qty: 2,
          parameters: { colorName: 'Rózsaszín', materialName: 'PLA' },
        },
        {
          name: null,
          productId: 'p2',
          sku: null,
          qty: 1,
        },
      ])
    ).toEqual([
      {
        nev: 'Rózsaszín kuka',
        sku: 'GUL-0000001454',
        anyag: 'PLA',
        szin: 'Rózsaszín',
        darabszam: 2,
      },
      {
        nev: 'p2',
        sku: '',
        anyag: '',
        szin: '',
        darabszam: 1,
      },
    ])
  })

  it('formats each line with SKU, material, color and qty', () => {
    expect(
      formatShippingLabelItemLine({
        nev: 'Rózsaszín kuka',
        sku: 'GUL-0000001454',
        anyag: 'PLA',
        szin: 'Rózsaszín',
        darabszam: 2,
      })
    ).toBe(
      '- Rózsaszín kuka | SKU: GUL-0000001454 | Anyag: PLA | Szín: Rózsaszín | Darab: 2'
    )
  })

  it('uses em dash for missing manufacturing fields', () => {
    expect(
      formatShippingLabelItemLine({
        nev: '',
        sku: '  ',
        anyag: '',
        szin: '',
        darabszam: 1,
      })
    ).toBe('- — | SKU: — | Anyag: — | Szín: — | Darab: 1')
  })

  it('serializes compact JSON with order id and items for the QR code', () => {
    const items = shippingLabelItemsFromOrderItems([
      {
        name: 'Kuka',
        sku: 'GUL-1',
        qty: 3,
        parameters: { colorName: 'Fekete', materialName: 'PETG' },
      },
    ])
    const payload = buildShippingLabelQrPayload('ORD-2026-0818-001', items)
    expect(payload).toEqual({
      rendeles_azonosito: 'ORD-2026-0818-001',
      tetelek: [
        {
          nev: 'Kuka',
          sku: 'GUL-1',
          anyag: 'PETG',
          szin: 'Fekete',
          darabszam: 3,
        },
      ],
    })
    expect(shippingLabelQrText('ORD-2026-0818-001', items)).toBe(
      '{"rendeles_azonosito":"ORD-2026-0818-001","tetelek":[{"nev":"Kuka","sku":"GUL-1","anyag":"PETG","szin":"Fekete","darabszam":3}]}'
    )
  })
})

describe('shipping label QR image', () => {
  it('renders a PNG data URL that encodes the JSON payload', async () => {
    const text = serializeShippingLabelQrPayload(
      buildShippingLabelQrPayload('ORD-1', [
        { nev: 'Kuka', sku: 'GUL-1', anyag: 'PLA', szin: 'Kék', darabszam: 1 },
      ])
    )
    const url = await generateShippingLabelQrDataUrl(text)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(url.length).toBeGreaterThan(200)
  })
})
