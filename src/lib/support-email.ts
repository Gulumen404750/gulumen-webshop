/**
 * Ügyfélszolgálati postafiók feloldása.
 *
 * Beérkező levelek (Reply-To, kapcsolat űrlap, admin rendelés-értesítő):
 * postmaster@gulumen.com (éles inbox).
 *
 * Prioritás: explicit support → publikus support → ADMIN_EMAIL → default.
 * (ADMIN_EMAIL ne írja felül a postmastert, ha nincs ORDER_SUPPORT_EMAIL.)
 */

export const DEFAULT_SUPPORT_INBOX = 'postmaster@gulumen.com'

function firstEmail(...candidates: Array<string | undefined | null>): string | null {
  for (const raw of candidates) {
    const v = raw?.trim()
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v
  }
  return null
}

/**
 * Beérkező ügyfélszolgálat: rendelés Reply-To, kapcsolat űrlap, admin paid értesítő.
 */
export function getSupportInboxEmail(): string {
  return (
    firstEmail(
      process.env.ORDER_SUPPORT_EMAIL,
      process.env.SUPPORT_INBOX_EMAIL,
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      process.env.NEXT_PUBLIC_LEGAL_EMAIL,
      process.env.ADMIN_EMAIL
    ) || DEFAULT_SUPPORT_INBOX
  )
}

/**
 * Weben megjelenő kapcsolat e-mail (mailto).
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

/** Régi, nem fogadó címek – ne ezeket használd beérkezőnek. */
export function isUnreliableInboundDomain(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return (
    normalized === 'info@gulumen.hu' ||
    normalized === 'info@gulumen.com' ||
    normalized === 'noreply@gulumen.com' ||
    normalized === 'noreply@gulumen.hu'
  )
}

export function warnIfSupportInboxUnreliable(email: string, context: string): void {
  if (!isUnreliableInboundDomain(email)) return
  console.warn(
    `[support-email] ${context}: "${email}" nem fogad levelet – ` +
      `használj ${DEFAULT_SUPPORT_INBOX}-ot (ORDER_SUPPORT_EMAIL).`
  )
}
