import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminPermission } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-audit'
import {
  MAX_GIFT_POINT_QUANTITY,
  addGiftPointCodesToBatch,
  buildGiftPointClaimUrl,
} from '@/lib/gamification/gift-point-codes'

const updateSchema = z
  .object({
    code: z.string().min(1).max(40).transform((s) => s.trim().toUpperCase()).optional(),
    active: z.boolean().optional(),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    extraQuantity: z.number().int().min(1).max(MAX_GIFT_POINT_QUANTITY).optional(),
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

function serializeCode(code: {
  id: string
  token: string
  active: boolean
  claimedAt: Date | null
  claimedByUser: { email: string } | null
}) {
  const claimUrl = buildGiftPointClaimUrl(code.token)
  return {
    id: code.id,
    token: code.token,
    active: code.active,
    claimedAt: code.claimedAt?.toISOString() ?? null,
    claimedByEmail: code.claimedByUser?.email ?? null,
    claimUrl,
    nfcUrl: claimUrl,
  }
}

/**
 * GET /api/admin/gift-points/[id]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const batch = await prisma.giftPointBatch.findUnique({
    where: { id },
    include: {
      codes: {
        orderBy: { createdAt: 'asc' },
        include: { claimedByUser: { select: { email: true } } },
      },
    },
  })
  if (!batch) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const usedCount = batch.codes.filter((c) => c.claimedAt).length
  return NextResponse.json({
    batch: {
      id: batch.id,
      code: batch.code,
      points: batch.points,
      quantity: batch.quantity,
      active: batch.active,
      validFrom: batch.validFrom?.toISOString() ?? null,
      validUntil: batch.validUntil?.toISOString() ?? null,
      createdAt: batch.createdAt.toISOString(),
      usedCount,
      unusedCount: batch.quantity - usedCount,
      codes: batch.codes.map(serializeCode),
    },
  })
}

/**
 * PATCH /api/admin/gift-points/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existing = await prisma.giftPointBatch.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const d = parsed.data
  try {
    let newTokens: string[] = []
    if (d.extraQuantity) {
      const added = await addGiftPointCodesToBatch(id, d.extraQuantity)
      newTokens = added.tokens
    }

    if (d.active === false) {
      await prisma.giftPointCode.updateMany({
        where: { batchId: id, claimedAt: null },
        data: { active: false },
      })
    } else if (d.active === true) {
      await prisma.giftPointCode.updateMany({
        where: { batchId: id, claimedAt: null },
        data: { active: true },
      })
    }

    const batch = await prisma.giftPointBatch.update({
      where: { id },
      data: {
        ...(d.code !== undefined && { code: d.code }),
        ...(d.active !== undefined && { active: d.active }),
        ...(d.validFrom !== undefined && { validFrom: d.validFrom ? new Date(d.validFrom) : null }),
        ...(d.validUntil !== undefined && {
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
        }),
      },
      include: {
        codes: {
          orderBy: { createdAt: 'asc' },
          include: { claimedByUser: { select: { email: true } } },
        },
      },
    })

    await logAdminAction({
      action: 'gift_point_batch_update',
      success: true,
      request,
      details: { id, fields: Object.keys(d), extraCodes: newTokens.length },
    })

    const usedCount = batch.codes.filter((c) => c.claimedAt).length
    return NextResponse.json({
      batch: {
        id: batch.id,
        code: batch.code,
        points: batch.points,
        quantity: batch.quantity,
        active: batch.active,
        validFrom: batch.validFrom?.toISOString() ?? null,
        validUntil: batch.validUntil?.toISOString() ?? null,
        createdAt: batch.createdAt.toISOString(),
        usedCount,
        unusedCount: batch.quantity - usedCount,
        codes: batch.codes.map(serializeCode),
        newTokens,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/**
 * DELETE /api/admin/gift-points/[id] – sorozat + fel nem használt kódok deaktiválása.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('coupons:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  try {
    const batch = await prisma.giftPointBatch.update({
      where: { id },
      data: { active: false },
    })
    await prisma.giftPointCode.updateMany({
      where: { batchId: id, claimedAt: null },
      data: { active: false },
    })
    await logAdminAction({
      action: 'gift_point_batch_delete',
      success: true,
      request,
      details: { id: batch.id, code: batch.code },
    })
    return NextResponse.json({ batch: { id: batch.id, active: false } })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
