import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  giftPointCode: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  giftPointGrant: {
    findUnique: vi.fn(),
  },
}))

const grantNfcGiftPoints = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  isDbConfigured: () => true,
  prisma: mockPrisma,
}))

vi.mock('@/lib/gamification/gift-points', () => ({
  grantNfcGiftPoints: (...args: unknown[]) => grantNfcGiftPoints(...args),
}))

import { claimGiftPointCode } from './gift-point-codes'

const now = new Date('2026-08-18T12:00:00.000Z')
const expiresAt = new Date('2026-09-17T12:00:00.000Z')

function unusedCode() {
  return {
    id: 'code-1',
    batchId: 'batch-1',
    token: 'ABCD2345EFGH',
    active: true,
    claimedAt: null,
    claimedByUserId: null,
    grantId: null,
    createdAt: now,
    updatedAt: now,
    batch: {
      id: 'batch-1',
      code: 'AJANDEK5000',
      points: 5000,
      quantity: 3,
      active: true,
      validFrom: null,
      validUntil: null,
    },
  }
}

describe('claimGiftPointCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.giftPointCode.findUnique.mockResolvedValue(unusedCode())
    mockPrisma.giftPointCode.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.giftPointCode.update.mockResolvedValue({})
    grantNfcGiftPoints.mockResolvedValue({
      grantId: 'grant-1',
      expiresAt,
      balanceAfter: 5000,
    })
  })

  it('credits the wallet once and deactivates the code', async () => {
    const result = await claimGiftPointCode({ token: 'abcd-2345-efgh', userId: 'user-1', now })
    expect(result).toEqual({
      ok: true,
      points: 5000,
      grantId: 'grant-1',
      expiresAt,
      balanceAfter: 5000,
      token: 'ABCD2345EFGH',
    })
    expect(mockPrisma.giftPointCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'code-1', claimedAt: null, active: true },
      data: {
        claimedAt: now,
        claimedByUserId: 'user-1',
        active: false,
      },
    })
    expect(grantNfcGiftPoints).toHaveBeenCalledWith({
      userId: 'user-1',
      points: 5000,
      source: 'claim',
      codeId: 'code-1',
      nfcTagId: 'ABCD2345EFGH',
      now,
    })
  })

  it('rejects a second claim as already used', async () => {
    mockPrisma.giftPointCode.findUnique.mockResolvedValue({
      ...unusedCode(),
      claimedAt: now,
      claimedByUserId: 'other-user',
      active: false,
    })
    const result = await claimGiftPointCode({ token: 'ABCD2345EFGH', userId: 'user-1', now })
    expect(result).toEqual({ ok: false, reason: 'already_used' })
    expect(grantNfcGiftPoints).not.toHaveBeenCalled()
  })

  it('rolls the code back if wallet credit fails', async () => {
    grantNfcGiftPoints.mockRejectedValue(new Error('ledger down'))
    const result = await claimGiftPointCode({ token: 'ABCD2345EFGH', userId: 'user-1', now })
    expect(result).toEqual({ ok: false, reason: 'grant_failed' })
    expect(mockPrisma.giftPointCode.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'code-1', claimedByUserId: 'user-1' },
      data: { claimedAt: null, claimedByUserId: null, grantId: null, active: true },
    })
  })
})
