import { afterEach, describe, expect, it, vi } from 'vitest'

describe('clearGulumenClientStorage', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('clears sessionStorage and gulumen-prefixed localStorage keys', async () => {
    const sessionStore = new Map<string, string>([
      ['gulumen:pendingPointsRedeem', '{"pointsUsed":100}'],
      ['other-session', 'keep-me-gone'],
    ])
    const localStore = new Map<string, string>([
      ['gulumen_favorites', '{"userId":"a","ids":["1"]}'],
      ['gulumen-cart', '[]'],
      ['gulumen-recently-viewed', '[]'],
      ['theme', 'dark'],
      ['locale', 'hu'],
    ])

    vi.stubGlobal('window', {})
    vi.stubGlobal('sessionStorage', {
      clear: () => sessionStore.clear(),
      removeItem: (k: string) => sessionStore.delete(k),
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => sessionStore.set(k, v),
    })
    vi.stubGlobal('localStorage', {
      get length() {
        return localStore.size
      },
      key: (i: number) => Array.from(localStore.keys())[i] ?? null,
      removeItem: (k: string) => localStore.delete(k),
      getItem: (k: string) => localStore.get(k) ?? null,
      setItem: (k: string, v: string) => localStore.set(k, v),
    })

    const { clearGulumenClientStorage } = await import('./logout-cleanup')
    clearGulumenClientStorage()

    expect(sessionStore.size).toBe(0)
    expect(localStore.has('gulumen_favorites')).toBe(false)
    expect(localStore.has('gulumen-cart')).toBe(false)
    expect(localStore.has('gulumen-recently-viewed')).toBe(false)
    expect(localStore.get('theme')).toBe('dark')
    expect(localStore.get('locale')).toBe('hu')
  })
})
