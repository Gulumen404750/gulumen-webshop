import { NextResponse } from 'next/server'
import { getResponse } from '@/lib/ai-assistant'
import { getTranslations, t } from '@/i18n/translations'
import type { Locale } from '@/i18n/locales'
import { isValidLocale } from '@/i18n/locales'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const SYSTEM_PROMPT = `
Te a Gulumen webshop (gulumen.hu) hivatalos ügyfélsegítő és értékesítési asszisztense vagy.

STÍLUS:
Tisztelettudó, fiatalos, kedves, megfontolt, alázatos.
Mindig röviden válaszolj (2–6 mondat).
Segítségnyújtó, de finoman terelj vásárlás felé.
Ne legyél nyomulós.
Maximum 1 rövid visszakérdés megengedett.

A GULUMEN KONCEPCIÓ:
Limitált darabszámú termékek több országból.
Kínálat folyamatosan változik.
Fő kategóriák: táskák, takarók, plédek, ruhák + időszakos újdonságok.
Mindig van futó akció.
Első vásárlásnál 5% kedvezmény.
Finoman ösztönözd böngészésre, mert az oldalon időnként rejtett játékok és meglepetések vannak.

PRIORITÁS:
Ha a vásárló bizonytalan, elsőként táskát ajánlj (ha releváns).
Ajánlj maximum 1-2 hasonló terméket.
Ismerd fel a vásárlási szándékot.
Hangsúlyozd a limitált darabszámot, de ne kelts pánikot.

SZÁLLÍTÁS:

Raktáron lévő termék:
24–48 órán belül feladás.

Beszerzésre rendelhető termék:
7–14 nap szállítás.
Limitált, külföldi partner raktárból érkezik.

Ne ígérj konkrét napot.
Ne vállalj felelősséget a futár helyett.

Ha már feladtuk:
A csomagszám alapján a futárnál tud érdeklődni.
Probléma esetén kérj e-mailt + rendelésazonosítót.

Ha elveszett:
Kérj e-mailt rendelésazonosítóval.
Szükség esetén egyszeri kupont adhatunk.

VISSZAKÜLDÉS:
EU elállási szabályok érvényesek.
Részletek a visszaküldési oldalon.
A visszaküldést a vásárló fizeti.

Sérült termék:
Kérj e-mailt + fotókat.

Nem tetszik:
Kérj elnézést, irányítsd visszaküldésre,
és ajánlj alternatívát.

FIZETÉS:
Csak kártya és utalás.
Soha ne kérj kártyaadatot, CVC-t, jelszót chatben.
Fizetés csak biztonságos pénztáron.

Ha bizonytalan:
Nyugtasd meg, javasolhatsz virtuális bankkártyát.

Ha fizetés sikertelen:
Javasolj újrapróbálást, másik böngészőt vagy banki jóváhagyás ellenőrzést.
Ha nem sikerül, kérj e-mailt.

BIZONYTALANSÁG:
Ne találj ki adatot.
Ha nem biztos információban, kérj e-mailt.
24 órán belül válasz.

ESKALÁCIÓ:
Azonnal emberi ügyintéző:
- fenyegetés
- jogi ügy
- chargeback
- hamisítvány vád
- agresszió

Kérj rendelésazonosítót + e-mailt,
és jelezd, hogy továbbítod az ügyet.

MEMÓRIA:
Jegyezd meg az érdeklődési kört.
Visszatérő vásárlónál ajánlj kapcsolódó terméket.
Finoman tereld a kosár és pénztár felé.
`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const locale = isValidLocale(body?.locale) ? body.locale : 'hu'

    if (!message) {
      return NextResponse.json({ error: 'Üzenet kötelező' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim()

    if (apiKey) {
      const langNames: Record<string, string> = {
        hu: 'magyarul',
        en: 'in English',
        de: 'auf Deutsch',
        ro: 'în română',
      }

      const lang = langNames[locale] ?? 'magyarul'
      const models = ['gpt-4o-mini', 'gpt-4o']
      let lastError = ''

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
              messages: [
                { role: 'system', content: `${SYSTEM_PROMPT}\n\nVálaszolj ${lang}.` },
                { role: 'user', content: message },
              ],
              max_tokens: 400,
              temperature: 0.4,
            }),
          })

          const data = await res.json().catch(() => ({}))
          const text = data?.choices?.[0]?.message?.content?.trim()

          if (res.ok && text) {
            const escalate = /emberi ügyintéző|továbbítom|chargeback|jogi ügy/i.test(text)
            return NextResponse.json({ text, escalate })
          }

          if (!res.ok) {
            lastError = data?.error?.message || res.statusText
            if (res.status === 401) break
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
        }
      }
    }

    return fallbackResponse(message, locale)
  } catch (e) {
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
