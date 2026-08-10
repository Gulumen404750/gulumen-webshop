import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

describe('mail helper', () => {
  const prev = {
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    resendFrom: process.env.RESEND_FROM,
  }

  beforeEach(() => {
    sendMock.mockReset()
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.RESEND_FROM
    vi.resetModules()
  })

  afterEach(() => {
    if (prev.key === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = prev.key
    if (prev.from === undefined) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = prev.from
    if (prev.resendFrom === undefined) delete process.env.RESEND_FROM
    else process.env.RESEND_FROM = prev.resendFrom
  })

  it('uses noreply@gulumen.com by default', async () => {
    const { DEFAULT_FROM_EMAIL, getMailFromAddress } = await import('./mail')
    expect(DEFAULT_FROM_EMAIL).toBe('Gulumen <noreply@gulumen.com>')
    expect(getMailFromAddress()).toBe('Gulumen <noreply@gulumen.com>')
  })

  it('skips send when RESEND_API_KEY missing (soft mode)', async () => {
    const { sendMail } = await import('./mail')
    const result = await sendMail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.skipped).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sendMailRequired fails without API key', async () => {
    const { sendMailRequired } = await import('./mail')
    const result = await sendMailRequired({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    })
    expect(result.ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends via Resend SDK with default from address', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    sendMock.mockResolvedValueOnce({ data: { id: 'email_123' }, error: null })

    const { sendMail, DEFAULT_FROM_EMAIL } = await import('./mail')
    const result = await sendMail({
      to: 'buyer@example.com',
      subject: 'Rendelés',
      html: '<p>OK</p>',
      text: 'OK',
    })

    expect(result).toEqual({ ok: true, id: 'email_123' })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: DEFAULT_FROM_EMAIL,
        to: ['buyer@example.com'],
        subject: 'Rendelés',
      })
    )
  })
})
