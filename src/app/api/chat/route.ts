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

      const openAiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: `${settings.systemPrompt}\n\nVálaszolj ${lang}.` },
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

function fallbackResponse(userMessage: string, locale: Locale, settings: ChatSettings) {
  const { textKey, escalate } = getResponse(userMessage)
  if (textKey === 'ai.default') {
    const text = getChatFallbackForLocale(settings, locale)
    return NextResponse.json({ text, escalate })
  }
  const dict = getTranslations(locale)
  const text = t(dict, textKey)
  return NextResponse.json({ text, escalate })
}
