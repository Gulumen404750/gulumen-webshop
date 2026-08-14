import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_ALLOWED_IPS: process.env.ADMIN_ALLOWED_IPS,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  ADMIN_URL_SLUG: process.env.ADMIN_URL_SLUG,
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

describe('admin middleware IP + CSRF', () => {
  afterEach(() => {
    setEnv('NODE_ENV', ORIGINAL_ENV.NODE_ENV)
    setEnv('ADMIN_ALLOWED_IPS', ORIGINAL_ENV.ADMIN_ALLOWED_IPS)
    setEnv('JWT_SECRET', ORIGINAL_ENV.JWT_SECRET)
    setEnv('ADMIN_API_KEY', ORIGINAL_ENV.ADMIN_API_KEY)
    setEnv('ADMIN_URL_SLUG', ORIGINAL_ENV.ADMIN_URL_SLUG)
  })

  it('blocks /admin/login in production when ADMIN_ALLOWED_IPS is empty', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/admin/login', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('blocks /api/admin/login in production when ADMIN_ALLOWED_IPS is empty', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/api/admin/login', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.10',
        origin: 'https://www.gulumen.com',
        host: 'www.gulumen.com',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('blocks the hidden admin slug in production when ADMIN_ALLOWED_IPS is empty', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    setEnv('ADMIN_URL_SLUG', 'desk-a1b2c3d4')
    const { middleware } = await import('@/middleware')
    const ui = await middleware(
      new NextRequest('https://www.gulumen.com/desk-a1b2c3d4/login', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )
    expect(ui.status).toBe(403)
    const api = await middleware(
      new NextRequest('https://www.gulumen.com/api/desk-a1b2c3d4/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.10',
          origin: 'https://www.gulumen.com',
          host: 'www.gulumen.com',
        },
      })
    )
    expect(api.status).toBe(403)
  })

  it('blocks /api/admin/login from an IP outside the allowlist', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', '203.0.113.10')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/api/admin/login', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '198.51.100.1',
        origin: 'https://www.gulumen.com',
        host: 'www.gulumen.com',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('allows /admin/login from a listed IP in production', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', '203.0.113.10,10.0.0.0/8')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/admin/login', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('allows the hidden slug login from a listed IP in production', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', '203.0.113.10')
    setEnv('ADMIN_URL_SLUG', 'desk-a1b2c3d4')
    const { middleware } = await import('@/middleware')
    const res = await middleware(
      new NextRequest('https://www.gulumen.com/desk-a1b2c3d4/login', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      })
    )
    expect(res.status).not.toBe(403)
  })

  it('allows /admin/login in development when ADMIN_ALLOWED_IPS is empty', async () => {
    setEnv('NODE_ENV', 'development')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/admin/login', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('allows /admin/reset POST after origin check without CSRF token', async () => {
    setEnv('NODE_ENV', 'test')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/api/admin/reset/request', {
      method: 'POST',
      headers: {
        origin: 'https://www.gulumen.com',
        host: 'www.gulumen.com',
      },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('returns 403 when CSRF token is missing on admin POST', async () => {
    setEnv('NODE_ENV', 'test')
    setEnv('ADMIN_ALLOWED_IPS', '203.0.113.10')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/api/admin/products', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.10',
        origin: 'https://www.gulumen.com',
        host: 'www.gulumen.com',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('redirects HTTP to HTTPS in production when x-forwarded-proto is http', async () => {
    setEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://www.gulumen.com/termekek', {
      headers: { 'x-forwarded-proto': 'http', host: 'www.gulumen.com' },
    })
    const res = await middleware(req)
    expect(res.status).toBe(308)
    expect(res.headers.get('location') || '').toContain('https://')
  })

  it('does not HTTPS-redirect Railway healthchecks (no x-forwarded-proto)', async () => {
    setEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://0.0.0.0:8080/api/health/live', {
      headers: { host: '0.0.0.0:8080' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(308)
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not HTTPS-redirect health paths even with x-forwarded-proto http', async () => {
    setEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://www.gulumen.com/api/health/live', {
      headers: { 'x-forwarded-proto': 'http', host: 'www.gulumen.com' },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(308)
  })

  it('sets production CSP without unsafe-inline or unsafe-eval', async () => {
    setEnv('NODE_ENV', 'production')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const res = await middleware(req)
    const csp = res.headers.get('Content-Security-Policy') || ''
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? ''
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(csp).toContain('https://www.google.com')
    expect(csp).toContain('https://www.gstatic.com')
    expect(csp).toContain('https://www.recaptcha.net')
  })

  it('redirects unauthenticated admin UI with a relative from path (no open redirect)', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', '203.0.113.10')
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/admin/dashboard', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const res = await middleware(req)
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') || ''
    const url = new URL(location, 'https://www.gulumen.com')
    expect(url.pathname).toBe('/admin/login')
    const from = url.searchParams.get('from')
    expect(from).toBe('/admin/dashboard')
    expect(from?.startsWith('/')).toBe(true)
    expect(from?.startsWith('//')).toBe(false)
    expect(from).not.toMatch(/^https?:/i)
  })
})
