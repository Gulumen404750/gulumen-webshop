/**
 * POST /api/admin/translate-draft
 * AI fordítás mentés nélkül (új terméknél): magyar szöveg → EN, DE, RO.
 * Body: { type: 'names' | 'description', text: string }
 * Returns: { nameEn, nameDe, nameRo } or { descriptionEn, descriptionDe, descriptionRo }
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) {
    return NextResponse.json(
      { error: 'Nincs admin jogosultság. Jelentkezz be az Admin belépés oldalon.' },
      { status: 401 }
    )
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY nincs beállítva. Az AI fordítás nem érhető el.' },
      { status: 503 }
    )
  }

  let body: { type?: string; text?: string }
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Érvénytelen kérés' }, { status: 400 })
  }

  const type = body?.type === 'names' || body?.type === 'description' ? body.type : null
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!type || !text) {
    return NextResponse.json(
      { error: 'Küldd: { type: "names" vagy "description", text: "magyar szöveg" }' },
      { status: 400 }
    )
  }

  const isNames = type === 'names'
  const prompt = isNames
    ? `A következő magyar webshop terméknevet fordítsd le természetes, folyékony angolra, románra és németre. Egy rövid terméknév (pl. 1-5 szó), webshopra illő. Csak érvényes JSON-t adj vissza, semmi egyéb szöveget:
{"nameEn": "angol név", "nameRo": "román név", "nameDe": "német név"}

Magyar név:
${text}`
    : `A következő magyar webshop termékleírást fordítsd le természetes, folyékony angolra, románra és németre. Webshopra illő, olvasható szöveg legyen minden nyelv. Csak érvényes JSON-t adj vissza, semmi egyéb szöveget:
{"descriptionEn": "angol szöveg", "descriptionRo": "román szöveg", "descriptionDe": "német szöveg"}

Magyar leírás:
${text}`

  const systemContent = isNames
    ? 'You are a professional translator for e-commerce product names. Return only valid JSON with keys nameEn, nameRo, nameDe. Short product title only, no explanation, no markdown.'
    : 'You are a professional translator for e-commerce. Return only valid JSON with keys descriptionEn, descriptionRo, descriptionDe. No markdown, no explanation.'

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        max_tokens: isNames ? 200 : 1000,
        temperature: isNames ? 0.3 : 0.4,
      }),
    })

    const data = await res.json().catch(() => ({}))
    const rawText = data?.choices?.[0]?.message?.content?.trim()
    if (!res.ok || !rawText) {
      const errMsg = data?.error?.message || res.statusText || 'OpenAI hiba'
      return NextResponse.json(
        { error: `Fordítás sikertelen: ${errMsg}` },
        { status: 502 }
      )
    }

    const cleaned = rawText.replace(/^```\w*\n?|\n?```$/g, '').trim()
    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'A fordítás válasza nem értelmezhető. Próbáld újra.' },
        { status: 502 }
      )
    }

    if (isNames) {
      return NextResponse.json({
        nameEn: (parsed.nameEn ?? parsed.name_en ?? '').trim(),
        nameDe: (parsed.nameDe ?? parsed.name_de ?? '').trim(),
        nameRo: (parsed.nameRo ?? parsed.name_ro ?? '').trim(),
      })
    }
    return NextResponse.json({
      descriptionEn: (parsed.descriptionEn ?? parsed.description_en ?? '').trim(),
      descriptionDe: (parsed.descriptionDe ?? parsed.description_de ?? '').trim(),
      descriptionRo: (parsed.descriptionRo ?? parsed.description_ro ?? '').trim(),
    })
  } catch (err) {
    console.error('[translate-draft]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fordítási hiba' },
      { status: 500 }
    )
  }
}
