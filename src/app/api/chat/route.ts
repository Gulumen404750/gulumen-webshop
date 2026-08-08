import { NextResponse } from 'next/server'
import { getResponse } from '@/lib/ai-assistant'
import { getTranslations, t } from '@/i18n/translations'
import type { Locale } from '@/i18n/locales'
import { isValidLocale } from '@/i18n/locales'
import { rateLimit } from '@/lib/rate-limit'
import { hashClientIp, logChatQuestion } from '@/lib/chat-log'
import {
  getChatSettingsFromDb,
  getChatFallbackForLocale,
  resolveOpenAiModels,
  type ChatSettings,
} from '@/lib/chat-settings'
import { getAiDateTimeContext, getServerTimeMs } from '@/lib/server-time'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(request: Request) {
  const settings = await getChatSettingsFromDb()

  const limit = rateLimit(request, { maxPerWindow: settings.rateLimitPerMinute })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }

  const MAX_MESSAGE_LENGTH = 2000
  const MAX_HISTORY_MESSAGES = 12
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const locale = isValidLocale(body?.locale) ? body.locale : 'hu'
    const history = Array.isArray(body?.messages)
      ? body.messages
          .filter((m: unknown) => m && typeof m === 'object' && 'role' in m && 'text' in m)
          .slice(-MAX_HISTORY_MESSAGES)
          .map((m: { role: string; text: string }) => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: String(m.text).slice(0, MAX_MESSAGE_LENGTH),
          }))
      : []

    if (!message) {
      return NextResponse.json({ error: 'Üzenet kötelező' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Túl hosszú üzenet' }, { status: 400 })
    }

    const ipHash = hashClientIp(request)
    void logChatQuestion({ question: message, locale, ipHash })

    const apiKey = process.env.OPENAI_API_KEY?.trim()

    if (apiKey) {
      const langNames: Record<string, string> = {
        hu: 'magyarul',
        en: 'in English',
        de: 'auf Deutsch',
        ro: 'în română',
      }

      const lang = langNames[locale] ?? 'magyarul'
      const models = resolveOpenAiModels(settings.openaiModel)
      const nowContext = await getAiDateTimeContext()

      const openAiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        {
          role: 'system',
          content: `${settings.systemPrompt}\n\n${nowContext}\n\nVálaszolj ${lang}.`,
        },
        ...history,
        { role: 'user', content: message },
      ]

      for (const model of models) {
        try {
          const res = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: openAiMessages,
              max_tokens: 400,
              temperature: 0.65,
            }),
          })

          const data = await res.json().catch(() => ({}))
          const text = data?.choices?.[0]?.message?.content?.trim()

          if (res.ok && text) {
            const escalate = /emberi ügyintéző|továbbítom|chargeback|jogi ügy/i.test(text)
            return NextResponse.json({ text, escalate })
          }

          if (!res.ok && res.status === 401) break
        } catch {
          // próbáljuk a következő modellt
        }
      }
    }

    return fallbackResponse(message, locale, settings)
  } catch {
    return NextResponse.json(
      { error: 'A válasz generálása sikertelen. Próbáld újra.' },
      { status: 500 }
    )
  }
}

function isDateTimeQuestion(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    /\b(hányadika|hányadikán|milyen nap|mi a dátum|hány óra|mennyi az idő|mi az idő|hány perc)\b/i.test(
      msg
    ) ||
    /\b(what (day|date|time)|current (date|time)|what'?s the (date|time))\b/i.test(msg) ||
    /\b(welcher tag|welches datum|wie spät|uhrzeit)\b/i.test(msg) ||
    /\b(ce dată|ce zi|cât e ceasul|ora exactă)\b/i.test(msg)
  )
}

async function answerDateTimeQuestion(locale: Locale): Promise<string> {
  const ms = await getServerTimeMs()
  const d = new Date(ms)
  const localeTag =
    locale === 'en' ? 'en-GB' : locale === 'de' ? 'de-DE' : locale === 'ro' ? 'ro-RO' : 'hu-HU'
  const formatted = new Intl.DateTimeFormat(localeTag, {
    timeZone: 'Europe/Budapest',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)

  if (locale === 'en') {
    return `Right now in Budapest it is ${formatted}.`
  }
  if (locale === 'de') {
    return `Aktuell in Budapest: ${formatted}.`
  }
  if (locale === 'ro') {
    return `Acum la Budapesta este ${formatted}.`
  }
  return `Most Budapesten: ${formatted}.`
}

async function fallbackResponse(userMessage: string, locale: Locale, settings: ChatSettings) {
  if (isDateTimeQuestion(userMessage)) {
    return NextResponse.json({ text: await answerDateTimeQuestion(locale), escalate: false })
  }
  const { textKey, escalate } = getResponse(userMessage)
  if (textKey === 'ai.default') {
    const text = getChatFallbackForLocale(settings, locale)
    return NextResponse.json({ text, escalate })
  }
  const dict = getTranslations(locale)
  const text = t(dict, textKey)
  return NextResponse.json({ text, escalate })
}
