import { NextResponse } from 'next/server'
import { getResponse } from '@/lib/ai-assistant'
import { getTranslations } from '@/i18n/translations'
import { t } from '@/i18n/translations'
import type { Locale } from '@/i18n/locales'
import { isValidLocale } from '@/i18n/locales'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const SYSTEM_PROMPT = `Te a Gulumen webshop (gulumen.hu) ügyfélsegítő asszisztense vagy.
Válaszolj röviden, barátságosan, a vásárlók kérdéseire.
Témák: termékek, árak, szállítás (24–48 óra, ingyenes 25 000 Ft felett), visszaküldés, fizetés (kártya, csak a biztonságos pénztár oldalon), kupon/regisztráció.
Soha ne kérj kártyaszámot, jelszót vagy személyi adatot a chatben.
Ha jogi fenyegetés, agresszió vagy hamisítvány vád merül fel, jelezd, hogy átadod emberi ügyintézőnek, és kérj e-mailt/rendelés azonosítót.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const locale = isValidLocale(body?.locale) ? body.locale : 'hu'

    if (!message) {
      return NextResponse.json({ error: 'Üzenet kötelező' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (apiKey) {
      const langNames: Record<string, string> = {
        hu: 'magyarul',
        en: 'in English',
        de: 'auf Deutsch',
        ro: 'în română',
      }
      const lang = langNames[locale] ?? 'magyarul'

      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n\nVálaszolj mindig ${lang}.` },
            { role: 'user', content: message },
          ],
          max_tokens: 400,
          temperature: 0.5,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('OpenAI API error:', res.status, err)
        return fallbackResponse(message, locale)
      }

      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content?.trim()
      if (text) {
        const escalate = /átadom emberi|forward|ügyintéző|human agent/i.test(text)
        return NextResponse.json({ text, escalate })
      }
    }

    return fallbackResponse(message, locale)
  } catch (e) {
    console.error('Chat API error:', e)
    return NextResponse.json(
      { error: 'A válasz generálása sikertelen. Próbáld újra.' },
      { status: 500 }
    )
  }
}

function fallbackResponse(userMessage: string, locale: Locale) {
  const { textKey, escalate } = getResponse(userMessage)
  const dict = getTranslations(locale)
  const text = t(dict, textKey)
  return NextResponse.json({ text, escalate })
}
