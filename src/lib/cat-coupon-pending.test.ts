import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  CAT_COUPON_PENDING_KEY,
  clearCatCouponPending,
  consumeCatCouponPending,
  hasCatCouponPending,
  markCatCouponPending,
} from '@/lib/cat-coupon-pending'

describe('cat coupon pending intent', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', {})
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks and consumes pending cat coupon after guest click', () => {
    expect(hasCatCouponPending()).toBe(false)
    markCatCouponPending()
    expect(hasCatCouponPending()).toBe(true)
    expect(store.has(CAT_COUPON_PENDING_KEY)).toBe(true)
    expect(consumeCatCouponPending()).toBe(true)
    expect(hasCatCouponPending()).toBe(false)
  })

  it('expires stale pending after TTL', () => {
    markCatCouponPending()
    const raw = store.get(CAT_COUPON_PENDING_KEY)!
    const parsed = JSON.parse(raw) as { at: number }
    store.set(CAT_COUPON_PENDING_KEY, JSON.stringify({ at: parsed.at - 31 * 60 * 1000 }))
    expect(hasCatCouponPending()).toBe(false)
    expect(consumeCatCouponPending()).toBe(false)
  })

  it('clear removes pending without consuming', () => {
    markCatCouponPending()
    clearCatCouponPending()
    expect(hasCatCouponPending()).toBe(false)
  })
})
