import { describe, expect, it, afterEach } from 'vitest'
import {
  DEFAULT_SUPPORT_INBOX,
  getPublicSupportEmail,
  getSupportInboxEmail,
  isUnreliableInboundDomain,
  buildOrderChangeContactUrl,
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

  it('skips gulumen.com postmaster (no MX) and uses ADMIN_EMAIL Gmail', () => {
    process.env.ORDER_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    process.env.ADMIN_EMAIL = 'ops@gmail.com'
    expect(isUnreliableInboundDomain('postmaster@gulumen.com')).toBe(true)
    expect(getSupportInboxEmail()).toBe('ops@gmail.com')
  })

  it('uses ORDER_SUPPORT_EMAIL when it is a real inbox', () => {
    process.env.ORDER_SUPPORT_EMAIL = 'shop@gmail.com'
    process.env.ADMIN_EMAIL = 'ops@gmail.com'
    expect(getSupportInboxEmail()).toBe('shop@gmail.com')
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

  it('defaults when nothing reliable is set', () => {
    delete process.env.ORDER_SUPPORT_EMAIL
    delete process.env.SUPPORT_INBOX_EMAIL
    delete process.env.ADMIN_EMAIL
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL
    delete process.env.NEXT_PUBLIC_LEGAL_EMAIL
    expect(getSupportInboxEmail()).toBe(DEFAULT_SUPPORT_INBOX)
  })
})
