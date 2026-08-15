import { describe, expect, it, afterEach } from 'vitest'
import {
  DEFAULT_SUPPORT_INBOX,
  getPublicSupportEmail,
  getSupportInboxEmail,
  isUnreliableInboundDomain,
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

  it('defaults to postmaster@gulumen.com', () => {
    delete process.env.ORDER_SUPPORT_EMAIL
    delete process.env.SUPPORT_INBOX_EMAIL
    delete process.env.ADMIN_EMAIL
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL
    delete process.env.NEXT_PUBLIC_LEGAL_EMAIL
    expect(getSupportInboxEmail()).toBe(DEFAULT_SUPPORT_INBOX)
    expect(getPublicSupportEmail()).toBe('postmaster@gulumen.com')
  })

  it('prefers ORDER_SUPPORT_EMAIL when set', () => {
    process.env.ORDER_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    process.env.ADMIN_EMAIL = 'ops@gmail.com'
    expect(getSupportInboxEmail()).toBe('postmaster@gulumen.com')
  })

  it('falls back to ADMIN_EMAIL before default', () => {
    delete process.env.ORDER_SUPPORT_EMAIL
    delete process.env.SUPPORT_INBOX_EMAIL
    delete process.env.NEXT_PUBLIC_SUPPORT_EMAIL
    delete process.env.NEXT_PUBLIC_LEGAL_EMAIL
    process.env.ADMIN_EMAIL = 'ops@gmail.com'
    expect(getSupportInboxEmail()).toBe('ops@gmail.com')
  })

  it('keeps public mailto separate from ADMIN_EMAIL when public env set', () => {
    process.env.ADMIN_EMAIL = 'secret-ops@gmail.com'
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'postmaster@gulumen.com'
    expect(getPublicSupportEmail()).toBe('postmaster@gulumen.com')
  })

  it('flags legacy info/noreply addresses as unreliable inbound', () => {
    expect(isUnreliableInboundDomain('info@gulumen.hu')).toBe(true)
    expect(isUnreliableInboundDomain('info@gulumen.com')).toBe(true)
    expect(isUnreliableInboundDomain('noreply@gulumen.com')).toBe(true)
    expect(isUnreliableInboundDomain('postmaster@gulumen.com')).toBe(false)
  })
})
