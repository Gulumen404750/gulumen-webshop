import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN_LOCK_MAX_FAILURES,
  clearAdminLoginLockout,
  getAdminLoginLockout,
  recordAdminLoginFailure,
  resetAdminLoginLockoutStoreForTests,
} from './admin-login-lockout'

const sendSuspiciousLoginAlert = vi.fn()

vi.mock('@/lib/login-alert-email', () => ({
  sendSuspiciousLoginAlert: (...args: unknown[]) => sendSuspiciousLoginAlert(...args),
}))

vi.mock('@/lib/redis', () => ({
  isRedisConfigured: () => false,
  getRedis: () => null,
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

function req(ip = '203.0.113.99') {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'user-agent': 'vitest' },
  })
}

describe('admin login lockout', () => {
  beforeEach(() => {
    resetAdminLoginLockoutStoreForTests()
    sendSuspiciousLoginAlert.mockReset()
    sendSuspiciousLoginAlert.mockResolvedValue({ ok: true })
  })

  it('locks after 5 failures and emails once', async () => {
    for (let i = 0; i < ADMIN_LOCK_MAX_FAILURES - 1; i++) {
      const step = await recordAdminLoginFailure(req())
      expect(step.locked).toBe(false)
    }
    const locked = await recordAdminLoginFailure(req())
    expect(locked.locked).toBe(true)
    expect(locked.justLocked).toBe(true)
    expect(sendSuspiciousLoginAlert).toHaveBeenCalledTimes(1)

    const again = await recordAdminLoginFailure(req())
    expect(again.locked).toBe(true)
    expect(again.justLocked).toBe(false)
    expect(sendSuspiciousLoginAlert).toHaveBeenCalledTimes(1)
  })

  it('clears lockout after a successful login', async () => {
    for (let i = 0; i < ADMIN_LOCK_MAX_FAILURES; i++) {
      await recordAdminLoginFailure(req())
    }
    expect((await getAdminLoginLockout(req())).locked).toBe(true)
    await clearAdminLoginLockout(req())
    expect((await getAdminLoginLockout(req())).locked).toBe(false)
  })
})
