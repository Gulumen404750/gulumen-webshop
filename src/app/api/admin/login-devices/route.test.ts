import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()
const isDbConfigured = vi.fn()
const findDevices = vi.fn()
const findCountries = vi.fn()

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: () => requireAdmin(),
}))

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminLoginDevice: { findMany: (...args: unknown[]) => findDevices(...args) },
    adminLoginCountry: { findMany: (...args: unknown[]) => findCountries(...args) },
  },
}))

describe('GET /api/admin/login-devices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue(true)
    isDbConfigured.mockReturnValue(true)
    findDevices.mockResolvedValue([
      {
        id: 'd1',
        fingerprint: 'abcdef0123456789deadbeef',
        userAgent: 'Chrome',
        lastCountry: 'HU',
        lastIp: '203.0.113.10',
        loginCount: 3,
        firstSeenAt: new Date('2026-08-01T00:00:00Z'),
        lastSeenAt: new Date('2026-08-14T00:00:00Z'),
      },
    ])
    findCountries.mockResolvedValue([
      {
        countryCode: 'HU',
        loginCount: 3,
        firstSeenAt: new Date('2026-08-01T00:00:00Z'),
        lastSeenAt: new Date('2026-08-14T00:00:00Z'),
      },
    ])
  })

  it('returns truncated fingerprints for an admin session', async () => {
    const { GET } = await import('@/app/api/admin/login-devices/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.devices[0].fingerprintPrefix).toBe('abcdef01')
    expect(data.devices[0].fingerprint).toBeUndefined()
    expect(data.countries[0].countryCode).toBe('HU')
  })

  it('returns 401 when not admin', async () => {
    requireAdmin.mockResolvedValue(false)
    const { GET } = await import('@/app/api/admin/login-devices/route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(findDevices).not.toHaveBeenCalled()
  })
})
