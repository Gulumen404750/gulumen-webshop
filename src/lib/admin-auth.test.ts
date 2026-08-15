import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOTSTRAP_ADMIN_ACTOR } from './admin-rbac'

const cookieGet = vi.fn()
const parseAdminSessionToken = vi.fn()
const parseAdminPendingTwoFactorToken = vi.fn()
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

vi.mock('@/lib/admin-session-constants', () => ({
  OPERATOR_COOKIE_NAME: 'operator_authorized',
}))

vi.mock('@/lib/admin-operators', () => ({
  getAdminOperatorById: (...args: unknown[]) => getAdminOperatorById(...args),
}))

describe('requireAdmin / unbreakable owner fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieGet.mockReturnValue(undefined)
    parseAdminSessionToken.mockResolvedValue(null)
    parseAdminPendingTwoFactorToken.mockResolvedValue(null)
    getAdminOperatorById.mockResolvedValue(null)
  })

  it('requireAdmin accepts a full 2FA bootstrap session', async () => {
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

  it('keeps bootstrap owner session even when owners exist (unbreakable fallback)', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'full-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(BOOTSTRAP_ADMIN_ACTOR)
    const { requireAdmin } = await import('./admin-auth')
    expect(await requireAdmin()).toEqual(
      expect.objectContaining({ id: 'admin', bootstrap: true })
    )
  })

  it('prefers operator cookie when both cookies are present (owner session preserved)', async () => {
    const support = { id: 'op-1', username: 'kata', role: 'support' as const }
    cookieGet.mockImplementation((name: string) => {
      if (name === 'admin_authorized') return { value: 'owner-jwt' }
      if (name === 'operator_authorized') return { value: 'op-jwt' }
      return undefined
    })
    parseAdminSessionToken.mockImplementation(async (token: string) => {
      if (token === 'owner-jwt') return BOOTSTRAP_ADMIN_ACTOR
      if (token === 'op-jwt') return support
      return null
    })
    getAdminOperatorById.mockResolvedValue(support)
    const { requireAdmin } = await import('./admin-auth')
    expect(await requireAdmin()).toEqual(support)
  })

  it('falls back to owner cookie when operator cookie is absent', async () => {
    cookieGet.mockImplementation((name: string) =>
      name === 'admin_authorized' ? { value: 'owner-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(BOOTSTRAP_ADMIN_ACTOR)
    const { requireAdmin } = await import('./admin-auth')
    expect(await requireAdmin()).toEqual(
      expect.objectContaining({ id: 'admin', bootstrap: true })
    )
  })

  it('uses operator cookie when owner cookie is absent', async () => {
    const support = { id: 'op-1', username: 'kata', role: 'support' as const }
    cookieGet.mockImplementation((name: string) =>
      name === 'operator_authorized' ? { value: 'op-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(support)
    getAdminOperatorById.mockResolvedValue(support)
    const { requireAdmin, requireAdminPermission } = await import('./admin-auth')
    expect(await requireAdmin()).toEqual(support)
    const pii = await requireAdminPermission('customers:pii')
    expect(pii.ok).toBe(true)
    const price = await requireAdminPermission('products:write')
    expect(price.ok).toBe(false)
  })

  it('requireOwner rejects non-owner', async () => {
    const support = { id: 'op-1', username: 'kata', role: 'support' as const }
    cookieGet.mockImplementation((name: string) =>
      name === 'operator_authorized' ? { value: 'op-jwt' } : undefined
    )
    parseAdminSessionToken.mockResolvedValue(support)
    getAdminOperatorById.mockResolvedValue(support)
    const { requireOwner } = await import('./admin-auth')
    const gate = await requireOwner()
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(403)
  })

  it('isMasterAdminActor is true only for bootstrap / factory admin', async () => {
    const { isMasterAdminActor } = await import('./admin-auth')
    expect(isMasterAdminActor(BOOTSTRAP_ADMIN_ACTOR)).toBe(true)
    expect(isMasterAdminActor({ id: 'admin', username: 'admin', role: 'owner' })).toBe(true)
    expect(isMasterAdminActor({ id: 'op1', username: 'anna', role: 'owner' })).toBe(false)
    expect(isMasterAdminActor({ id: 'op2', username: 'bela', role: 'support' })).toBe(false)
  })
})
