import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_ALLOWED_IPS: process.env.ADMIN_ALLOWED_IPS,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
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
  })

  it('allows /admin/login in production when ADMIN_ALLOWED_IPS is empty', async () => {
    setEnv('NODE_ENV', 'production')
    setEnv('ADMIN_ALLOWED_IPS', undefined)
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://www.gulumen.com/admin/login', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
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
})
