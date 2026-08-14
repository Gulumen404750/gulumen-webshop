import { beforeEach, describe, expect, it, vi } from 'vitest'

const rateLimit = vi.fn()
const logAdminAction = vi.fn()
const issueAdminPasswordResetEmail = vi.fn()

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/admin-password-reset', () => ({
  ADMIN_PASSWORD_RESET_GENERIC_MESSAGE:
    'Ha a visszaállítás elérhető, elküldtük a linket az admin e-mail címre.',
  issueAdminPasswordResetEmail: () => issueAdminPasswordResetEmail(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('POST /api/admin/reset/request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ ok: true })
    logAdminAction.mockResolvedValue(undefined)
    issueAdminPasswordResetEmail.mockResolvedValue({ issued: true })
  })

  it('always returns the same generic success payload', async () => {
    const { POST } = await import('@/app/api/admin/reset/request/route')
    const sent = await POST(
      new Request('http://localhost/api/admin/reset/request', { method: 'POST' })
    )
    expect(sent.status).toBe(200)
    expect(await sent.json()).toEqual({
      ok: true,
      message: 'Ha a visszaállítás elérhető, elküldtük a linket az admin e-mail címre.',
    })

    issueAdminPasswordResetEmail.mockResolvedValue({ issued: false, reason: 'no_2fa' })
    const skipped = await POST(
      new Request('http://localhost/api/admin/reset/request', { method: 'POST' })
    )
    expect(skipped.status).toBe(200)
    expect(await skipped.json()).toEqual({
      ok: true,
      message: 'Ha a visszaállítás elérhető, elküldtük a linket az admin e-mail címre.',
    })
  })

  it('rate-limits the mailbox without changing the generic wording on other errors', async () => {
    rateLimit.mockResolvedValue({ ok: false, status: 429 })
    const { POST } = await import('@/app/api/admin/reset/request/route')
    const res = await POST(
      new Request('http://localhost/api/admin/reset/request', { method: 'POST' })
    )
    expect(res.status).toBe(429)
    expect(issueAdminPasswordResetEmail).not.toHaveBeenCalled()
    expect(rateLimit).toHaveBeenCalledWith(expect.anything(), { preset: 'adminResetRequest' })
  })
})
