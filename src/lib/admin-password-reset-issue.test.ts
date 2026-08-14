import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const upsertAdmin = vi.fn()
const updateManyAdmin = vi.fn()
const isDbConfigured = vi.fn()
const getAdminTwoFactorState = vi.fn()
const sendMailRequired = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    admin: {
      upsert: (...args: unknown[]) => upsertAdmin(...args),
      updateMany: (...args: unknown[]) => updateManyAdmin(...args),
    },
  },
}))

vi.mock('@/lib/admin-2fa', () => ({
  getAdminTwoFactorState: () => getAdminTwoFactorState(),
}))

vi.mock('@/lib/mail', () => ({
  sendMailRequired: (...args: unknown[]) => sendMailRequired(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('issueAdminPasswordResetEmail', () => {
  const originalEmail = process.env.ADMIN_EMAIL
  const originalKey = process.env.ADMIN_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAIL = 'admin@gulumen.com'
    process.env.ADMIN_API_KEY = 'super-secret-admin-key-do-not-email'
    isDbConfigured.mockReturnValue(true)
    getAdminTwoFactorState.mockResolvedValue({
      isTwoFactorEnabled: true,
      totpSecret: 'SECRET',
    })
    sendMailRequired.mockResolvedValue({ ok: true })
    upsertAdmin.mockResolvedValue({})
    updateManyAdmin.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    if (originalEmail === undefined) delete process.env.ADMIN_EMAIL
    else process.env.ADMIN_EMAIL = originalEmail
    if (originalKey === undefined) delete process.env.ADMIN_API_KEY
    else process.env.ADMIN_API_KEY = originalKey
  })

  it('emails a reset link without the raw ADMIN_API_KEY when 2FA is on', async () => {
    const { issueAdminPasswordResetEmail } = await import('./admin-password-reset')
    const result = await issueAdminPasswordResetEmail()
    expect(result).toEqual({ issued: true })
    expect(upsertAdmin).toHaveBeenCalled()
    expect(sendMailRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@gulumen.com',
        subject: '[Gulumen] Admin jelszó visszaállítása',
      })
    )
    const mail = sendMailRequired.mock.calls[0]?.[0] as { html: string; text: string }
    expect(mail.html).not.toContain('super-secret-admin-key-do-not-email')
    expect(mail.text).not.toContain('super-secret-admin-key-do-not-email')
    expect(mail.html).toMatch(/reset\?token=/)
    const stored = upsertAdmin.mock.calls[0]?.[0] as {
      create: { passwordResetTokenHash: string }
    }
    expect(stored.create.passwordResetTokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(mail.html).not.toContain(stored.create.passwordResetTokenHash)
  })

  it('does not send when 2FA is off', async () => {
    getAdminTwoFactorState.mockResolvedValue({ isTwoFactorEnabled: false, totpSecret: null })
    const { issueAdminPasswordResetEmail } = await import('./admin-password-reset')
    const result = await issueAdminPasswordResetEmail()
    expect(result).toEqual({ issued: false, reason: 'no_2fa' })
    expect(sendMailRequired).not.toHaveBeenCalled()
    expect(upsertAdmin).not.toHaveBeenCalled()
  })

  it('does not send when ADMIN_EMAIL is missing', async () => {
    delete process.env.ADMIN_EMAIL
    const { issueAdminPasswordResetEmail } = await import('./admin-password-reset')
    const result = await issueAdminPasswordResetEmail()
    expect(result).toEqual({ issued: false, reason: 'unconfigured' })
    expect(sendMailRequired).not.toHaveBeenCalled()
  })
})
