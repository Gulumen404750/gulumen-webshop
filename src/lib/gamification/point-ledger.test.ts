import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mockPrisma = vi.hoisted(() => {
  const tx = {
    userPointWallet: {
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
    },
  }

  return {
    prisma: {
      pointTransaction: {
        findUnique: vi.fn(),
      },
      userPointWallet: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
    tx,
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma.prisma,
}))

import {
  applyPointDelta,
  InsufficientPointsError,
  GamificationSuspendedError,
} from './point-ledger'
import { POINT_TX_TYPES } from './constants'

const userId = 'user-1'

function makeWallet(overrides: Partial<{
  balance: number
  version: number
  gamificationSuspended: boolean
}> = {}) {
  return {
    userId,
    balance: 100,
    version: 0,
    gamificationSuspended: false,
    lifetimeEarned: 0,
    lifetimeRedeemed: 0,
    suspendedAt: null,
    suspendReason: null,
    lastReconciledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('applyPointDelta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.prisma.pointTransaction.findUnique.mockResolvedValue(null)
    mockPrisma.tx.userPointWallet.upsert.mockResolvedValue(makeWallet())
    mockPrisma.tx.userPointWallet.findUniqueOrThrow.mockResolvedValue(makeWallet())
    mockPrisma.tx.userPointWallet.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.tx.pointTransaction.create.mockImplementation(async ({ data }) => ({
      id: 'tx-1',
      ...data,
      createdAt: new Date(),
    }))
  })

  it('rejects zero delta', async () => {
    await expect(
      applyPointDelta({
        userId,
        delta: 0,
        type: POINT_TX_TYPES.ADMIN_ADJUST,
        idempotencyKey: 'key-zero',
      })
    ).rejects.toThrow('Point delta must not be zero')
  })

  it('credits points and updates wallet', async () => {
    const result = await applyPointDelta({
      userId,
      delta: 50,
      type: POINT_TX_TYPES.BROWSE_5MIN,
      idempotencyKey: 'key-credit',
      reason: 'browse bonus',
    })

    expect(result.duplicate).toBe(false)
    expect(result.transaction.delta).toBe(50)
    expect(result.transaction.balanceAfter).toBe(150)
    expect(mockPrisma.tx.userPointWallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, version: 0 },
        data: expect.objectContaining({
          balance: 150,
          lifetimeEarned: { increment: 50 },
        }),
      })
    )
  })

  it('blocks debit that would make balance negative', async () => {
    mockPrisma.tx.userPointWallet.findUniqueOrThrow.mockResolvedValue(
      makeWallet({ balance: 30 })
    )

    await expect(
      applyPointDelta({
        userId,
        delta: -50,
        type: POINT_TX_TYPES.PURCHASE_REDEEM,
        idempotencyKey: 'key-debit',
      })
    ).rejects.toBeInstanceOf(InsufficientPointsError)

    expect(mockPrisma.tx.pointTransaction.create).not.toHaveBeenCalled()
  })

  it('returns existing transaction on duplicate idempotency key', async () => {
    const existing = {
      id: 'tx-existing',
      userId,
      delta: 10,
      balanceAfter: 110,
      type: POINT_TX_TYPES.BROWSE_5MIN,
      idempotencyKey: 'key-dup',
      createdAt: new Date(),
    }
    mockPrisma.prisma.pointTransaction.findUnique.mockResolvedValue(existing)
    mockPrisma.prisma.userPointWallet.findUnique.mockResolvedValue(makeWallet({ balance: 110 }))

    const result = await applyPointDelta({
      userId,
      delta: 10,
      type: POINT_TX_TYPES.BROWSE_5MIN,
      idempotencyKey: 'key-dup',
    })

    expect(result.duplicate).toBe(true)
    expect(result.transaction).toEqual(existing)
    expect(mockPrisma.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('blocks earn when gamification is suspended', async () => {
    mockPrisma.tx.userPointWallet.findUniqueOrThrow.mockResolvedValue(
      makeWallet({ gamificationSuspended: true })
    )

    await expect(
      applyPointDelta({
        userId,
        delta: 10,
        type: POINT_TX_TYPES.BROWSE_5MIN,
        idempotencyKey: 'key-suspended',
      })
    ).rejects.toBeInstanceOf(GamificationSuspendedError)
  })

  it('handles P2002 race by returning duplicate transaction', async () => {
    const dup = {
      id: 'tx-race',
      userId,
      delta: 25,
      balanceAfter: 125,
      type: POINT_TX_TYPES.BROWSE_5MIN,
      idempotencyKey: 'key-race',
      createdAt: new Date(),
    }
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '6.0.0',
    })

    mockPrisma.prisma.$transaction.mockRejectedValueOnce(p2002)
    mockPrisma.prisma.pointTransaction.findUnique.mockResolvedValueOnce(null)
    mockPrisma.prisma.pointTransaction.findUnique.mockResolvedValueOnce(dup)
    mockPrisma.prisma.userPointWallet.findUnique.mockResolvedValue(makeWallet({ balance: 125 }))

    const result = await applyPointDelta({
      userId,
      delta: 25,
      type: POINT_TX_TYPES.BROWSE_5MIN,
      idempotencyKey: 'key-race',
    })

    expect(result.duplicate).toBe(true)
    expect(result.transaction).toEqual(dup)
  })

  it('allows debiting the entire balance to exactly 0', async () => {
    mockPrisma.tx.userPointWallet.findUniqueOrThrow.mockResolvedValue(
      makeWallet({ balance: 500 })
    )

    const result = await applyPointDelta({
      userId,
      delta: -500,
      type: POINT_TX_TYPES.PURCHASE_REDEEM,
      idempotencyKey: 'key-zero-out',
    })

    expect(result.duplicate).toBe(false)
    expect(result.transaction.delta).toBe(-500)
    expect(result.transaction.balanceAfter).toBe(0)
    expect(mockPrisma.tx.userPointWallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: 0,
          lifetimeRedeemed: { increment: 500 },
        }),
      })
    )
  })
})
