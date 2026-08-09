import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  getAiVisitorDateTimeContext,
  getCountryCodeFromRequest,
} from '@/lib/visitor-time'
import type { Locale } from '@/i18n/locales'
import { secureCompare } from '@/lib/secure-compare'

/**
 * POST /api/ai-voice
 * A voice agent minden user inputot ide küld; rövid (max 2-3 mondat) választ adunk.
 * Body: conversation_id, language (hu|en), message.
 * Response: { reply: string }
 * Biztonság: VOICE_AGENT_WEBHOOK_SECRET (Authorization: Bearer <secret> vagy x-api-key).
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const VOICE_SYSTEM_PROMPT = `Te a Gulumen webshop (gulumen.hu) telefonos AI asszisztense vagy. Válaszolj nagyon röviden, maximum 2-3 mondatban. Stílus: kedves, családias, közvetlen (tegeződő, de tisztelettudó), melegszívű – mintha egy kedves ismerős segítene. A Gulumen közvetlen, családias márka: praktikus, szerethető és hasznos kiegészítők a család minden tagjának, télen-nyáron. Fő üzenet: A te otthonod, a mi szívügyünk. Ne kérj kártyaadatot, jelszót. Ha nem tudod, ajánld a weboldalt vagy a visszahívást.`

function validateApiKey(request: Request): boolean {
  const secret = process.env.VOICE_AGENT_WEBHOOK_SECRET?.trim()
  if (!secret) return false
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return secureCompare(auth.slice(7), secret)
  return secureCompare(request.headers.get('x-api-key'), secret)
}

export async function POST(request: Request) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = await rateLimit(request)
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id.trim() : ''
    const language = typeof body?.language === 'string' && /^(hu|en)$/.test(body.language) ? body.language : 'hu'
    const message = typeof body?.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    const langInstruction = language === 'en' ? 'Reply in English only.' : 'Válaszolj csak magyarul.'
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    const locale: Locale = language === 'en' ? 'en' : 'hu'
    const nowContext = await getAiVisitorDateTimeContext({
      locale,
      timezone: typeof body?.timezone === 'string' ? body.timezone.trim() : null,
      countryCode: getCountryCodeFromRequest(request),
    })

    if (apiKey) {
      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `${VOICE_SYSTEM_PROMPT} ${langInstruction}\n\n${nowContext}`,
            },
            { role: 'user', content: message },
          ],
          max_tokens: 150,
          temperature: 0.4,
        }),
      })

      const data = await res.json().catch(() => ({}))
      const reply = data?.choices?.[0]?.message?.content?.trim()

      if (res.ok && reply) {
        return NextResponse.json({ reply })
      }
    }

    const fallbackHu = 'Köszönöm a üzeneted. Egy munkatársunk hamarosan felveszi a kapcsolatot. Addig böngészd a gulumen.hu oldalt.'
    const fallbackEn = 'Thank you for your message. A team member will get back to you soon. In the meantime, visit gulumen.hu.'
    const reply = language === 'en' ? fallbackEn : fallbackHu
    return NextResponse.json({ reply })
  } catch (e) {
    console.error('[ai-voice] Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
