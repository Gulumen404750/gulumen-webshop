import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  MAX_GIFT_POINT_QUANTITY,
  MAX_GIFT_POINT_VALUE,
  createGiftPointBatch,
  buildGiftPointClaimUrl,
} from '@/lib/gamification/gift-point-codes'

const createSchema = z
  .object({
    code: z.string().min(1).max(40).transform((s) => s.trim().toUpperCase()),
    points: z.number().int().min(1).max(MAX_GIFT_POINT_VALUE),
    quantity: z.number().int().min(1).max(MAX_GIFT_POINT_QUANTITY),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.validFrom && data.validUntil && new Date(data.validUntil) <= new Date(data.validFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validUntil must be after validFrom',
        path: ['validUntil'],
      })
    }
  })

/**
 * GET /api/admin/gift-points – ajándékpont-sorozatok.
 */
export async function GET() {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const batches = await prisma.giftPointBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      _count: {
        select: {
          codes: true,
        },
      },
      codes: {
        select: { claimedAt: true, active: true },
      },
    },
  })

  return NextResponse.json({
    batches: batches.map((b) => {
      const usedCount = b.codes.filter((c) => c.claimedAt).length
      return {
        id: b.id,
        code: b.code,
        points: b.points,
        quantity: b.quantity,
        active: b.active,
        validFrom: b.validFrom?.toISOString() ?? null,
        validUntil: b.validUntil?.toISOString() ?? null,
        createdAt: b.createdAt.toISOString(),
        usedCount,
        unusedCount: b.quantity - usedCount,
      }
    }),
  })
}

/**
 * POST /api/admin/gift-points – darabszámnyi egyedi kód + claim URL generálása.
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const created = await createGiftPointBatch({
      code: parsed.data.code,
      points: parsed.data.points,
      quantity: parsed.data.quantity,
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
    })
    await logAdminAction({
      action: 'gift_point_batch_create',
      success: true,
      request,
      details: {
        id: created.id,
        code: created.code,
        points: created.points,
        quantity: created.quantity,
      },
    })
    return NextResponse.json({
      batch: {
        id: created.id,
        code: created.code,
        points: created.points,
        quantity: created.quantity,
        codes: created.tokens.map((token) => ({
          id: token,
          token,
          active: true,
          claimedAt: null,
          claimedByEmail: null,
          claimUrl: buildGiftPointClaimUrl(token),
          nfcUrl: buildGiftPointClaimUrl(token),
        })),
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Create failed'
    await logAdminAction({
      action: 'gift_point_batch_create',
      success: false,
      request,
      details: { reason: message },
    })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
