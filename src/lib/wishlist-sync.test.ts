import { describe, expect, it } from 'vitest'
import {
  applyPendingFavoriteOverlay,
  excludeDismissedIds,
  excludeDismissedItems,
  mergeFavoriteIdsFromCache,
  nextDismissedIdsAfterToggle,
  nextFavoriteIdsAfterToggle,
  shouldAcceptExternalLike,
} from './wishlist-sync'

describe('applyPendingFavoriteOverlay', () => {
  it('protects optimistic unlike against a stale server list', () => {
    const pending = new Map<string, boolean>([['p1', false]])
    expect(applyPendingFavoriteOverlay(['p1', 'p2'], pending)).toEqual(['p2'])
  })

  it('protects optimistic like against a stale empty server list', () => {
    const pending = new Map<string, boolean>([['p1', true]])
    expect(applyPendingFavoriteOverlay([], pending)).toEqual(['p1'])
  })
})

describe('dismiss / unlike blacklist', () => {
  it('drops dismissed products from recommendation lists', () => {
    expect(excludeDismissedIds(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
    expect(excludeDismissedItems([{ id: 'a' }, { id: 'b' }], new Set(['b']))).toEqual([{ id: 'a' }])
  })

  it('records unlike on the dismiss list and clears it on a new like', () => {
    expect(nextDismissedIdsAfterToggle([], 'p1', false)).toEqual(['p1'])
    expect(nextDismissedIdsAfterToggle(['p1'], 'p1', true)).toEqual([])
    expect(nextFavoriteIdsAfterToggle(['p1', 'p2'], 'p1', false)).toEqual(['p2'])
    expect(nextFavoriteIdsAfterToggle(['p2'], 'p1', true)).toEqual(['p2', 'p1'])
  })

  it('never grows favorites from a longer stale localStorage snapshot', () => {
    expect(mergeFavoriteIdsFromCache(['b', 'c'], ['a', 'b', 'c'])).toEqual(['b', 'c'])
    expect(mergeFavoriteIdsFromCache([], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('rejects auto-like from GET when the product was explicitly removed', () => {
    expect(shouldAcceptExternalLike(true, false, true, false)).toBe(false)
    expect(shouldAcceptExternalLike(true, false, false, false)).toBe(true)
    expect(shouldAcceptExternalLike(true, true, false, false)).toBe(false)
    expect(shouldAcceptExternalLike(true, false, false, true)).toBe(false)
  })
})
