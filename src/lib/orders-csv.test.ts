import { describe, expect, it } from 'vitest'
import {
  ORDERS_CSV_HEADERS,
  buildOrdersCsv,
  encodeCsvUtf8Bom,
  escapeCsvField,
  formatOrdersCsvDateTime,
  formatOrdersCsvPaymentType,
} from './orders-csv'

function csvLines(csv: string): string[] {
  const body = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv
  return body.split('\r\n')
}

describe('orders CSV export', () => {
  it('encodes a real UTF-8 BOM as EF BB BF bytes', () => {
    const bytes = encodeCsvUtf8Bom(buildOrdersCsv([]))
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8').decode(bytes.slice(3))
    expect(text.startsWith(ORDERS_CSV_HEADERS.join(';'))).toBe(true)
  })

  it('uses UTF-8 BOM and semicolon separators', () => {
    const csv = buildOrdersCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const [header] = csvLines(csv)
    expect(header).toBe(ORDERS_CSV_HEADERS.join(';'))
    expect(header.split(';')).toHaveLength(13)
    expect(header).toContain('Rendelés ID')
    expect(header).toContain('SKU / Termékkód')
    expect(header).not.toContain(',')
  })

  it('emits one row per order item and repeats order fields', () => {
    const csv = buildOrdersCsv([
      {
        id: 'ord_1787000691252abc',
        createdAt: new Date('2026-08-17T21:04:51.000Z'),
        customerName: 'Deak Daniel',
        customerEmail: 'lauti404750@gmail.com',
        status: 'paid',
        orderType: 'in_stock',
        items: [
          {
            name: 'Rózsaszín kuka',
            sku: 'GUL-0000001454',
            qty: 1,
            priceHuf: 4500,
            fulfillmentType: 'stock',
            parameters: { colorName: 'Rózsaszín', materialName: 'PLA' },
          },
          {
            name: 'Lámpa',
            sku: 'GUL-0000001455',
            qty: 2,
            priceHuf: 8500,
            fulfillmentType: 'stock',
            parameters: { colorName: 'Fehér', materialName: 'PETG' },
          },
        ],
      },
    ])
    const lines = csvLines(csv)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(
      [
        'ord_1787000691252abc',
        '2026-08-17 23:04:51',
        'Deak Daniel',
        'lauti404750@gmail.com',
        'Fizetve',
        'Rózsaszín kuka',
        'GUL-0000001454',
        'PLA',
        'Rózsaszín',
        '1',
        '4500',
        '4500',
        'in_stock',
      ].join(';')
    )
    expect(lines[2]).toContain('Lámpa')
    expect(lines[2]).toContain('GUL-0000001455')
    expect(lines[2]).toContain('PETG')
    expect(lines[2]).toContain(';2;8500;17000;in_stock')
    expect(lines[2].startsWith('ord_1787000691252abc;')).toBe(true)
  })

  it('keeps an order with no items as a single empty product row', () => {
    const csv = buildOrdersCsv([
      {
        id: 'ord_empty',
        createdAt: new Date('2026-08-17T21:04:51.000Z'),
        customerName: 'Teszt',
        customerEmail: 't@example.com',
        status: 'payment_pending',
        orderType: 'sourcing',
        items: [],
      },
    ])
    const [, row] = csvLines(csv)
    expect(row).toContain('ord_empty')
    expect(row).toContain('Fizetés folyamatban')
    expect(row).toContain('sourcing')
    expect(row.split(';')).toHaveLength(13)
  })

  it('quotes fields that contain semicolons, quotes or newlines', () => {
    expect(escapeCsvField('egyszerű')).toBe('egyszerű')
    expect(escapeCsvField('a;b')).toBe('"a;b"')
    expect(escapeCsvField('mondta: "ok"')).toBe('"mondta: ""ok"""')
    expect(escapeCsvField('sor\ntörés')).toBe('"sor\ntörés"')
  })

  it('formats Budapest local time and payment type fallbacks', () => {
    expect(formatOrdersCsvDateTime(new Date('2026-08-17T21:04:51.000Z'))).toBe('2026-08-17 23:04:51')
    expect(formatOrdersCsvPaymentType('in_stock')).toBe('in_stock')
    expect(formatOrdersCsvPaymentType(null, 'procurement')).toBe('sourcing')
    expect(formatOrdersCsvPaymentType('', 'stock')).toBe('in_stock')
  })

  it('reads SKU, material and colour from the manufacturing recipe when top-level fields are missing', () => {
    const csv = buildOrdersCsv([
      {
        id: 'ord_recipe',
        createdAt: new Date('2026-08-17T21:04:51.000Z'),
        customerName: 'Vevő',
        customerEmail: 'v@example.com',
        status: 'paid',
        orderType: 'in_stock',
        items: [
          {
            name: null,
            sku: null,
            qty: 1,
            priceHuf: 1890,
            parameters: {
              recept: {
                rendeles_azonosito: 'ord_recipe',
                termek: {
                  nev: 'Szalvéta tartó',
                  sku: 'GUL-0000001454',
                  specifikaciok: { anyag: 'PLA', szin: 'Rózsaszín', darabszam: 1 },
                },
              },
            },
          },
        ],
      },
    ])
    const [, row] = csvLines(csv)
    expect(row).toContain('Szalvéta tartó')
    expect(row).toContain('GUL-0000001454')
    expect(row).toContain('PLA')
    expect(row).toContain('Rózsaszín')
    expect(row).toContain(';1;1890;1890;')
  })
})
