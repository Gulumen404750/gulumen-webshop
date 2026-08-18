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
import {
  formatVisitorDateTimeAnswer,
  getAiVisitorDateTimeContext,
  getCountryCodeFromRequest,
  resolveVisitorLocalTime,
} from '@/lib/visitor-time'
import {
  buildProductChatContextBlock,
  loadChatProductContext,
} from '@/lib/chat-product-context'
import {
  buildRecommendedProductsChatBlock,
  searchProductsForChat,
  type ChatRecommendedProduct,
} from '@/lib/chat-product-search'
import { applyPointsCopyPlaceholders } from '@/lib/display-money'
import { fetchEuroToHufRate } from '@/lib/euro-rate'
import { formatChatAssistantText } from '@/lib/chat-message-format'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { getDismissedProductIdsByUser } from '@/lib/product-dismiss'
import {
  buildChatVisitorNameBlock,
  resolveChatVisitorDisplayName,
} from '@/lib/chat-visitor-name'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(request: Request) {
  const settings = await getChatSettingsFromDb()

  const limit = await rateLimit(request, { maxPerWindow: settings.rateLimitPerMinute })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }

  const MAX_MESSAGE_LENGTH = 2000
  const MAX_HISTORY_MESSAGES = 12
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const locale = isValidLocale(body?.locale) ? body.locale : 'hu'
    const timezone = typeof body?.timezone === 'string' ? body.timezone.trim() : ''
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const productSlug = typeof body?.productSlug === 'string' ? body.productSlug.trim() : ''
    const countryCode = getCountryCodeFromRequest(request)
    const visitorTime = { locale, timezone: timezone || null, countryCode }
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
    const session = await getSession(request)
    const chatUserId = session ? await resolveSessionUserId(session) : null
    const excludeProductIds = chatUserId ? await getDismissedProductIdsByUser(chatUserId) : []
    const recommendedProducts = await searchProductsForChat(message, { excludeProductIds })
    const productIds = recommendedProducts.map((p) => p.id)

    if (apiKey) {
      const langNames: Record<string, string> = {
        hu: 'magyarul',
        en: 'in English',
        de: 'auf Deutsch',
        ro: 'în română',
      }

      const lang = langNames[locale] ?? 'magyarul'
      const models = resolveOpenAiModels(settings.openaiModel)
      const nowContext = await getAiVisitorDateTimeContext(visitorTime)
      const product = await loadChatProductContext({
        productId: productId || null,
        productSlug: productSlug || null,
      })
      const productContext = product ? buildProductChatContextBlock(product) : ''
      const recommendationsContext = buildRecommendedProductsChatBlock(recommendedProducts)
      const visitorDisplayName = await resolveChatVisitorDisplayName(request)
      const visitorNameContext = buildChatVisitorNameBlock(visitorDisplayName)

      const openAiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        {
          role: 'system',
          content: [
            settings.systemPrompt,
            nowContext,
            visitorNameContext,
            productContext,
            recommendationsContext,
            `Válaszolj ${lang}.`,
          ]
            .filter(Boolean)
            .join('\n\n'),
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
            return chatJsonResponse({
              text: formatChatAssistantText(text),
              escalate,
              productIds,
              products: recommendedProducts,
            })
          }

          if (!res.ok && res.status === 401) break
        } catch {
          // próbáljuk a következő modellt
        }
      }
    }

    return fallbackResponse(message, locale, settings, visitorTime, recommendedProducts)
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

function chatJsonResponse(payload: {
  text: string
  escalate?: boolean
  productIds?: string[]
  products?: ChatRecommendedProduct[]
}) {
  const productIds = Array.isArray(payload.productIds)
    ? payload.productIds.filter((id) => typeof id === 'string' && id.length > 0).slice(0, 3)
    : []
  return NextResponse.json({
    text: formatChatAssistantText(payload.text),
    escalate: !!payload.escalate,
    ...(productIds.length > 0
      ? {
          productIds,
          products: (payload.products ?? []).filter((p) => productIds.includes(p.id)).slice(0, 3),
        }
      : {}),
  })
}

async function fallbackResponse(
  userMessage: string,
  locale: Locale,
  settings: ChatSettings,
  visitorTime: { locale: Locale; timezone: string | null; countryCode: string | null },
  recommendedProducts: ChatRecommendedProduct[] = []
) {
  const productIds = recommendedProducts.map((p) => p.id)
  if (isDateTimeQuestion(userMessage)) {
    const local = await resolveVisitorLocalTime(visitorTime)
    return chatJsonResponse({
      text: formatVisitorDateTimeAnswer(local, locale),
      escalate: false,
    })
  }
  const { textKey, escalate } = getResponse(userMessage)
  const rate = (await fetchEuroToHufRate()).rate
  if (textKey === 'ai.default') {
    const text = applyPointsCopyPlaceholders(
      getChatFallbackForLocale(settings, locale),
      locale,
      rate
    )
    return chatJsonResponse({ text, escalate, productIds, products: recommendedProducts })
  }
  const dict = getTranslations(locale)
  const text = applyPointsCopyPlaceholders(t(dict, textKey), locale, rate)
  return chatJsonResponse({ text, escalate, productIds, products: recommendedProducts })
}
