/**
 * Ügyfélszolgálati postafiók feloldása.
 *
 * FONTOS: a gulumen.com / gulumen.hu domainnek jelenleg NINCS MX rekordja,
 * ezért a postmaster@gulumen.com / info@gulumen.* címekre NEM érkezik levél.
 * Beérkező (Reply-To, kapcsolat űrlap, admin értesítő): ADMIN_EMAIL
 * (vagy más, valódi fogadó cím, pl. Gmail).
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
 * gulumen.com / gulumen.hu – nincs publikus MX → bejövő levél elveszik.
 * (Resend csak küldeni tud ezekről a domainekről, fogadni nem.)
 */
export function isUnreliableInboundDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return domain === 'gulumen.hu' || domain === 'gulumen.com'
}

/**
 * Beérkező ügyfélszolgálat: kapcsolat űrlap, Reply-To, admin paid értesítő.
 * Kihagyja a gulumen.* címeket (nincs MX), előnyben az ADMIN_EMAIL / Gmail.
 */
export function getSupportInboxEmail(): string {
  const candidates = [
    process.env.ORDER_SUPPORT_EMAIL,
    process.env.SUPPORT_INBOX_EMAIL,
    process.env.ADMIN_EMAIL,
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    process.env.NEXT_PUBLIC_LEGAL_EMAIL,
  ]
  for (const raw of candidates) {
    const v = raw?.trim()
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !isUnreliableInboundDomain(v)) {
      return v
    }
  }
  const fallback = firstEmail(process.env.ADMIN_EMAIL) || DEFAULT_SUPPORT_INBOX
  warnIfSupportInboxUnreliable(fallback, 'getSupportInboxEmail fallback')
  return fallback
}

/**
 * Weben megjelenő kapcsolat e-mail (mailto megjelenítés).
 * Megjelenhet postmaster – de a tényleges kézbesítés getSupportInboxEmail().
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
      'a levelek nem érkeznek meg. Állítsd az ADMIN_EMAIL / ORDER_SUPPORT_EMAIL változót ' +
      'egy valódi fogadó címre (pl. Gmail), amíg a gulumen.com MX nincs beállítva.'
  )
}

/** Kapcsolat űrlap URL rendelésszámmal (e-mail CTA). */
export function buildOrderChangeContactUrl(contactUrl: string, orderRef: string): string {
  const sep = contactUrl.includes('?') ? '&' : '?'
  return `${contactUrl}${sep}rendeles=${encodeURIComponent(orderRef)}&tipus=modositas`
}
