import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const update = vi.fn()
const sendSuspiciousLoginAlert = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => true,
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}))

vi.mock('@/lib/login-alert-email', () => ({
  sendSuspiciousLoginAlert: (...args: unknown[]) => sendSuspiciousLoginAlert(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('account lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendSuspiciousLoginAlert.mockResolvedValue({ ok: true })
    update.mockResolvedValue({})
  })

  it('treats a future lockedUntil as locked', async () => {
    const { getUserLockoutStatus } = await import('./account-lockout')
    const lockedUntil = new Date(Date.now() + 60_000)
    const status = getUserLockoutStatus({ lockedUntil })
    expect(status.locked).toBe(true)
    if (status.locked) expect(status.retryAfterSec).toBeGreaterThan(0)
  })

  it('treats an expired lock as unlocked', async () => {
    const { getUserLockoutStatus } = await import('./account-lockout')
    expect(getUserLockoutStatus({ lockedUntil: new Date(Date.now() - 1000) }).locked).toBe(false)
    expect(getUserLockoutStatus({ lockedUntil: null }).locked).toBe(false)
  })

  it('locks on the 10th failure and sends one admin alert', async () => {
    findUnique.mockResolvedValue({ failedLoginCount: 9, lockedUntil: null })
    const { recordUserLoginFailure, ACCOUNT_LOCK_MAX_FAILURES } = await import('./account-lockout')
    const result = await recordUserLoginFailure({
      userId: 'user_1',
      email: 'buyer@example.com',
      ip: '203.0.113.10',
      userAgent: 'vitest',
    })
    expect(ACCOUNT_LOCK_MAX_FAILURES).toBe(10)
    expect(result.locked).toBe(true)
    expect(result.justLocked).toBe(true)
    expect(sendSuspiciousLoginAlert).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user_1' },
        data: expect.objectContaining({
          failedLoginCount: 10,
          lastFailedLoginIp: '203.0.113.10',
        }),
      })
    )
  })

  it('does not alert again while already locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000)
    findUnique.mockResolvedValue({ failedLoginCount: 12, lockedUntil })
    const { recordUserLoginFailure } = await import('./account-lockout')
    const result = await recordUserLoginFailure({
      userId: 'user_1',
      email: 'buyer@example.com',
      ip: '203.0.113.10',
    })
    expect(result.locked).toBe(true)
    expect(result.justLocked).toBe(false)
    expect(sendSuspiciousLoginAlert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('puts locked state on the 429 payload', async () => {
    const { tooManyLoginAttemptsResponse, TOO_MANY_LOGIN_ATTEMPTS_ERROR } = await import(
      './account-lockout'
    )
    const payload = tooManyLoginAttemptsResponse({ locked: true, retryAfterSec: 42 })
    expect(payload.status).toBe(429)
    expect(payload.body).toEqual({
      error: TOO_MANY_LOGIN_ATTEMPTS_ERROR,
      locked: true,
      retryAfterSec: 42,
    })
    expect(payload.headers['Retry-After']).toBe('42')
  })
})
