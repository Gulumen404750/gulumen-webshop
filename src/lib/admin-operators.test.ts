import { beforeEach, describe, expect, it, vi } from 'vitest'

const count = vi.fn()
const findUnique = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const isDbConfigured = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    adminOperator: {
      count: (...args: unknown[]) => count(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      delete: (...args: unknown[]) => remove(...args),
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
    const { resolveOwnerLoginActor } = await import('./admin-operators')
    const result = await resolveOwnerLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
  })

  it('owner path allows API-key bootstrap even with active owners (unbreakable)', async () => {
    mockCounts(2, 3)
    const { resolveOwnerLoginActor } = await import('./admin-operators')
    const result = await resolveOwnerLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
  })

  it('legacy resolveAdminLoginActor also allows key-only when owners exist', async () => {
    mockCounts(1, 1)
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', bootstrap: true }),
    })
  })

  it('emergency env still allows API-key bootstrap even with owners', async () => {
    mockCounts(2, 3)
    vi.stubEnv('ADMIN_EMERGENCY_API_KEY_LOGIN', '1')
    const { resolveAdminLoginActor } = await import('./admin-operators')
    const result = await resolveAdminLoginActor({})
    expect(result).toEqual({
      ok: true,
      actor: expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }),
    })
  })

  it('owner path rejects operator username+password once operators exist', async () => {
    mockCounts(1, 2)
    const { resolveOwnerLoginActor } = await import('./admin-operators')
    const result = await resolveOwnerLoginActor({
      username: 'bela',
      password: 'password12',
    })
    expect(result).toEqual({ ok: false, code: 'invalid_credentials' })
  })

  it('operator path requires username+password', async () => {
    mockCounts(1, 1)
    const { resolveOperatorLoginActor } = await import('./admin-operators')
    const bad = await resolveOperatorLoginActor({})
    expect(bad).toEqual({ ok: false, code: 'invalid_input' })
  })

  it('rejects creating an operator with owner role', async () => {
    mockCounts(0, 0)
    const { createAdminOperator } = await import('./admin-operators')
    await expect(
      createAdminOperator({ username: 'bela', password: 'password12', role: 'owner' })
    ).rejects.toMatchObject({ name: 'OWNER_ROLE_FORBIDDEN' })
    expect(create).not.toHaveBeenCalled()
  })

  it('allows creating the first operator as support (no DB owner required)', async () => {
    mockCounts(0, 0)
    create.mockResolvedValue({
      id: 'op2',
      username: 'bela',
      role: 'support',
      active: true,
    })
    const { createAdminOperator } = await import('./admin-operators')
    await expect(
      createAdminOperator({ username: 'bela', password: 'password12', role: 'support' })
    ).resolves.toEqual(expect.objectContaining({ role: 'support' }))
    expect(create).toHaveBeenCalled()
  })

  it('rejects promoting an operator to owner', async () => {
    findUnique.mockResolvedValue({
      id: 'op2',
      username: 'bela',
      role: 'support',
      active: true,
      passwordHash: 'x',
    })
    const { updateAdminOperator } = await import('./admin-operators')
    await expect(updateAdminOperator('op2', { role: 'owner' })).rejects.toMatchObject({
      name: 'OWNER_ROLE_FORBIDDEN',
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('owner path rejects username+password even on empty table (no DB owner create)', async () => {
    mockCounts(0, 0)
    const { resolveOwnerLoginActor } = await import('./admin-operators')
    const result = await resolveOwnerLoginActor({
      username: 'anna',
      password: 'password12',
    })
    expect(result).toEqual({ ok: false, code: 'invalid_credentials' })
    expect(create).not.toHaveBeenCalled()
  })

  it('blocks deleting the last owner without override', async () => {
    mockCounts(1, 1)
    findUnique.mockResolvedValue({
      id: 'op1',
      username: 'anna',
      role: 'owner',
      active: true,
      passwordHash: 'x',
    })
    const { deleteAdminOperator } = await import('./admin-operators')
    await expect(deleteAdminOperator('op1')).resolves.toBe('last_owner')
    expect(remove).not.toHaveBeenCalled()
  })

  it('master override deletes the last owner', async () => {
    mockCounts(1, 1)
    findUnique.mockResolvedValue({
      id: 'op1',
      username: 'anna',
      role: 'owner',
      active: true,
      passwordHash: 'x',
    })
    remove.mockResolvedValue({})
    const { deleteAdminOperator } = await import('./admin-operators')
    await expect(
      deleteAdminOperator('op1', { allowLastOwnerOverride: true })
    ).resolves.toBe('ok')
    expect(remove).toHaveBeenCalledWith({ where: { id: 'op1' } })
  })

  it('master override demotes the last owner', async () => {
    mockCounts(1, 1)
    findUnique.mockResolvedValue({
      id: 'op1',
      username: 'anna',
      role: 'owner',
      active: true,
      passwordHash: 'x',
    })
    update.mockResolvedValue({
      id: 'op1',
      username: 'anna',
      role: 'support',
      active: true,
    })
    const { updateAdminOperator } = await import('./admin-operators')
    await expect(
      updateAdminOperator('op1', { role: 'support' }, { allowLastOwnerOverride: true })
    ).resolves.toEqual(expect.objectContaining({ role: 'support' }))
    expect(update).toHaveBeenCalled()
  })
})
