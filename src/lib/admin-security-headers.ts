/**
 * Biztonsági HTTP fejlécek (CSP, Permissions-Policy, stb.).
 */

export function buildContentSecurityPolicy(isDev = process.env.NODE_ENV !== 'production'): string {
  // Next.js webpack HMR / source maps developmentben eval-t használhat.
  const recaptchaHosts = 'https://www.google.com https://www.gstatic.com https://www.recaptcha.net'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://ajax.googleapis.com ${recaptchaHosts}`
    : `script-src 'self' 'unsafe-inline' https://ajax.googleapis.com ${recaptchaHosts}`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'self' https://www.google.com https://www.recaptcha.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()'

export function applySecurityHeaders(headers: Headers, isDev = process.env.NODE_ENV !== 'production'): void {
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin')
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  headers.set('Content-Security-Policy', buildContentSecurityPolicy(isDev))
  headers.set('Permissions-Policy', PERMISSIONS_POLICY)
}
