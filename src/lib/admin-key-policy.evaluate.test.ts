import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const isDbConfigured = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    admin: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('evaluateAdminKeyPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
  })

  it('fail-opens when the database is not configured', async () => {
    isDbConfigured.mockReturnValue(false)
    const { evaluateAdminKeyPolicy } = await import('./admin-key-policy')
    await expect(evaluateAdminKeyPolicy('current-key')).resolves.toEqual({
      ok: true,
      rotated: false,
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('fail-opens when the query throws', async () => {
    findUnique.mockRejectedValue(new Error('relation Admin does not exist'))
    const { evaluateAdminKeyPolicy } = await import('./admin-key-policy')
    await expect(evaluateAdminKeyPolicy('current-key')).resolves.toEqual({
      ok: true,
      rotated: false,
    })
  })

  it('allows the first login when no fingerprint is stored', async () => {
    findUnique.mockResolvedValue(null)
    const { evaluateAdminKeyPolicy } = await import('./admin-key-policy')
    await expect(evaluateAdminKeyPolicy('current-key')).resolves.toEqual({
      ok: true,
      rotated: false,
    })
  })

  it('blocks the same key when mustChangeKey is set', async () => {
    const { evaluateAdminKeyPolicy, hashAdminApiKeyFingerprint } = await import(
      './admin-key-policy'
    )
    const fp = hashAdminApiKeyFingerprint('current-key')
    findUnique.mockResolvedValue({
      mustChangeKey: true,
      apiKeyFingerprint: fp,
      keyConfirmedAt: new Date(),
    })
    await expect(evaluateAdminKeyPolicy('current-key')).resolves.toEqual({
      ok: false,
      reason: 'must_change_key',
    })
  })

  it('allows login after the env key was rotated (fingerprint differs)', async () => {
    const { evaluateAdminKeyPolicy, hashAdminApiKeyFingerprint } = await import(
      './admin-key-policy'
    )
    findUnique.mockResolvedValue({
      mustChangeKey: true,
      apiKeyFingerprint: hashAdminApiKeyFingerprint('old-key'),
      keyConfirmedAt: new Date(),
    })
    await expect(evaluateAdminKeyPolicy('new-key')).resolves.toEqual({
      ok: true,
      rotated: true,
    })
  })

  it('blocks an expired key', async () => {
    const previous = process.env.ADMIN_KEY_MAX_AGE_DAYS
    process.env.ADMIN_KEY_MAX_AGE_DAYS = '90'
    try {
      const { evaluateAdminKeyPolicy, hashAdminApiKeyFingerprint } = await import(
        './admin-key-policy'
      )
      findUnique.mockResolvedValue({
        mustChangeKey: false,
        apiKeyFingerprint: hashAdminApiKeyFingerprint('current-key'),
        keyConfirmedAt: new Date('2020-01-01T00:00:00Z'),
      })
      await expect(evaluateAdminKeyPolicy('current-key')).resolves.toEqual({
        ok: false,
        reason: 'key_expired',
      })
    } finally {
      if (previous === undefined) delete process.env.ADMIN_KEY_MAX_AGE_DAYS
      else process.env.ADMIN_KEY_MAX_AGE_DAYS = previous
    }
  })
})
