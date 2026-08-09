import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { upsertUserCartSnapshot, clearUserCartSnapshot } from '@/lib/cart-snapshot'
import type { CartItem } from '@/lib/cart-storage'
import { isDbConfigured } from '@/lib/prisma'

const itemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1),
  options: z
    .object({
      colorName: z.string().optional(),
      colorHex: z.string().optional(),
      materialName: z.string().optional(),
    })
    .optional(),
  /** Megjelenítési snapshot – név / ár / kép (client fallback). */
  name: z.string().optional(),
  nameEn: z.string().optional(),
  nameDe: z.string().optional(),
  nameRo: z.string().optional(),
  priceHuf: z.number().int().min(0).optional(),
  image: z.string().optional(),
})

const putSchema = z.object({
  items: z.array(itemSchema),
})

/** PUT /api/me/cart – bejelentkezett user kosár szinkron. */
export async function PUT(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, synced: false })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const items = parsed.data.items as CartItem[]
  await upsertUserCartSnapshot(userId, items)
  return NextResponse.json({ ok: true, synced: true })
}

/** DELETE /api/me/cart – kosár pillanatkép törlése. */
export async function DELETE(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = await resolveSessionUserId(session)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isDbConfigured()) {
    await clearUserCartSnapshot(userId)
  }
  return NextResponse.json({ ok: true })
}
