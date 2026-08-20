/**
 * Biztonsági HTTP fejlécek (CSP, Permissions-Policy, stb.).
 * Production: script-src nonce + strict-dynamic — nincs 'unsafe-inline' / 'unsafe-eval'.
 * Next.js 14 App Router a kérés CSP-jéből olvassa a nonce-t a saját scripteire.
 */

export const CSP_NONCE_HEADER = 'x-nonce'

const RECAPTCHA_SCRIPT_HOSTS = 'https://www.google.com https://www.gstatic.com https://www.recaptcha.net'
const SCRIPT_HOSTS = `https://ajax.googleapis.com ${RECAPTCHA_SCRIPT_HOSTS} https://www.googletagmanager.com`
/** NextAuth Google OAuth: form POST → 302 accounts.google.com (form-action ellenőrzi a redirect célját). */
const GOOGLE_OAUTH_FORM_ACTION = 'https://accounts.google.com'

/** Per-request CSP nonce (Edge-safe). */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function buildContentSecurityPolicy(
  isDev = process.env.NODE_ENV !== 'production',
  nonce?: string
): string {
  let scriptSrc: string
  if (isDev) {
    // Next.js webpack HMR / source maps developmentben eval-t és inline scripteket használhat.
    scriptSrc = `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_HOSTS}`
  } else if (nonce) {
    scriptSrc = `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' ${SCRIPT_HOSTS}`
  } else {
    scriptSrc = `script-src 'self' ${SCRIPT_HOSTS}`
  }

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' blob:",
    "frame-src 'self' https://www.google.com https://www.recaptcha.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' ${GOOGLE_OAUTH_FORM_ACTION}`,
    "object-src 'none'",
    ...(!isDev ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

/** QR scanner (camera) and chat voice input (microphone) are same-origin only. */
export const PERMISSIONS_POLICY =
  'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()'

export function applySecurityHeaders(
  headers: Headers,
  isDev = process.env.NODE_ENV !== 'production',
  nonce?: string
): void {
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin')
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  headers.set('Content-Security-Policy', buildContentSecurityPolicy(isDev, nonce))
  headers.set('Permissions-Policy', PERMISSIONS_POLICY)
}
