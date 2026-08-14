import { describe, expect, it } from 'vitest'
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from './admin-csrf-constants'
import { evaluateAdminCsrf, generateCsrfToken, timingSafeEqualStr } from './admin-csrf'

function adminRequest(init: {
  method?: string
  path?: string
  origin?: string
  cookie?: string
  csrfHeader?: string
  adminKey?: string
}): Request {
  const headers = new Headers()
  headers.set('host', 'www.gulumen.com')
  if (init.origin) headers.set('origin', init.origin)
  if (init.cookie) headers.set('cookie', init.cookie)
  if (init.csrfHeader) headers.set(ADMIN_CSRF_HEADER, init.csrfHeader)
  if (init.adminKey) headers.set('x-admin-key', init.adminKey)
  return new Request(`https://www.gulumen.com${init.path ?? '/api/admin/products'}`, {
    method: init.method ?? 'POST',
    headers,
  })
}

describe('timingSafeEqualStr', () => {
  it('compares equal tokens', () => {
    expect(timingSafeEqualStr('abc123', 'abc123')).toBe(true)
    expect(timingSafeEqualStr('abc123', 'abc124')).toBe(false)
    expect(timingSafeEqualStr('', 'x')).toBe(false)
  })
})

describe('evaluateAdminCsrf', () => {
  it('skips GET requests', () => {
    const req = adminRequest({ method: 'GET' })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: true, reason: 'not_mutating' })
  })

  it('skips login POST after origin check', () => {
    const req = adminRequest({
      path: '/api/admin/login',
      origin: 'https://www.gulumen.com',
    })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: true, reason: 'login' })
  })

  it('skips 2FA verify-login POST after origin check', () => {
    const req = adminRequest({
      path: '/api/admin/2fa/verify-login',
      origin: 'https://www.gulumen.com',
    })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: true, reason: 'login' })
  })

  it('rejects cross-origin mutating requests', () => {
    const req = adminRequest({ origin: 'https://evil.example' })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: false, reason: 'bad_origin' })
  })

  it('accepts matching double-submit token', () => {
    const token = generateCsrfToken()
    const req = adminRequest({
      origin: 'https://www.gulumen.com',
      cookie: `${ADMIN_CSRF_COOKIE}=${token}`,
      csrfHeader: token,
    })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: true, reason: 'valid' })
  })

  it('rejects missing or mismatched tokens', () => {
    const token = generateCsrfToken()
    expect(
      evaluateAdminCsrf(
        adminRequest({
          origin: 'https://www.gulumen.com',
          cookie: `${ADMIN_CSRF_COOKIE}=${token}`,
        })
      )
    ).toEqual({ ok: false, reason: 'missing_token' })

    expect(
      evaluateAdminCsrf(
        adminRequest({
          origin: 'https://www.gulumen.com',
          cookie: `${ADMIN_CSRF_COOKIE}=${token}`,
          csrfHeader: '0'.repeat(token.length),
        })
      )
    ).toEqual({ ok: false, reason: 'mismatch' })
  })

  it('skips CSRF when x-admin-key is present', () => {
    const req = adminRequest({ adminKey: 'machine-key' })
    expect(evaluateAdminCsrf(req)).toEqual({ ok: true, reason: 'api_key' })
  })
})
