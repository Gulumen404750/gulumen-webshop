import { describe, expect, it } from 'vitest'
import { isBirthdayToday, parseBirthDateInput } from '@/lib/birthday-coupon'

describe('isBirthdayToday', () => {
  it('returns true when month and day match (UTC-stored birthDate)', () => {
    const birth = parseBirthDateInput('1990-08-08')
    expect(birth).toBeInstanceOf(Date)
    // Fixed "now" in Europe/Budapest summer: 2026-08-08
    const now = new Date('2026-08-08T12:00:00+02:00')
    expect(isBirthdayToday(birth as Date, now)).toBe(true)
  })

  it('returns false on a different day', () => {
    const birth = parseBirthDateInput('1990-08-08')
    const now = new Date('2026-08-09T12:00:00+02:00')
    expect(isBirthdayToday(birth as Date, now)).toBe(false)
  })

  it('returns false when birthDate is missing', () => {
    expect(isBirthdayToday(null)).toBe(false)
    expect(isBirthdayToday(undefined)).toBe(false)
  })
})
