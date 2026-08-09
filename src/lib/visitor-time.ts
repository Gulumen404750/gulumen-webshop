/**
 * Látogató ország / nyelv / böngésző időzóna → pontos helyi dátum az AI-nak.
 */
import type { Locale } from '@/i18n/locales'
import { getServerTimeMs } from '@/lib/server-time'

export type VisitorTimeInput = {
  locale: Locale
  /** IANA timezone a böngészőből, pl. Europe/Berlin */
  timezone?: string | null
  /** ISO országkód (DE, HU, GB…), ha a edge/CDN adja */
  countryCode?: string | null
}

type ResolvedVisitorTime = {
  timeZone: string
  countryCode: string | null
  countryLabel: string
  localeTag: string
  human: string
  compact: string
  source: 'browser' | 'country' | 'locale'
}

const LOCALE_TIMEZONE: Record<Locale, string> = {
  hu: 'Europe/Budapest',
  de: 'Europe/Berlin',
  en: 'Europe/London',
  ro: 'Europe/Bucharest',
}

const LOCALE_TAG: Record<Locale, string> = {
  hu: 'hu-HU',
  de: 'de-DE',
  en: 'en-GB',
  ro: 'ro-RO',
}

const COUNTRY_TIMEZONE: Record<string, string> = {
  HU: 'Europe/Budapest',
  DE: 'Europe/Berlin',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  LI: 'Europe/Zurich',
  GB: 'Europe/London',
  UK: 'Europe/London',
  IE: 'Europe/Dublin',
  RO: 'Europe/Bucharest',
  SK: 'Europe/Bratislava',
  CZ: 'Europe/Prague',
  PL: 'Europe/Warsaw',
  NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels',
  FR: 'Europe/Paris',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  DK: 'Europe/Copenhagen',
  FI: 'Europe/Helsinki',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
}

const COUNTRY_LABEL: Record<string, string> = {
  HU: 'Hungary',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  IE: 'Ireland',
  RO: 'Romania',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  PL: 'Poland',
  CZ: 'Czechia',
  SK: 'Slovakia',
}

const LOCALE_COUNTRY_LABEL: Record<Locale, string> = {
  hu: 'Hungary',
  de: 'Germany',
  en: 'United Kingdom',
  ro: 'Romania',
}

export function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

/** Országkód kinyerése request headerekből (Cloudflare / Vercel / generic). */
export function getCountryCodeFromRequest(request: Request): string | null {
  const headers = request.headers
  const raw =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code') ||
    headers.get('cloudfront-viewer-country') ||
    ''
  const code = raw.trim().toUpperCase()
  if (!code || code === 'XX' || code === 'T1' || code.length !== 2) return null
  return code
}

export function resolveVisitorTimeZone(input: VisitorTimeInput): {
  timeZone: string
  countryCode: string | null
  countryLabel: string
  source: ResolvedVisitorTime['source']
} {
  const countryCode = input.countryCode?.trim().toUpperCase() || null
  const browserTz = input.timezone?.trim() || ''

  if (browserTz && isValidIanaTimeZone(browserTz)) {
    return {
      timeZone: browserTz,
      countryCode,
      countryLabel:
        (countryCode && COUNTRY_LABEL[countryCode]) ||
        LOCALE_COUNTRY_LABEL[input.locale] ||
        browserTz,
      source: 'browser',
    }
  }

  if (countryCode && COUNTRY_TIMEZONE[countryCode]) {
    return {
      timeZone: COUNTRY_TIMEZONE[countryCode],
      countryCode,
      countryLabel: COUNTRY_LABEL[countryCode] || countryCode,
      source: 'country',
    }
  }

  return {
    timeZone: LOCALE_TIMEZONE[input.locale] || 'Europe/Budapest',
    countryCode,
    countryLabel: LOCALE_COUNTRY_LABEL[input.locale],
    source: 'locale',
  }
}

export async function resolveVisitorLocalTime(
  input: VisitorTimeInput
): Promise<ResolvedVisitorTime> {
  const resolved = resolveVisitorTimeZone(input)
  const ms = await getServerTimeMs()
  const d = new Date(ms)
  const localeTag = LOCALE_TAG[input.locale] || 'hu-HU'

  const human = new Intl.DateTimeFormat(localeTag, {
    timeZone: resolved.timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)

  const compact = new Intl.DateTimeFormat('sv-SE', {
    timeZone: resolved.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)

  return {
    ...resolved,
    localeTag,
    human,
    compact,
  }
}

/** System prompt blokk: helyi idő + szállítási dátumok a látogató órájához. */
export async function getAiVisitorDateTimeContext(input: VisitorTimeInput): Promise<string> {
  const local = await resolveVisitorLocalTime(input)

  return [
    `LÁTOGATÓ HELYE / IDŐZÓNA:`,
    `- Ország (becslés): ${local.countryLabel}${local.countryCode ? ` (${local.countryCode})` : ''}`,
    `- Időzóna: ${local.timeZone} (forrás: ${local.source})`,
    `- Aktuális helyi idő: ${local.human}`,
    `- Kompakt: ${local.compact}`,
    '',
    `SZABÁLYOK AZ IDŐHÖZ:`,
    `- Ha dátumot / napot / órát kérdeznek, CSAK ezt a helyi időt mondd (a látogató országának óráját).`,
    `- Német látogatónál német időt, angolnál UK/böngésző időt, magyarnál budapestit, románnál bukarestit – a fenti időzóna szerint.`,
    `- Ne találj ki más időt, és ne mondd, hogy nem tudod.`,
    '',
    `SZÁLLÍTÁS / CSOMAG ÉRKEZÉS:`,
    `- A webshop Magyarországról ad fel (feladás általában fizetés után 24–48 órán belül munkanapokon).`,
    `- EU-n belül tipikus futáridő feladás után kb. 2–5 munkanap (becslés, nem garancia).`,
    `- Ha megkérdezik „mikor érkezik”, számolj a fenti HELYI dátummal: mondj hozzávetőleges napokat a látogató időzónájában (pl. „várhatóan jövő szerda körül a te időd szerint”), és jelezd, hogy ez becslés, a futár dönt.`,
    `- Ne ígérj pontos órára érkezést, és ne vállalj felelősséget a futár helyett.`,
  ].join('\n')
}

export function formatVisitorDateTimeAnswer(
  local: ResolvedVisitorTime,
  locale: Locale
): string {
  if (locale === 'en') {
    return `Right now in your local time (${local.countryLabel}, ${local.timeZone}) it is ${local.human}.`
  }
  if (locale === 'de') {
    return `Aktuell bei dir vor Ort (${local.countryLabel}, ${local.timeZone}): ${local.human}.`
  }
  if (locale === 'ro') {
    return `Acum la tine local (${local.countryLabel}, ${local.timeZone}): ${local.human}.`
  }
  return `Most a te helyi időd szerint (${local.countryLabel}, ${local.timeZone}): ${local.human}.`
}
