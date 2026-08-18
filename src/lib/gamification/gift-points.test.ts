import { describe, expect, it } from 'vitest'
import {
  giftPointExpiresAt,
  isGiftGrantActive,
  planGiftPointConsumption,
  sumAvailableGiftPoints,
} from './gift-points'

describe('NFC gift points', () => {
  it('expires one month after activation', () => {
    const activated = new Date('2026-08-18T10:00:00.000Z')
    const expires = giftPointExpiresAt(activated, 30)
    expect(expires.toISOString()).toBe('2026-09-17T10:00:00.000Z')
  })

  it('counts only unexpired remaining points', () => {
    const now = new Date('2026-08-18T12:00:00.000Z')
    const grants = [
      { remaining: 500, expiresAt: new Date('2026-09-01T00:00:00.000Z') },
      { remaining: 200, expiresAt: new Date('2026-08-01T00:00:00.000Z') },
      { remaining: 0, expiresAt: new Date('2026-09-01T00:00:00.000Z') },
    ]
    expect(sumAvailableGiftPoints(grants, now)).toBe(500)
    expect(isGiftGrantActive(grants[1]!, now)).toBe(false)
  })

  it('consumes FIFO by soonest expiry', () => {
    const now = new Date('2026-08-18T12:00:00.000Z')
    const plan = planGiftPointConsumption(
      [
        { id: 'later', remaining: 400, expiresAt: new Date('2026-09-20T00:00:00.000Z') },
        { id: 'sooner', remaining: 150, expiresAt: new Date('2026-09-01T00:00:00.000Z') },
      ],
      200,
      now
    )
    expect(plan).toEqual([
      { id: 'sooner', take: 150 },
      { id: 'later', take: 50 },
    ])
  })
})
