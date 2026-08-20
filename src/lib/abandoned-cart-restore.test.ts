import { describe, expect, it } from 'vitest'
import {
  abandonedCartRestoreUrl,
  generateRestoreToken,
  hashRestoreToken,
  isLikelyRestoreToken,
} from './abandoned-cart-restore'

describe('abandoned cart restore token', () => {
  it('hashes tokens with SHA-256 hex', () => {
    const { token, hash } = generateRestoreToken()
    expect(hash).toBe(hashRestoreToken(token))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(isLikelyRestoreToken(token)).toBe(true)
    expect(isLikelyRestoreToken('short')).toBe(false)
  })

  it('builds the cart restore deep link', () => {
    expect(abandonedCartRestoreUrl('abc', 'https://gulumen.hu/')).toBe(
      'https://gulumen.hu/kosar/visszaallitas?token=abc'
    )
  })
})
