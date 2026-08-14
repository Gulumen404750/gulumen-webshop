import { describe, expect, it } from 'vitest'
import {
  hashAdminPassword,
  validateAdminPassword,
  verifyAdminPassword,
} from './admin-password'

describe('validateAdminPassword', () => {
  it('rejects short or incomplete passwords', () => {
    expect(validateAdminPassword('short1')).toEqual({
      ok: false,
      error: 'A jelszó legalább 12 karakter legyen.',
    })
    expect(validateAdminPassword('n0spaces hereX')).toEqual({
      ok: false,
      error: 'A jelszó ne tartalmazzon szóközt.',
    })
    expect(validateAdminPassword('abcdefghijkl')).toEqual({
      ok: false,
      error: 'A jelszó tartalmazzon betűt és számot is.',
    })
  })

  it('accepts a letter+digit password of at least 12 chars', () => {
    expect(validateAdminPassword('CorrectHorse1')).toEqual({ ok: true })
  })
})

describe('hashAdminPassword / verifyAdminPassword', () => {
  it('round-trips a password and rejects a wrong one', async () => {
    const hash = await hashAdminPassword('CorrectHorse1')
    expect(hash).not.toContain('CorrectHorse1')
    expect(await verifyAdminPassword('CorrectHorse1', hash)).toBe(true)
    expect(await verifyAdminPassword('WrongPassword1', hash)).toBe(false)
  })
})
