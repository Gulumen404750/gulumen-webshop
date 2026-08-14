import { describe, expect, it } from 'vitest'
import { maskEmail } from './admin-pii'

describe('maskEmail', () => {
  it('keeps the first local character and the domain', () => {
    expect(maskEmail('ada@gulumen.com')).toBe('a***@gulumen.com')
  })

  it('does not leak a malformed value', () => {
    expect(maskEmail('not-an-email')).toBe('***')
  })
})
