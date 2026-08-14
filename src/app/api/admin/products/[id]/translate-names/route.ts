/**
 * POST /api/admin/products/[id]/translate-names
 * AI fordítás: magyar név (Név HU) → angol, román, német név.
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
  const auth = await requireAdminPermission('products:write')
  if (!auth.ok) return auth.response
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

  const nameHu = (product.name ?? '').trim()
  if (!nameHu) {
    return NextResponse.json(
      { error: 'A magyar név (Név HU) üres. Töltsd ki előbb, majd kattints az AI fordításra.' },
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
    nameEn: overwriteExisting || !(product.nameEn ?? '').trim(),
    nameDe: overwriteExisting || !(product.nameDe ?? '').trim(),
    nameRo: overwriteExisting || !(product.nameRo ?? '').trim(),
  }
  if (!toFill.nameEn && !toFill.nameDe && !toFill.nameRo) {
    return NextResponse.json(
      { error: 'Minden idegen nyelvi név mező már ki van töltve. Ha felülírást szeretnél, küldd: { "overwriteExisting": true }' },
      { status: 400 }
    )
  }

  const prompt = `A következő magyar webshop terméknevet fordítsd le természetes, folyékony angolra, románra és németre. Egy rövid terméknév (pl. 1-5 szó), ne szó szerinti, hanem webshopra illő. Csak érvényes JSON-t adj vissza, semmi egyéb szöveget, a következő formátumban:
{"nameEn": "angol név", "nameRo": "román név", "nameDe": "német név"}

Magyar név:
${nameHu}`

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
            content: 'You are a professional translator for e-commerce product names. Return only valid JSON with keys nameEn, nameRo, nameDe. Short product title only, no explanation, no markdown.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.3,
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

    let parsed: { nameEn?: string; nameRo?: string; nameDe?: string; name_en?: string; name_ro?: string; name_de?: string }
    try {
      const cleaned = text.replace(/^```\w*\n?|\n?```$/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: 'A válasz nem értelmezhető JSON-ként. Próbáld újra.' },
        { status: 502 }
      )
    }

    const nameEn = (parsed.nameEn ?? parsed.name_en ?? '').trim()
    const nameDe = (parsed.nameDe ?? parsed.name_de ?? '').trim()
    const nameRo = (parsed.nameRo ?? parsed.name_ro ?? '').trim()

    const updateData: { nameEn?: string; nameDe?: string; nameRo?: string } = {}
    if (toFill.nameEn && nameEn) updateData.nameEn = nameEn
    if (toFill.nameDe && nameDe) updateData.nameDe = nameDe
    if (toFill.nameRo && nameRo) updateData.nameRo = nameRo

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ product, message: 'Nincs frissítendő mező.' })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      product: updated,
      message: 'Névfordítások mentve.',
      translated: Object.keys(updateData),
    })
  } catch (err) {
    console.error('[translate-names]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fordítási hiba' },
      { status: 500 }
    )
  }
}
