import { describe, expect, it, vi } from 'vitest'
import {
  getRecaptchaMinScore,
  isRecaptchaConfigured,
  RECAPTCHA_ACTIONS,
  resetRecaptchaWarningForTests,
  verifyRecaptchaToken,
} from './recaptcha'

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'test',
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 'site',
    RECAPTCHA_SECRET_KEY: 'secret',
    ...overrides,
  }
}

describe('isRecaptchaConfigured', () => {
  it('requires both site and secret keys', () => {
    expect(isRecaptchaConfigured({})).toBe(false)
    expect(isRecaptchaConfigured({ NEXT_PUBLIC_RECAPTCHA_SITE_KEY: 'site' })).toBe(false)
    expect(isRecaptchaConfigured({ RECAPTCHA_SECRET_KEY: 'secret' })).toBe(false)
    expect(isRecaptchaConfigured(env())).toBe(true)
  })
})

describe('getRecaptchaMinScore', () => {
  it('defaults to 0.5 and clamps', () => {
    expect(getRecaptchaMinScore({})).toBe(0.5)
    expect(getRecaptchaMinScore({ RECAPTCHA_MIN_SCORE: '0.7' })).toBe(0.7)
    expect(getRecaptchaMinScore({ RECAPTCHA_MIN_SCORE: '9' })).toBe(1)
  })
})

describe('verifyRecaptchaToken', () => {
  it('skips when keys are unset', async () => {
    resetRecaptchaWarningForTests()
    const result = await verifyRecaptchaToken(
      { token: undefined, action: RECAPTCHA_ACTIONS.login },
      { NODE_ENV: 'test' }
    )
    expect(result).toEqual({ ok: true, skipped: true })
  })

  it('rejects a missing token when configured', async () => {
    const result = await verifyRecaptchaToken(
      { token: '', action: RECAPTCHA_ACTIONS.login },
      env()
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing')
  })

  it('accepts a high-score token for the expected action', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9, action: 'login' }),
    })
    const result = await verifyRecaptchaToken(
      { token: 'a'.repeat(40), action: RECAPTCHA_ACTIONS.login, ip: '203.0.113.10' },
      env(),
      fetcher as unknown as typeof fetch
    )
    expect(result).toEqual({ ok: true, score: 0.9 })
    expect(fetcher).toHaveBeenCalled()
  })

  it('rejects low scores and action mismatch', async () => {
    const low = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.1, action: 'login' }),
    })
    const lowResult = await verifyRecaptchaToken(
      { token: 'a'.repeat(40), action: RECAPTCHA_ACTIONS.login },
      env(),
      low as unknown as typeof fetch
    )
    expect(lowResult.ok).toBe(false)
    if (!lowResult.ok) expect(lowResult.reason).toBe('low_score')

    const mismatch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9, action: 'homepage' }),
    })
    const mismatchResult = await verifyRecaptchaToken(
      { token: 'a'.repeat(40), action: RECAPTCHA_ACTIONS.login },
      env(),
      mismatch as unknown as typeof fetch
    )
    expect(mismatchResult.ok).toBe(false)
    if (!mismatchResult.ok) expect(mismatchResult.reason).toBe('action')
  })
})
