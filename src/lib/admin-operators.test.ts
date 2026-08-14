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

function mockCounts(owners: number, total: number) {
  count.mockImplementation((args?: { where?: { role?: string } }) => {
    if (args?.where?.role === 'owner') return Promise.resolve(owners)
    return Promise.resolve(total)
  })
}

describe('admin operators fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    vi.unstubAllEnvs()
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
    mockCounts(0, 0)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('API-key bootstrap still works when only non-owner operators exist', async () => {
    mockCounts(0, 2)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
  })

  it('requires named operator once an active owner exists', async () => {
    mockCounts(1, 1)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({ ok: false, code: 'requiresOperator' })
  })

  it('emergency env allows API-key bootstrap even with owners', async () => {
    mockCounts(2, 3)
    vi.stubEnv('ADMIN_EMERGENCY_API_KEY_LOGIN', '1')
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
  })

  it('first operator create must be owner', async () => {
    mockCounts(0, 0)
    const { createAdminOperator } = await import('./admin-operators')
    await expect(
      createAdminOperator({ username: 'bela', password: 'password12', role: 'support' })
    ).rejects.toMatchObject({ name: 'FIRST_MUST_BE_OWNER' })
    expect(create).not.toHaveBeenCalled()
  })
})
