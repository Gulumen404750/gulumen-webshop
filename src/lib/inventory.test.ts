import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  isDbConfigured: vi.fn(() => true),
}))

import {
  decrementStockAtomic,
  OutOfStockException,
  restoreStockAtomic,
} from './inventory'
import { isDbConfigured } from '@/lib/prisma'

describe('inventory stock restore / decrement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isDbConfigured).mockReturnValue(true)
  })

  it('restoreStockAtomic issues an UPDATE per limited-stock line', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1)

    await restoreStockAtomic([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', qty: 1 },
    ])

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it('restoreStockAtomic skips qty < 1', async () => {
    await restoreStockAtomic([{ productId: 'p1', qty: 0 }])
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('decrementStockAtomic throws OutOfStockException when no rows updated', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(0)

    await expect(
      decrementStockAtomic([{ productId: 'sold-out', qty: 1 }])
    ).rejects.toBeInstanceOf(OutOfStockException)
  })

  it('decrementStockAtomic succeeds when UPDATE affects a row', async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1)
    await expect(
      decrementStockAtomic([{ productId: 'ok', qty: 3 }])
    ).resolves.toBeUndefined()
  })

  it('no-ops when DB is not configured', async () => {
    vi.mocked(isDbConfigured).mockReturnValue(false)
    await restoreStockAtomic([{ productId: 'p1', qty: 1 }])
    await decrementStockAtomic([{ productId: 'p1', qty: 1 }])
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })
})
