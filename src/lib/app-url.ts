/** Kanonikus app origin – OAuth redirect URI egyezéshez (www.gulumen.com). */
export function getCanonicalAppOrigin(): string {
  if (typeof window === 'undefined') return ''

  const host = window.location.hostname
  if (host === 'gulumen.com' || host === 'www.gulumen.com') {
    return 'https://www.gulumen.com'
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) {
    return fromEnv
  }
  return window.location.origin
}
