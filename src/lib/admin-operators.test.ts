import { beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
const findUnique = vi.fn()
const create = vi.fn()
const isDbConfigured = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminOperator: {
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('admin operators fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
  })

  it('countAdminOperators fails open to 0 when the table is missing', async () => {
    count.mockRejectedValue(new Error('relation "AdminOperator" does not exist'))
    const { countAdminOperators } = await import('./admin-operators')
    expect(await countAdminOperators()).toBe(0)
  })

  it('countAdminOperators fails open when DB is not configured', async () => {
    isDbConfigured.mockReturnValue(false)
    const { countAdminOperators } = await import('./admin-operators')
    expect(await countAdminOperators()).toBe(0)
    expect(count).not.toHaveBeenCalled()
  })

  it('API-key-only login stays bootstrap while the table is empty', async () => {
    count.mockResolvedValue(0)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('requires named operator once any row exists', async () => {
    count.mockResolvedValue(1)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({ ok: false, code: 'requiresOperator' })
  })

  it('emergency env allows API-key bootstrap even with operators', async () => {
    count.mockResolvedValue(2)
    vi.stubEnv('ADMIN_EMERGENCY_API_KEY_LOGIN', '1')
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
    vi.unstubAllEnvs()
  })
})
