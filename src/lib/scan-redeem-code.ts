/**
 * QR / NFC payload → kupon- vagy ajándékpont-kód.
 * A claim QR a teljes /claim/TOKEN URL-t kódolja; a beváltó mező csak a tokent várja.
 */

const MAX_REDEEM_CODE_LENGTH = 64

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.trim()
  }
}

function tokenFromClaimPath(raw: string): string | null {
  const match = raw.match(/\/claim\/([^/?#]+)/i)
  if (!match?.[1]) return null
  const token = decodeSegment(match[1])
  return token || null
}

function lastPathSegment(raw: string): string | null {
  try {
    if (!/^https?:\/\//i.test(raw)) return null
    const url = new URL(raw)
    const segments = url.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (!last) return null
    const decoded = decodeSegment(last)
    return decoded || null
  } catch {
    return null
  }
}

/** Beolvasott QR-szövegből kód a beváltó mezőhöz. */
export function extractRedeemCodeFromScan(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const fromClaim = tokenFromClaimPath(trimmed)
  const extracted = fromClaim ?? lastPathSegment(trimmed) ?? trimmed.replace(/\s+/g, '')
  return extracted.toUpperCase().slice(0, MAX_REDEEM_CODE_LENGTH)
}
