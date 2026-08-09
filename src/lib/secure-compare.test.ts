import { describe, expect, it } from 'vitest'
import { secureCompare } from './secure-compare'

describe('secureCompare', () => {
  it('returns true for equal secrets', () => {
    expect(secureCompare('super-secret', 'super-secret')).toBe(true)
  })

  it('returns false for different secrets of same length', () => {
    expect(secureCompare('super-secret', 'super-secreX')).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(secureCompare('abc', 'abcd')).toBe(false)
  })

  it('returns false for null/undefined/empty', () => {
    expect(secureCompare(null, 'x')).toBe(false)
    expect(secureCompare('x', undefined)).toBe(false)
    expect(secureCompare('', 'x')).toBe(false)
    expect(secureCompare('x', '')).toBe(false)
  })
})
