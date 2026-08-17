import { describe, expect, it } from 'vitest'
import {
  buildProductionJobPayload,
  cartOptionsToParameters,
  parseOrderItemParameters,
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

  it('includes sku, qty and parameters for the printer farm', () => {
    const payload = buildProductionJobPayload({
      orderId: 'ord_1',
      orderGroupId: 'grp_1',
      status: 'paid',
      paidAt: '2026-08-17T00:00:00.000Z',
      items: [
        {
          sku: 'GUL-0000001454',
          productId: 'p1',
          name: 'Növény kötöző',
          qty: 2,
          parameters: { colorName: 'Zöld', colorHex: '#00aa00', materialName: 'PLA' },
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
    expect(payload.items).toEqual([
      {
        sku: 'GUL-0000001454',
        productId: 'p1',
        name: 'Növény kötöző',
        qty: 2,
        parameters: { colorName: 'Zöld', colorHex: '#00aa00', materialName: 'PLA' },
      },
      {
        sku: null,
        productId: 'p2',
        name: 'Szalvéta tartó',
        qty: 1,
        parameters: null,
      },
    ])
  })

  it('ignores unknown parameter shapes', () => {
    expect(parseOrderItemParameters(['x'])).toBeNull()
    expect(parseOrderItemParameters({ colorName: '  ' })).toBeNull()
  })
})
