import type { Locale } from '@/i18n/locales'

const LANGUAGE_LOCK: Record<
  Locale,
  { name: string; instruction: string }
> = {
  hu: {
    name: 'magyar',
    instruction: 'Válaszolj KIZÁRÓLAG magyarul.',
  },
  en: {
    name: 'English',
    instruction: 'Reply in English only. Do not use Hungarian.',
  },
  de: {
    name: 'Deutsch',
    instruction: 'Antworte ausschließlich auf Deutsch. Verwende kein Ungarisch.',
  },
  ro: {
    name: 'română',
    instruction: 'Răspunde exclusiv în română. Nu folosi maghiara.',
  },
}

/**
 * Minden chat kérés elejére kerül: a weboldal aktuális locale-ja felülírja
 * a magyar kézikönyvet és a korábbi beszélgetés nyelvét.
 */
export function buildChatLanguageLock(locale: Locale): string {
  const lock = LANGUAGE_LOCK[locale]
  return `
[NYELV / LANGUAGE LOCK — HIGHEST PRIORITY]
Storefront UI locale: ${locale} (${lock.name}).
${lock.instruction}
Every customer-facing sentence MUST be in this language: greetings, apologies, product mentions, and labels such as “alternative”.
If earlier turns in this chat were in another language: IGNORE that and switch immediately to the current UI language.
Do not mix languages in one reply.
The rest of this system prompt may be written in Hungarian (internal handbook). That is NOT the customer language unless locale is hu.
`.trim()
}
