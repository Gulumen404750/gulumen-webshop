/**
 * Külső óra (World Time API) – a visszaszámláló ne a szerver órájától függjön.
 * Így a Railway/szerver óra eltérése vagy újraindítás nem indítja újra a számlálót.
 */

const TIME_API_URL = 'https://worldtimeapi.org/api/ip'
const TIMEOUT_MS = 2000
const CACHE_MS = 5000 // max 5 mp cache, hogy ne terheljük az API-t

let cached: { nowMs: number; at: number } | null = null

/**
 * Szerver oldalon: aktuális idő ms (epoch), külső API-ból. Hiba/timeout esetén Date.now().
 */
export async function getServerTimeMs(): Promise<number> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_MS) return cached.nowMs + (now - cached.at)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(TIME_API_URL, {
      signal: controller.signal,
      next: { revalidate: 0 },
    })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error('Time API not ok')
    const data = (await res.json()) as { unixtime?: number }
    const unixtime = data?.unixtime
    if (typeof unixtime !== 'number') throw new Error('No unixtime')
    const nowMs = unixtime * 1000
    cached = { nowMs, at: now }
    return nowMs
  } catch {
    cached = null
    return Date.now()
  }
}
