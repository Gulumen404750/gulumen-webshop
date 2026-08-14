import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const findDevice = vi.fn()
const findCountry = vi.fn()
const countDevice = vi.fn()
const countCountry = vi.fn()
const upsertDevice = vi.fn()
const upsertCountry = vi.fn()
const isDbConfigured = vi.fn()
const sendMailRequired = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminLoginDevice: {
      findUnique: (...args: unknown[]) => findDevice(...args),
      count: () => countDevice(),
      upsert: (...args: unknown[]) => upsertDevice(...args),
    },
    adminLoginCountry: {
      findUnique: (...args: unknown[]) => findCountry(...args),
      count: () => countCountry(),
      upsert: (...args: unknown[]) => upsertCountry(...args),
    },
  },
}))

vi.mock('@/lib/mail', () => ({
  sendMailRequired: (...args: unknown[]) => sendMailRequired(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

function loginRequest(headers: Record<string, string>) {
  return new Request('http://localhost/api/admin/login', { headers })
}

describe('recordAdminLoginFingerprint', () => {
  const originalEmail = process.env.ADMIN_EMAIL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAIL = 'admin@gulumen.com'
    isDbConfigured.mockReturnValue(true)
    findDevice.mockResolvedValue(null)
    findCountry.mockResolvedValue(null)
    countDevice.mockResolvedValue(0)
    countCountry.mockResolvedValue(0)
    upsertDevice.mockResolvedValue({})
    upsertCountry.mockResolvedValue({})
    sendMailRequired.mockResolvedValue({ ok: true })
    logAdminAction.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalEmail
  })

  it('records the first login without sending an alert', async () => {
    const { recordAdminLoginFingerprint } = await import('./admin-login-alert')
    const result = await recordAdminLoginFingerprint(
      loginRequest({
        'user-agent': 'Chrome',
        'cf-ipcountry': 'HU',
        'x-forwarded-for': '203.0.113.10',
      })
    )
    expect(result).toMatchObject({
      newDevice: false,
      unusualCountry: false,
      alerted: false,
      countryCode: 'HU',
    })
    expect(upsertDevice).toHaveBeenCalled()
    expect(upsertCountry).toHaveBeenCalled()
    expect(sendMailRequired).not.toHaveBeenCalled()
    expect(logAdminAction).not.toHaveBeenCalled()
  })

  it('emails ADMIN_EMAIL on a new device after a baseline exists', async () => {
    countDevice.mockResolvedValue(1)
    countCountry.mockResolvedValue(1)
    findCountry.mockResolvedValue({ countryCode: 'HU' })
    const { recordAdminLoginFingerprint } = await import('./admin-login-alert')
    const result = await recordAdminLoginFingerprint(
      loginRequest({
        'user-agent': 'Firefox',
        'cf-ipcountry': 'HU',
      })
    )
    expect(result.newDevice).toBe(true)
    expect(result.unusualCountry).toBe(false)
    expect(result.alerted).toBe(true)
    expect(sendMailRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@gulumen.com',
        subject: expect.stringContaining('új eszköz'),
      })
    )
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login_fingerprint_alert',
        details: expect.objectContaining({ newDevice: true, alerted: true }),
      })
    )
  })

  it('emails on an unusual country without treating a missing geo header as unusual', async () => {
    countDevice.mockResolvedValue(1)
    countCountry.mockResolvedValue(1)
    findDevice.mockResolvedValue({ id: 'dev1' })
    const { recordAdminLoginFingerprint } = await import('./admin-login-alert')

    const unusual = await recordAdminLoginFingerprint(
      loginRequest({
        'user-agent': 'Chrome',
        'cf-ipcountry': 'RU',
      })
    )
    expect(unusual.unusualCountry).toBe(true)
    expect(unusual.newDevice).toBe(false)
    expect(sendMailRequired).toHaveBeenCalled()

    sendMailRequired.mockClear()
    logAdminAction.mockClear()
    const missingGeo = await recordAdminLoginFingerprint(
      loginRequest({ 'user-agent': 'Chrome' })
    )
    expect(missingGeo.unusualCountry).toBe(false)
    expect(missingGeo.newDevice).toBe(false)
    expect(sendMailRequired).not.toHaveBeenCalled()
  })
})
