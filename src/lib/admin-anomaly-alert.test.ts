import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
const isDbConfigured = vi.fn()
const sendMail = vi.fn()
const logAdminAction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminAction: {
      count: (...args: unknown[]) => count(...args),
    },
  },
}))

vi.mock('@/lib/mail', () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('alertAdminAnomaly', () => {
  const originalEmail = process.env.ADMIN_EMAIL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_EMAIL = 'admin@gulumen.com'
    delete process.env.ADMIN_ANOMALY_CSV_MIN
    delete process.env.ADMIN_ANOMALY_BULK_PRICE_MIN
    delete process.env.ADMIN_ANOMALY_DELETE_MIN
    isDbConfigured.mockReturnValue(true)
    sendMail.mockResolvedValue({ ok: true })
    logAdminAction.mockResolvedValue(undefined)
    count.mockResolvedValue(5)
  })

  afterEach(() => {
    if (originalEmail === undefined) delete process.env.ADMIN_EMAIL
    else process.env.ADMIN_EMAIL = originalEmail
  })

  it('does not email a small CSV export', async () => {
    const { alertAdminAnomaly } = await import('./admin-anomaly-alert')
    const result = await alertAdminAnomaly({
      kind: 'csv_export',
      count: 12,
      request: new Request('http://localhost/api/admin/orders/export?format=csv'),
    })
    expect(result.alerted).toBe(false)
    expect(sendMail).not.toHaveBeenCalled()
    expect(logAdminAction).not.toHaveBeenCalled()
  })

  it('emails ADMIN_EMAIL on a large CSV export', async () => {
    const { alertAdminAnomaly } = await import('./admin-anomaly-alert')
    const result = await alertAdminAnomaly({
      kind: 'csv_export',
      count: 150,
      request: new Request('http://localhost/api/admin/orders/export?format=csv', {
        headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'Vitest' },
      }),
      details: { filename: 'rendelesek-2026-08-14.csv' },
    })
    expect(result.alerted).toBe(true)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@gulumen.com',
        subject: expect.stringContaining('nagy CSV-export'),
      })
    )
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'anomaly_alert',
        details: expect.objectContaining({ kind: 'csv_export', count: 150, emailed: true }),
      })
    )
  })

  it('audits without emailing when ADMIN_EMAIL is missing', async () => {
    delete process.env.ADMIN_EMAIL
    const { alertAdminAnomaly } = await import('./admin-anomaly-alert')
    const result = await alertAdminAnomaly({
      kind: 'csv_export',
      count: 150,
    })
    expect(result.alerted).toBe(true)
    expect(sendMail).not.toHaveBeenCalled()
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'anomaly_alert',
        details: expect.objectContaining({ emailed: false }),
      })
    )
  })

  it('audits without treating skipped Resend as emailed', async () => {
    sendMail.mockResolvedValue({ ok: true, skipped: true })
    const { alertAdminAnomaly } = await import('./admin-anomaly-alert')
    const result = await alertAdminAnomaly({
      kind: 'bulk_price',
      count: 10,
    })
    expect(result.alerted).toBe(true)
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ emailed: false }),
      })
    )
  })

  it('emails on bulk price at the threshold', async () => {
    const { alertAdminAnomaly } = await import('./admin-anomaly-alert')
    const result = await alertAdminAnomaly({
      kind: 'bulk_price',
      count: 10,
      details: { mode: 'percent', percentChange: -50 },
    })
    expect(result.alerted).toBe(true)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('tömeges árváltoztatás') })
    )
  })

  it('emails once when bulk deletes first cross the window threshold', async () => {
    const { alertBulkDeleteIfAnomalousSafe } = await import('./admin-anomaly-alert')
    const request = new Request('http://localhost/api/admin/products/p1', { method: 'DELETE' })

    await alertBulkDeleteIfAnomalousSafe(request)
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { in: ['product_delete', 'user_delete', 'coupon_delete'] },
          success: true,
        }),
      })
    )

    sendMail.mockClear()
    logAdminAction.mockClear()
    count.mockResolvedValue(6)
    await alertBulkDeleteIfAnomalousSafe(request)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('never throws from the safe wrapper', async () => {
    logAdminAction.mockRejectedValue(new Error('audit down'))
    const { alertAdminAnomalySafe } = await import('./admin-anomaly-alert')
    await expect(
      alertAdminAnomalySafe({ kind: 'csv_export', count: 200 })
    ).resolves.toBeUndefined()
  })
})
