import type { Locale } from '@/i18n/locales'
import { DEFAULT_LOCALE, STORAGE_KEY, isValidLocale } from '@/i18n/locales'

const LANGUAGE_LOCK: Record<
  Locale,
  { name: string; instruction: string; sample: string }
> = {
  hu: {
    name: 'magyar',
    instruction: 'Válaszolj KIZÁRÓLAG magyarul.',
    sample: 'Szia! Miben segíthetek?',
  },
  en: {
    name: 'English',
    instruction: 'Reply in English only. Do not use Hungarian.',
    sample: 'Hi! How can I help?',
  },
  de: {
    name: 'Deutsch',
    instruction: 'Antworte ausschließlich auf Deutsch. Verwende kein Ungarisch.',
    sample: 'Hallo! Wobei kann ich helfen?',
  },
  ro: {
    name: 'română',
    instruction: 'Răspunde exclusiv în română. Nu folosi maghiara.',
    sample: 'Bună! Cu ce te pot ajuta?',
  },
}

const HU_PROSE =
  /\b(szia|persze|sajnos|neked|miben|segíthetek|segithetek|íme|ime|szívesen|szivesen|kínálat|kinalat|keresel|ajánlani|ajanlani|terméket|termeket|pontosan ilyen|hozzá illő|hozza illo)\b/i

/**
 * A weboldal locale-ja (body, majd süti). Hiányzó/érvénytelen érték → hu.
 */
export function resolveChatLocale(bodyLocale: unknown, request: Request): Locale {
  if (typeof bodyLocale === 'string' && isValidLocale(bodyLocale)) return bodyLocale
  const cookie = request.headers.get('cookie')
  if (cookie) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${STORAGE_KEY}=([^;]+)`))
    const value = match?.[1]?.trim()
    if (value && isValidLocale(value)) return value
  }
  return DEFAULT_LOCALE
}

/** Rövid köszönés: ne hívjuk az OpenAI-t magyar „Szia!” sémával. */
export function isCasualChatGreeting(message: string): boolean {
  return /^(szia|hello|hi+|hy+|hey|hallo|servus|ciao|bun[aă]|moin)[\s!.,]*$/i.test(
    message.trim()
  )
}

/**
 * Magyar kézikönyv + magyar vásárlói szöveg mellett a modell gyakran HU-ul válaszol.
 * Ha a felület nem magyar, ez a válasz hibás.
 */
export function assistantReplyIgnoresLocale(text: string, locale: Locale): boolean {
  if (locale === 'hu') return false
  const sample = text.slice(0, 400)
  const markerHits = sample.match(HU_PROSE)
  return /[őűŐŰ]/.test(sample) || (markerHits != null && markerHits.length >= 2)
}

export function wrapUserMessageForLocale(message: string, locale: Locale): string {
  const lock = LANGUAGE_LOCK[locale]
  return `[Storefront UI locale: ${locale}. ${lock.instruction} The customer may type another language; still reply in ${lock.name}.]\n\n${message}`
}

/**
 * Minden chat kérés elejére és a user üzenet UTÁN is bekerül:
 * a weboldal aktuális locale-ja felülírja a magyar kézikönyvet.
 */
export function buildChatLanguageLock(locale: Locale): string {
  const lock = LANGUAGE_LOCK[locale]
  return `
[NYELV / LANGUAGE LOCK — HIGHEST PRIORITY]
Storefront UI locale: ${locale} (${lock.name}).
${lock.instruction}
Customer-facing sentences MUST be in ${lock.name}: greetings, apologies, product mentions, and the word for “alternative”.
If the customer wrote Hungarian (or any other language): still answer in ${lock.name}.
If earlier turns were in another language: IGNORE them and switch now.
Do not mix languages in one reply.
Do NOT copy Hungarian handbook examples such as “Szia!” unless locale is hu.
Opening tone example in the required language: “${lock.sample}”
The rest of this prompt may be Hungarian (internal handbook). That is NOT the customer language unless locale is hu.
`.trim()
}
