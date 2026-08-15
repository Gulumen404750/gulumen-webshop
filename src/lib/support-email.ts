/**
 * Ügyfélszolgálati postafiók feloldása.
 *
 * Admin értesítők (új rendelés / címmódosítás): KIZÁRÓLAG postmaster@gulumen.com.
 * (1.dani@gmail.com és egyéb ADMIN_EMAIL címek szándékosan kihagyva.)
 */

export const DEFAULT_SUPPORT_INBOX = 'postmaster@gulumen.com'

/** Soha ne kapjon automatikus admin / rendelés értesítőt. */
const BLOCKED_ADMIN_NOTIFY_EMAILS = new Set([
  '1.dani@gmail.com',
  'dani@gmail.com',
])

function firstEmail(...candidates: Array<string | undefined | null>): string | null {
  for (const raw of candidates) {
    const v = raw?.trim()
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v
  }
  return null
}

function normalizeEmail(raw: string | undefined | null): string | null {
  const v = raw?.trim().toLowerCase()
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null
  return v
}

/**
 * gulumen.com / gulumen.hu – nincs publikus MX → bejövő levél elveszik.
 * (Resend csak küldeni tud ezekről a domainekről, fogadni nem.)
 */
export function isUnreliableInboundDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return domain === 'gulumen.hu' || domain === 'gulumen.com'
}

export function isBlockedAdminNotifyEmail(email: string): boolean {
  return BLOCKED_ADMIN_NOTIFY_EMAILS.has(email.trim().toLowerCase())
}

/**
 * Beérkező ügyfélszolgálat: kapcsolat űrlap Reply-To, vásárlói válaszok.
 * Preferáld a postmastert; megbízható Gmail csak ha nem tiltott.
 */
export function getSupportInboxEmail(): string {
  const candidates = [
    process.env.ORDER_SUPPORT_EMAIL,
    process.env.SUPPORT_INBOX_EMAIL,
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    process.env.NEXT_PUBLIC_LEGAL_EMAIL,
    DEFAULT_SUPPORT_INBOX,
  ]
  for (const raw of candidates) {
    const v = raw?.trim()
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) continue
    if (isBlockedAdminNotifyEmail(v)) continue
    // Prefer explicit postmaster / ORDER_SUPPORT even on gulumen.com
    if (v.toLowerCase() === DEFAULT_SUPPORT_INBOX) return v
    if (!isUnreliableInboundDomain(v)) return v
  }
  return DEFAULT_SUPPORT_INBOX
}

/**
 * Admin értesítő címzettek (új rendelés, címmódosítás).
 * Kizárólag postmaster@gulumen.com – ADMIN_EMAIL / 1.dani@gmail.com NEM.
 */
export function getAdminNotificationEmails(): string[] {
  return [DEFAULT_SUPPORT_INBOX]
}

/**
 * Weben megjelenő kapcsolat e-mail (mailto megjelenítés).
 */
export function getPublicSupportEmail(): string {
  return (
    firstEmail(
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      process.env.NEXT_PUBLIC_LEGAL_EMAIL,
      process.env.ORDER_SUPPORT_EMAIL,
      process.env.SUPPORT_INBOX_EMAIL
    ) || DEFAULT_SUPPORT_INBOX
  )
}

export function warnIfSupportInboxUnreliable(email: string, context: string): void {
  if (!isUnreliableInboundDomain(email)) return
  console.warn(
    `[support-email] ${context}: "${email}" domainnek NINCS MX rekordja – ` +
      'a levelek nem érkezhetnek meg fogadó MX nélkül. ' +
      'Resend küldés postmaster@gulumen.com-ra továbbra is megy (küldő oldalon).'
  )
}

/** Legacy kapcsolat űrlap URL – ne használd új CTA-hoz. */
export function buildOrderChangeContactUrl(contactUrl: string, orderRef: string): string {
  const sep = contactUrl.includes('?') ? '&' : '?'
  return `${contactUrl}${sep}rendeles=${encodeURIComponent(orderRef)}&tipus=modositas`
}

/**
 * Önkiszolgáló szállítási cím módosító URL (visszaigazoló e-mail CTA).
 * Tokenes link: bejelentkezés nélkül is szerkeszthető.
 * Pl. https://www.gulumen.com/rendelesek/ord_xxx/modositas?t=TOKEN
 */
export function buildOrderShippingEditUrl(
  orderId: string,
  options?: { appUrl?: string; token?: string | null }
): string {
  const base = (
    options?.appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.gulumen.com'
  ).replace(/\/$/, '')
  const id = orderId.trim()
  const url = `${base}/rendelesek/${encodeURIComponent(id)}/modositas`
  const token = options?.token?.trim()
  if (!token) return url
  return `${url}?t=${encodeURIComponent(token)}`
}
