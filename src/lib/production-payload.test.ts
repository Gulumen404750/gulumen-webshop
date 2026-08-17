import { describe, expect, it } from 'vitest'
import {
  buildGyartasiRecept,
  buildProductionJobPayload,
  cartOptionsToParameters,
  orderItemSpecForAdmin,
  parseOrderItemParameters,
  withGyartasiRecept,
} from './production-payload'

describe('production payload', () => {
  it('maps cart color/material options to parameters', () => {
    expect(cartOptionsToParameters({ colorName: 'Piros', colorHex: '#ff0000' })).toEqual({
      colorName: 'Piros',
      colorHex: '#ff0000',
    })
    expect(cartOptionsToParameters({ colorName: '  ' })).toBeUndefined()
    expect(cartOptionsToParameters(undefined)).toBeUndefined()
  })

  it('builds the Hungarian manufacturing recipe schema', () => {
    expect(
      buildGyartasiRecept({
        rendelesAzonosito: 'ORD-2026-0817-001',
        nev: 'Rózsaszín kuka egyedi konyhai fürdőszobai',
        sku: 'GUL-0000001454',
        qty: 2,
        parameters: { colorName: 'Rózsaszín', materialName: 'PLA' },
      })
    ).toEqual({
      rendeles_azonosito: 'ORD-2026-0817-001',
      termek: {
        nev: 'Rózsaszín kuka egyedi konyhai fürdőszobai',
        sku: 'GUL-0000001454',
        specifikaciok: {
          anyag: 'PLA',
          szin: 'Rózsaszín',
          darabszam: 2,
        },
      },
    })
  })

  it('includes sku, qty, Hungarian termekek and parameters for the printer farm', () => {
    const payload = buildProductionJobPayload({
      orderId: 'ORD-2026-0817-001',
      orderGroupId: 'grp_1',
      status: 'paid',
      paidAt: '2026-08-17T00:00:00.000Z',
      items: [
        {
          sku: 'GUL-0000001454',
          productId: 'p1',
          name: 'Rózsaszín kuka egyedi konyhai fürdőszobai',
          qty: 2,
          parameters: { colorName: 'Rózsaszín', colorHex: '#ff69b4', materialName: 'PLA' },
        },
        {
          sku: null,
          productId: 'p2',
          name: 'Szalvéta tartó',
          qty: 1,
        },
      ],
    })

    expect(payload.type).toBe('production_job')
    expect(payload.rendeles_azonosito).toBe('ORD-2026-0817-001')
    expect(payload.termekek).toEqual([
      {
        nev: 'Rózsaszín kuka egyedi konyhai fürdőszobai',
        sku: 'GUL-0000001454',
        specifikaciok: { anyag: 'PLA', szin: 'Rózsaszín', darabszam: 2 },
      },
      {
        nev: 'Szalvéta tartó',
        sku: '',
        specifikaciok: { anyag: '', szin: '', darabszam: 1 },
      },
    ])
    expect(payload.receptek[0]).toEqual({
      rendeles_azonosito: 'ORD-2026-0817-001',
      termek: payload.termekek[0],
    })
    expect(payload.items[0]?.parameters?.materialName).toBe('PLA')
    expect(payload.items[0]?.parameters?.recept?.termek.sku).toBe('GUL-0000001454')
  })

  it('parses Hungarian recept stored on the order item', () => {
    const parsed = parseOrderItemParameters({
      rendeles_azonosito: 'ORD-1',
      termek: {
        nev: 'Kuka',
        sku: 'GUL-1',
        specifikaciok: { anyag: 'PETG', szin: 'Fekete', darabszam: 3 },
      },
    })
    expect(parsed?.materialName).toBe('PETG')
    expect(parsed?.colorName).toBe('Fekete')
    expect(parsed?.recept?.termek.specifikaciok.darabszam).toBe(3)
  })

  it('attaches recept onto existing parameters', () => {
    const next = withGyartasiRecept('ord_1', {
      name: 'Kuka',
      sku: 'GUL-1',
      qty: 1,
      parameters: { colorName: 'Kék', materialName: 'TPU' },
    })
    expect(next.parameters?.recept?.rendeles_azonosito).toBe('ord_1')
    expect(next.parameters?.recept?.termek.specifikaciok.anyag).toBe('TPU')
  })

  it('ignores unknown parameter shapes', () => {
    expect(parseOrderItemParameters(['x'])).toBeNull()
    expect(parseOrderItemParameters({ colorName: '  ' })).toBeNull()
  })

  it('maps admin table fields from item + parameters', () => {
    expect(
      orderItemSpecForAdmin({
        name: 'Kuka',
        sku: 'GUL-0000001454',
        qty: 2,
        parameters: { colorName: 'Rózsaszín', materialName: 'PLA' },
      })
    ).toEqual({
      nev: 'Kuka',
      sku: 'GUL-0000001454',
      anyag: 'PLA',
      szin: 'Rózsaszín',
      darabszam: 2,
    })
  })
})
