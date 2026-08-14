import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOTSTRAP_ADMIN_ACTOR } from './admin-rbac'

const cookieGet = vi.fn()
const parseAdminSessionToken = vi.fn()
const parseAdminPendingTwoFactorToken = vi.fn()
const countAdminOperators = vi.fn()
const getAdminOperatorById = vi.fn()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieGet(name),
  }),
}))

vi.mock('@/lib/admin-session', () => ({
  ADMIN_COOKIE_NAME: 'admin_authorized',
  ADMIN_2FA_PENDING_COOKIE: 'admin_2fa_pending',
  parseAdminSessionToken: (...args: unknown[]) => parseAdminSessionToken(...args),
  parseAdminPendingTwoFactorToken: (...args: unknown[]) => parseAdminPendingTwoFactorToken(...args),
}))

vi.mock('@/lib/admin-operators', () => ({
  countAdminOperators: () => countAdminOperators(),
  getAdminOperatorById: (...args: unknown[]) => getAdminOperatorById(...args),
  isAdminEmergencyApiKeyLoginEnabled: () => false,
}))

describe('requireAdmin / requireAdminOrPendingTwoFactor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieGet.mockReturnValue(undefined)
    parseAdminSessionToken.mockResolvedValue(null)
    parseAdminPendingTwoFactorToken.mockResolvedValue(null)
    countAdminOperators.mockResolvedValue(0)
    getAdminOperatorById.mockResolvedValue(null)
  })

  it('requireAdmin accepts a full 2FA bootstrap session while no operators exist', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'full-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(BOOTSTRAP_ADMIN_ACTOR)
    const { requireAdmin } = await import('./admin-auth')
    const actor = await requireAdmin()
    expect(actor).toEqual(expect.objectContaining({ id: 'admin', role: 'owner', bootstrap: true }))
  })

  it('pending 2FA token is not enough for requireAdmin', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_2fa_pending' ? { value: 'pending-jwt' } : undefined
    )
    parseAdminPendingTwoFactorToken.mockResolvedValue(BOOTSTRAP_ADMIN_ACTOR)
    const { requireAdmin, requireAdminOrPendingTwoFactor } = await import('./admin-auth')
    expect(await requireAdmin()).toBeNull()
    expect(await requireAdminOrPendingTwoFactor()).toBe('pending')
  })

  it('rejects bootstrap session once named operators exist', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'full-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(BOOTSTRAP_ADMIN_ACTOR)
    countAdminOperators.mockResolvedValue(1)
    const { requireAdmin } = await import('./admin-auth')
    expect(await requireAdmin()).toBeNull()
  })

  it('looks up the named operator when operators exist', async () => {
    const support = { id: 'op-1', username: 'kata', role: 'support' as const }
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'full-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(support)
    countAdminOperators.mockResolvedValue(2)
    getAdminOperatorById.mockResolvedValue(support)
    const { requireAdmin, requireAdminPermission } = await import('./admin-auth')
    expect(await requireAdmin()).toEqual(support)
    const pii = await requireAdminPermission('customers:pii')
    expect(pii.ok).toBe(true)
    const price = await requireAdminPermission('products:write')
    expect(price.ok).toBe(false)
    if (!price.ok) expect(price.response.status).toBe(403)
  })
})
