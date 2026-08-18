import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('WishlistContext unlike sync', () => {
  const src = readFileSync(join(process.cwd(), 'src/context/WishlistContext.tsx'), 'utf-8')

  it('keeps an explicit unlike out of stale localStorage merges', () => {
    expect(src).toMatch(/mergeFavoriteIdsFromCache/)
    expect(src).toMatch(/excludeDismissedIds/)
    expect(src).toMatch(/FAVORITE_DISMISS_STORAGE_KEY/)
    expect(src).not.toMatch(/prev\.length >= stored\.length \? prev : stored/)
  })

  it('writes favorites and dismissals immediately on optimistic toggle', () => {
    expect(src).toMatch(/writeStoredFavoriteIds\(userId, next\)/)
    expect(src).toMatch(/writeStoredDismissedIds\(userId, next\)/)
    expect(src).toMatch(/isDismissed/)
  })
})
