import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import { grantNfcGiftPoints } from '@/lib/gamification/gift-points'

const bodySchema = z.object({
  email: z.string().email(),
  points: z.number().int().positive().max(1_000_000),
  nfcTagId: z.string().trim().max(120).optional(),
})

/**
 * POST /api/admin/gamification/nfc-gift
 * NFC-n beolvasott ajándékpont jóváírása a felhasználó nevére (1 pont = 1 Ft, 1 hónap).
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('settings:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const result = await grantNfcGiftPoints({
      userId: user.id,
      points: parsed.data.points,
      nfcTagId: parsed.data.nfcTagId,
    })
    await logAdminAction({
      action: 'nfc_gift_grant',
      success: true,
      request,
      details: {
        userId: user.id,
        points: parsed.data.points,
        nfcTagId: parsed.data.nfcTagId ?? null,
        grantId: result.grantId,
      },
    })
    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      points: parsed.data.points,
      grantId: result.grantId,
      expiresAt: result.expiresAt.toISOString(),
      balanceAfter: result.balanceAfter,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'NFC gift grant failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
