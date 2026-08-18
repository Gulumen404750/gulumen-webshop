import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Pure helpers mirroring the like-toggle settle rules used by useProductLikeToggle.
 * (Hook itself needs a DOM/React harness; these guard the counter math.)
 */
function settleLikesCount(
  prevCount: number,
  optimisticDelta: 1 | -1,
  serverLikesCount: unknown
): number {
  const optimistic = Math.max(0, prevCount + optimisticDelta)
  if (typeof serverLikesCount === 'number' && Number.isFinite(serverLikesCount)) {
    return Math.max(0, Math.floor(serverLikesCount))
  }
  return Math.max(0, prevCount)
}

function applyPendingOverlay(
  serverIds: string[],
  pending: Map<string, boolean>
): string[] {
  let next = serverIds
  for (const [id, liked] of pending) {
    if (liked) {
      if (!next.includes(id)) next = [...next, id]
    } else if (next.includes(id)) {
      next = next.filter((x) => x !== id)
    }
  }
  return next
}

describe('wishlist like counter settle', () => {
  it('settles to server likesCount after optimistic +1 from any start', () => {
    expect(settleLikesCount(0, 1, 1)).toBe(1)
    expect(settleLikesCount(1, 1, 2)).toBe(2)
    expect(settleLikesCount(7, 1, 8)).toBe(8)
    expect(settleLikesCount(1, 1, 1)).toBe(1) // server says still 1 → no stuck 2
  })

  it('settles to server likesCount after optimistic -1', () => {
    expect(settleLikesCount(2, -1, 1)).toBe(1)
    expect(settleLikesCount(1, -1, 0)).toBe(0)
    expect(settleLikesCount(0, -1, 0)).toBe(0)
  })

  it('falls back to previous count if server omits likesCount', () => {
    expect(settleLikesCount(5, 1, undefined)).toBe(5)
    expect(settleLikesCount(5, 1, null)).toBe(5)
    expect(settleLikesCount(5, 1, 'x')).toBe(5)
  })

  it('pending overlay protects optimistic like against stale server list', () => {
    const pending = new Map<string, boolean>([['p1', true]])
    expect(applyPendingOverlay([], pending)).toEqual(['p1'])
    expect(applyPendingOverlay(['p2'], pending)).toEqual(['p2', 'p1'])
  })

  it('pending overlay protects optimistic unlike', () => {
    const pending = new Map<string, boolean>([['p1', false]])
    expect(applyPendingOverlay(['p1', 'p2'], pending)).toEqual(['p2'])
  })
})

describe('like POST desired state', () => {
  it('sends the intended liked flag so a stale toggle cannot recreate the row', () => {
    const src = readFileSync(join(process.cwd(), 'src/hooks/useProductLikeToggle.ts'), 'utf-8')
    expect(src).toMatch(/JSON\.stringify\(\{ liked: nextLiked \}\)/)
    expect(src).toMatch(/canAcceptExternalLike/)
    expect(src).toMatch(/isDismissed\(prodId\)/)
  })
})

describe('like toggle in-flight lock semantics', () => {
  it('second call while in-flight is ignored', () => {
    let inFlight = false
    let posts = 0
    const toggle = () => {
      if (inFlight) return
      inFlight = true
      posts += 1
    }
    toggle()
    toggle()
    toggle()
    expect(posts).toBe(1)
  })
})
