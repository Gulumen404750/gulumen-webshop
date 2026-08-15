/**
 * Ügyfélszolgálati postafiók feloldása.
 *
 * Fontos: a gulumen.hu / gulumen.com domainnek jelenleg NINCS MX rekordja,
 * ezért az info@gulumen.hu címre küldött / Reply-To válaszok NEM érkeznek meg.
 * Beérkező levelekhez használd az ADMIN_EMAIL / ORDER_SUPPORT_EMAIL értékét
 * (pl. Gmail), amit ténylegesen olvasol.
 */

function firstEmail(...candidates: Array<string | undefined | null>): string | null {
  for (const raw of candidates) {
    const v = raw?.trim()
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v
  }
  return null
}

/**
 * Beérkező ügyfélszolgálat: rendelés Reply-To, kapcsolat űrlap címzettje.
 * Prioritás: explicit support → ADMIN_EMAIL (működő inbox) → publikus env → fallback.
 */
export function getSupportInboxEmail(): string {
  return (
    firstEmail(
      process.env.ORDER_SUPPORT_EMAIL,
      process.env.SUPPORT_INBOX_EMAIL,
      process.env.ADMIN_EMAIL,
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      process.env.NEXT_PUBLIC_LEGAL_EMAIL
    ) || 'info@gulumen.hu'
  )
}

/**
 * Weben megjelenő kapcsolat e-mail (mailto).
 * Ne tegye ki az ADMIN_EMAIL-t, ha van külön publikus cím.
 */
export function getPublicSupportEmail(): string {
  return (
    firstEmail(
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
      process.env.NEXT_PUBLIC_LEGAL_EMAIL,
      process.env.ORDER_SUPPORT_EMAIL,
      process.env.SUPPORT_INBOX_EMAIL
    ) || 'info@gulumen.hu'
  )
}

/** Domainek, ahol jelenleg nincs megbízható bejövő MX (Resend csak küld). */
export function isUnreliableInboundDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return domain === 'gulumen.hu' || domain === 'gulumen.com'
}

export function warnIfSupportInboxUnreliable(email: string, context: string): void {
  if (!isUnreliableInboundDomain(email)) return
  console.warn(
    `[support-email] ${context}: "${email}" domainnek nincs megbízható bejövő MX – ` +
      'állítsd be az ORDER_SUPPORT_EMAIL vagy ADMIN_EMAIL változót egy olvasott postafiókra (pl. Gmail).'
  )
}
