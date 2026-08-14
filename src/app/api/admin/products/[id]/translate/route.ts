/**
 * POST /api/admin/products/[id]/translate
 * AI fordítás: magyar leírás → angol, román, német.
 * Body: { overwriteExisting?: boolean } – ha false, csak az üres mezőket tölti ki.
 */
import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('products:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY nincs beállítva. Az AI fordítás nem érhető el.' },
      { status: 503 }
    )
  }

  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: 'Termék nem található' }, { status: 404 })

  const descriptionHu = (product.description_hu ?? '').trim()
  if (!descriptionHu) {
    return NextResponse.json(
      { error: 'A magyar leírás (Leírás HU) üres. Töltsd ki előbb, majd kattints az AI fordításra.' },
      { status: 400 }
    )
  }

  let overwriteExisting = false
  try {
    const body = await request.json().catch(() => ({}))
    overwriteExisting = Boolean(body?.overwriteExisting)
  } catch {
    // keep false
  }

  const toFill = {
    description_en: overwriteExisting || !(product.description_en ?? '').trim(),
    description_de: overwriteExisting || !(product.description_de ?? '').trim(),
    description_ro: overwriteExisting || !(product.description_ro ?? '').trim(),
  }
  if (!toFill.description_en && !toFill.description_de && !toFill.description_ro) {
    return NextResponse.json(
      { error: 'Minden idegen nyelvi mező már ki van töltve. Ha felülírást szeretnél, küldd: { "overwriteExisting": true }' },
      { status: 400 }
    )
  }

  const prompt = `A következő magyar webshop termékleírást fordítsd le természetes, folyékony angolra, románra és németre. Ne szó szerinti, hanem webshopra illő, olvasható szöveg legyen minden nyelv. Csak érvényes JSON-t adj vissza, semmi egyéb szöveget, a következő formátumban:
{"descriptionEn": "angol szöveg", "descriptionRo": "román szöveg", "descriptionDe": "német szöveg"}

Magyar leírás:
${descriptionHu}`

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
          {
            role: 'system',
            content: 'You are a professional translator for e-commerce. Return only valid JSON with keys descriptionEn, descriptionRo, descriptionDe. No markdown, no explanation.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.4,
      }),
    })

    const data = await res.json().catch(() => ({}))
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!res.ok || !text) {
      const errMsg = data?.error?.message || res.statusText || 'OpenAI hiba'
      return NextResponse.json(
        { error: `Fordítás sikertelen: ${errMsg}` },
        { status: 502 }
      )
    }

    let parsed: { descriptionEn?: string; descriptionRo?: string; descriptionDe?: string }
    try {
      const cleaned = text.replace(/^```\w*\n?|\n?```$/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'A válasz nem értelmezhető JSON-ként. Próbáld újra.' },
        { status: 502 }
      )
    }

    const updateData: {
      description_en?: string
      description_de?: string
      description_ro?: string
    } = {}
    if (toFill.description_en && parsed.descriptionEn)
      updateData.description_en = parsed.descriptionEn.trim()
    if (toFill.description_de && parsed.descriptionDe)
      updateData.description_de = parsed.descriptionDe.trim()
    if (toFill.description_ro && parsed.descriptionRo)
      updateData.description_ro = parsed.descriptionRo.trim()

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ product, message: 'Nincs frissítendő mező.' })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      product: updated,
      message: 'Fordítás mentve.',
      translated: Object.keys(updateData),
    })
  } catch (err) {
    console.error('[translate]', err)
    return NextResponse.json(
      { error: 'Fordítási hiba' },
      { status: 500 }
    )
  }
}
