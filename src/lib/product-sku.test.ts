import { describe, expect, it } from 'vitest'
import {
  formatGeneratedSku,
  isValidProductSku,
  nextGeneratedSku,
  normalizeProductSku,
  parseGeneratedSkuSeq,
} from './product-sku'

describe('product SKU', () => {
  it('normalizes to uppercase and trims', () => {
    expect(normalizeProductSku('  gul-0000001454  ')).toBe('GUL-0000001454')
    expect(normalizeProductSku('')).toBeNull()
    expect(normalizeProductSku('   ')).toBeNull()
  })

  it('accepts GUL-0000001454 and other hyphenated codes', () => {
    expect(isValidProductSku('GUL-0000001454')).toBe(true)
    expect(isValidProductSku('ABC-12')).toBe(true)
    expect(isValidProductSku('GUL-0000001454!')).toBe(false)
    expect(isValidProductSku('')).toBe(false)
  })

  it('formats and parses generated sequence numbers', () => {
    expect(formatGeneratedSku(1454)).toBe('GUL-0000001454')
    expect(parseGeneratedSkuSeq('GUL-0000001454')).toBe(1454)
    expect(parseGeneratedSkuSeq('GUL-12')).toBe(12)
    expect(parseGeneratedSkuSeq('ABC-1')).toBeNull()
  })

  it('allocates the next GUL sequence from existing codes', () => {
    expect(nextGeneratedSku([])).toBe('GUL-0000000001')
    expect(nextGeneratedSku(['GUL-0000001454', 'MANUAL-1', null])).toBe('GUL-0000001455')
    expect(nextGeneratedSku(['GUL-9', 'GUL-0000000010'])).toBe('GUL-0000000011')
  })
})
