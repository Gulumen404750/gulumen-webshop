import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisMock = vi.hoisted(() => ({
  isRedisConfigured: vi.fn(() => false),
  getRedis: vi.fn(() => null),
}))

vi.mock('@/lib/redis', () => redisMock)

import { rateLimit } from './rate-limit'

function makeRequest(ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/test', {
    headers: { 'x-forwarded-for': ip },
  })
}

describe('rateLimit memory fallback (no Upstash)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redisMock.isRedisConfigured.mockReturnValue(false)
    redisMock.getRedis.mockReturnValue(null)
  })

  it('allows requests under the limit without Redis', async () => {
    const req = makeRequest('10.0.0.1')
    for (let i = 0; i < 5; i++) {
      const result = await rateLimit(req, { maxPerWindow: 5, windowMs: 60_000 })
      expect(result.ok).toBe(true)
    }
  })

  it('returns 429 after max without throwing when Redis is absent', async () => {
    const req = makeRequest('10.0.0.2')
    for (let i = 0; i < 3; i++) {
      await rateLimit(req, { maxPerWindow: 3, windowMs: 60_000 })
    }
    const blocked = await rateLimit(req, { maxPerWindow: 3, windowMs: 60_000 })
    expect(blocked).toEqual({ ok: false, status: 429 })
  })

  it('falls back to memory when Redis is configured but client is null', async () => {
    redisMock.isRedisConfigured.mockReturnValue(true)
    redisMock.getRedis.mockReturnValue(null)
    const req = makeRequest('10.0.0.3')
    const result = await rateLimit(req, { maxPerWindow: 2, windowMs: 60_000 })
    expect(result.ok).toBe(true)
  })
})
