import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const isDbConfigured = vi.fn()
const loggerInfo = vi.fn()
const loggerError = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminAction: {
      create: (...args: unknown[]) => create(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: (...args: unknown[]) => loggerInfo(...args), error: (...args: unknown[]) => loggerError(...args) },
}))

describe('logAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    create.mockResolvedValue({ id: '1' })
  })

  it('stores ip, user-agent and JSON details', async () => {
    const { logAdminAction } = await import('./admin-audit')
    const request = new Request('http://localhost/api/admin/login', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'Vitest',
      },
    })
    await logAdminAction({
      action: 'login',
      success: false,
      request,
      details: { reason: 'invalid_key' },
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        action: 'login',
        orderId: null,
        success: false,
        details: JSON.stringify({ reason: 'invalid_key' }),
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
      },
    })
  })

  it('logs to logger when DB is not configured', async () => {
    isDbConfigured.mockReturnValue(false)
    const { logAdminAction } = await import('./admin-audit')
    await logAdminAction({ action: 'product_create', success: true, details: { id: 'p1' } })
    expect(create).not.toHaveBeenCalled()
    expect(loggerInfo).toHaveBeenCalled()
  })
})
