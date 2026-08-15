import { describe, expect, it, afterEach } from 'vitest'
import {
  DEFAULT_SUPPORT_INBOX,
  getPublicSupportEmail,
  getSupportInboxEmail,
  getAdminNotificationEmails,
  isUnreliableInboundDomain,
  isBlockedAdminNotifyEmail,
  buildOrderChangeContactUrl,
  buildOrderShippingEditUrl,
} from './support-email'

describe('support-email', () => {
  const prev = {
    order: process.env.ORDER_SUPPORT_EMAIL,
    support: process.env.SUPPORT_INBOX_EMAIL,
    admin: process.env.ADMIN_EMAIL,
    pub: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    legal: process.env.NEXT_PUBLIC_LEGAL_EMAIL,
  }

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore('ORDER_SUPPORT_EMAIL', prev.order)
    restore('SUPPORT_INBOX_EMAIL', prev.support)
    restore('ADMIN_EMAIL', prev.admin)
    restore('NEXT_PUBLIC_SUPPORT_EMAIL', prev.pub)
    restore('NEXT_PUBLIC_LEGAL_EMAIL', prev.legal)
  })

  it('blocks 1.dani@gmail.com from admin notify list', () => {
    expect(isBlockedAdminNotifyEmail('1.dani@gmail.com')).toBe(true)
    process.env.ADMIN_EMAIL = '1.dani@gmail.com'
    expect(getAdminNotificationEmails()).toEqual([DEFAULT_SUPPORT_INBOX])
    expect(getAdminNotificationEmails()).not.toContain('1.dani@gmail.com')
  })

  it('admin notifications are postmaster only (no ADMIN_EMAIL)', () => {
    process.env.ORDER_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    process.env.ADMIN_EMAIL = 'ops@gmail.com'
    expect(getAdminNotificationEmails()).toEqual(['postmaster@gulumen.com'])
  })

  it('prefers postmaster for support inbox', () => {
    process.env.ORDER_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    process.env.ADMIN_EMAIL = '1.dani@gmail.com'
    expect(getSupportInboxEmail()).toBe('postmaster@gulumen.com')
  })

  it('public mailto can still show postmaster for branding', () => {
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    expect(getPublicSupportEmail()).toBe('postmaster@gulumen.com')
  })

  it('builds contact URL with order ref', () => {
    expect(buildOrderChangeContactUrl('https://www.gulumen.com/kapcsolat', 'ord_1')).toBe(
      'https://www.gulumen.com/kapcsolat?rendeles=ord_1&tipus=modositas'
    )
  })

  it('builds tokenized self-service shipping edit URL', () => {
    expect(
      buildOrderShippingEditUrl('ord_abc', {
        appUrl: 'https://www.gulumen.com',
        token: 'tok_secret',
      })
    ).toBe('https://www.gulumen.com/rendelesek/ord_abc/modositas?t=tok_secret')
  })

  it('marks gulumen.com as unreliable inbound domain', () => {
    expect(isUnreliableInboundDomain('postmaster@gulumen.com')).toBe(true)
  })
})
