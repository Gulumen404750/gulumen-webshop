import { afterEach, describe, expect, it, vi } from 'vitest'

describe('redis env fallback', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
    vi.resetModules()
  })

  it('isRedisConfigured is false when env vars are missing/blank', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.resetModules()
    const { isRedisConfigured, getRedis, resetRedisClientForTests } = await import('./redis')
    resetRedisClientForTests()
    expect(isRedisConfigured()).toBe(false)
    expect(getRedis()).toBeNull()
  })

  it('isRedisConfigured is false when only URL is set', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.resetModules()
    const { isRedisConfigured, getRedis, resetRedisClientForTests } = await import('./redis')
    resetRedisClientForTests()
    expect(isRedisConfigured()).toBe(false)
    expect(getRedis()).toBeNull()
  })

  it('treats whitespace-only env as unconfigured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = '   '
    process.env.UPSTASH_REDIS_REST_TOKEN = '   '
    vi.resetModules()
    const { isRedisConfigured, getRedis, resetRedisClientForTests } = await import('./redis')
    resetRedisClientForTests()
    expect(isRedisConfigured()).toBe(false)
    expect(getRedis()).toBeNull()
  })
})
