import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.fn()
const logAdminAction = vi.fn()
const getAdminAlertEmail = vi.fn()

vi.mock('@/lib/mail', () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
}))

vi.mock('@/lib/admin-audit', () => ({
  logAdminAction: (...args: unknown[]) => logAdminAction(...args),
}))

vi.mock('@/lib/login-alert-email', () => ({
  getAdminAlertEmail: () => getAdminAlertEmail(),
}))

describe('alertPendingApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminAlertEmail.mockReturnValue('admin@gulumen.com')
    sendMail.mockResolvedValue({ ok: true })
    logAdminAction.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('emails ADMIN_EMAIL on pending bulk mutation', async () => {
    const { alertPendingApproval, buildPendingApprovalAlertEmail } = await import(
      './admin-approval-alert'
    )
    const params = {
      approvalId: 'ap1',
      kind: 'bulk_delete' as const,
      resource: 'products',
      count: 15,
      expiresAt: new Date(Date.now() + 300_000),
      actor: { id: 'c1', username: 'bela', role: 'catalog' as const },
    }
    const mail = buildPendingApprovalAlertEmail(params)
    expect(mail.subject).toContain('tömeges törlés')
    expect(mail.text).toContain('NEM futott le')
    expect(mail.html).toContain('PENDING_APPROVAL')

    const result = await alertPendingApproval(params)
    expect(result.emailed).toBe(true)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@gulumen.com',
        subject: expect.stringContaining('tömeges törlés'),
      })
    )
  })

  it('audits without emailing when ADMIN_EMAIL is missing', async () => {
    getAdminAlertEmail.mockReturnValue(null)
    const { alertPendingApproval } = await import('./admin-approval-alert')
    const result = await alertPendingApproval({
      approvalId: 'ap2',
      kind: 'bulk_price',
      resource: 'products',
      count: 12,
      expiresAt: new Date(),
      actor: { id: 'c1', username: 'bela', role: 'catalog' },
    })
    expect(result.alerted).toBe(true)
    expect(result.emailed).toBe(false)
    expect(sendMail).not.toHaveBeenCalled()
    expect(logAdminAction).toHaveBeenCalled()
  })
})
