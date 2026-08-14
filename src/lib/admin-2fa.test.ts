import { beforeEach, describe, expect, it, vi } from 'vitest'

const isDbConfigured = vi.fn()
const findUnique = vi.fn()
const upsert = vi.fn()
const update = vi.fn()

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => isDbConfigured(),
  prisma: {
    admin: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}))

describe('admin 2FA pending re-enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfigured.mockReturnValue(true)
    upsert.mockResolvedValue({})
    update.mockResolvedValue({})
  })

  it('first setup stores totpSecret with 2FA still disabled', async () => {
    findUnique.mockResolvedValue(null)
    const { saveAdminTotpSetup } = await import('./admin-2fa')
    await saveAdminTotpSetup('FIRSTSECRET')
    expect(upsert).toHaveBeenCalledWith({
      where: { id: 'admin' },
      create: {
        id: 'admin',
        totpSecret: 'FIRSTSECRET',
        pendingTotpSecret: null,
        isTwoFactorEnabled: false,
      },
      update: {
        totpSecret: 'FIRSTSECRET',
        pendingTotpSecret: null,
        isTwoFactorEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps the active secret and 2FA enabled while storing a pending secret on re-enroll', async () => {
    findUnique.mockResolvedValue({
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: null,
      isTwoFactorEnabled: true,
    })
    const { saveAdminTotpSetup, getAdminTwoFactorState } = await import('./admin-2fa')
    await saveAdminTotpSetup('PENDINGSECRET')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'admin' },
      data: { pendingTotpSecret: 'PENDINGSECRET' },
    })
    expect(upsert).not.toHaveBeenCalled()

    findUnique.mockResolvedValue({
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: 'PENDINGSECRET',
      isTwoFactorEnabled: true,
    })
    const state = await getAdminTwoFactorState()
    expect(state.isTwoFactorEnabled).toBe(true)
    expect(state.totpSecret).toBe('ACTIVESECRET')
    expect(state.pendingTotpSecret).toBe('PENDINGSECRET')
  })

  it('promotes pending secret to active and clears pending on confirm', async () => {
    findUnique.mockResolvedValue({
      totpSecret: 'ACTIVESECRET',
      pendingTotpSecret: 'PENDINGSECRET',
      isTwoFactorEnabled: true,
    })
    const { confirmAdminTotpSetup } = await import('./admin-2fa')
    await confirmAdminTotpSetup()
    expect(update).toHaveBeenCalledWith({
      where: { id: 'admin' },
      data: {
        totpSecret: 'PENDINGSECRET',
        pendingTotpSecret: null,
        isTwoFactorEnabled: true,
      },
    })
  })

  it('first confirm only flips isTwoFactorEnabled without touching pending', async () => {
    findUnique.mockResolvedValue({
      totpSecret: 'FIRSTSECRET',
      pendingTotpSecret: null,
      isTwoFactorEnabled: false,
    })
    const { confirmAdminTotpSetup } = await import('./admin-2fa')
    await confirmAdminTotpSetup()
    expect(update).toHaveBeenCalledWith({
      where: { id: 'admin' },
      data: { isTwoFactorEnabled: true },
    })
  })
})
