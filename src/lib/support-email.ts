/**
 * Ügyfélszolgálati postafiók feloldása.
 *
 * - Publikus megjelenítés: postmaster@gulumen.com
 * - Beérkező (Reply-To, kapcsolat): ha van megbízható ADMIN_EMAIL (pl. Gmail), azt használjuk,
 *   mert a gulumen.com-nak jelenleg nincs MX → a postmasterre küldött levelek elveszhetnek.
 * - Admin értesítők (új rendelés / címmódosítás): postmaster + megbízható ADMIN_EMAIL (külön küldés).
 */

export const DEFAULT_SUPPORT_INBOX = 'postmaster@gulumen.com'

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

/**
 * Beérkező ügyfélszolgálat: kapcsolat űrlap Reply-To, vásárlói válaszok.
 * Előnyben a megbízható inbox (ADMIN_EMAIL / Gmail); gulumen.* kihagyva MX nélkül.
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
 * Admin értesítő címzettek (új rendelés másolat, címmódosítás figyelmeztetés, kapcsolat).
 * Mindig tartalmazza a postmaster@gulumen.com-ot (üzleti elvárás),
 * plusz minden megbízható ADMIN / ORDER_SUPPORT címet (MX nélküli domainek mellett is megérkezzen).
 */
export function getAdminNotificationEmails(): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  const push = (raw: string | undefined | null) => {
    const email = normalizeEmail(raw)
    if (!email || seen.has(email)) return
    seen.add(email)
    out.push(email)
  }

  // Üzleti elvárás: admin másolat a postmasterre.
  push(DEFAULT_SUPPORT_INBOX)
  push(process.env.ORDER_SUPPORT_EMAIL)
  push(process.env.SUPPORT_INBOX_EMAIL)
  push(process.env.ADMIN_EMAIL)

  // Ha csak unreliable címek vannak, legalább a postmaster menjen ki (log + Resend attempt).
  if (out.length === 0) push(DEFAULT_SUPPORT_INBOX)

  const reliable = out.filter((e) => !isUnreliableInboundDomain(e))
  if (reliable.length === 0) {
    console.warn(
      '[support-email] getAdminNotificationEmails: csak gulumen.* címzettek – ' +
        'állítsd az ADMIN_EMAIL-t Gmailre, amíg a gulumen.com MX nincs beállítva. Címzettek:',
      out.join(', ')
    )
  }

  return out
}

/**
 * Weben megjelenő kapcsolat e-mail (mailto megjelenítés).
 * Megjelenhet postmaster – de a tényleges kézbesítés getSupportInboxEmail() / getAdminNotificationEmails().
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

/** Kapcsolat űrlap URL rendelésszámmal (e-mail CTA – legacy). */
export function buildOrderChangeContactUrl(contactUrl: string, orderRef: string): string {
  const sep = contactUrl.includes('?') ? '&' : '?'
  return `${contactUrl}${sep}rendeles=${encodeURIComponent(orderRef)}&tipus=modositas`
}

/**
 * Önkiszolgáló szállítási cím módosító URL (visszaigazoló e-mail CTA).
 * Pl. https://www.gulumen.com/rendelesek/ord_xxx/modositas
 */
export function buildOrderShippingEditUrl(orderId: string, appUrl?: string): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://www.gulumen.com').replace(
    /\/$/,
    ''
  )
  const id = orderId.trim()
  return `${base}/rendelesek/${encodeURIComponent(id)}/modositas`
}
