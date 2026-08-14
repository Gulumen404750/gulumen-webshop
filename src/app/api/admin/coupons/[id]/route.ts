import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { z } from 'zod'

const discountTypeSchema = z.enum(['percent', 'fixed'])

function validateDiscountValue(
  data: { discountType?: 'percent' | 'fixed'; discountValue?: number },
  ctx: z.RefinementCtx
) {
  if (data.discountType === undefined || data.discountValue === undefined) return
  if (data.discountType === 'percent') {
    if (data.discountValue < 1 || data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percent discount must be between 1 and 100',
        path: ['discountValue'],
      })
    }
  } else if (data.discountValue < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Fixed discount must be at least 1 HUF',
      path: ['discountValue'],
    })
  }
}

function validateDateRange(
  data: { validFrom?: string | null; validUntil?: string | null },
  ctx: z.RefinementCtx
) {
  if (data.validFrom && data.validUntil && new Date(data.validUntil) <= new Date(data.validFrom)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validUntil must be after validFrom',
      path: ['validUntil'],
    })
  }
}

const updateCouponSchema = z
  .object({
    code: z.string().min(1).transform((s) => s.trim().toUpperCase()).optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.number().int().optional(),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    minOrderHuf: z.number().int().min(0).optional().nullable(),
    maxUses: z.number().int().min(1).optional().nullable(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    validateDiscountValue(data, ctx)
    validateDateRange(data, ctx)
  })

/**
 * PATCH /api/admin/coupons/[id] – kupon szerkesztése
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermission('coupons:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  if (d.code) {
    const existing = await prisma.coupon.findFirst({ where: { code: d.code, NOT: { id } } })
    if (existing) {
      await logAdminAction({
        action: 'coupon_update',
        success: false,
        request,
        details: { id, reason: 'duplicate_code' },
      })
      return NextResponse.json({ error: 'Coupon code already in use' }, { status: 409 })
    }
  }

  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(d.code !== undefined && { code: d.code }),
        ...(d.discountType !== undefined && { discountType: d.discountType }),
        ...(d.discountValue !== undefined && { discountValue: d.discountValue }),
        ...(d.validFrom !== undefined && { validFrom: d.validFrom ? new Date(d.validFrom) : null }),
        ...(d.validUntil !== undefined && { validUntil: d.validUntil ? new Date(d.validUntil) : null }),
        ...(d.minOrderHuf !== undefined && { minOrderHuf: d.minOrderHuf }),
        ...(d.maxUses !== undefined && { maxUses: d.maxUses }),
        ...(d.active !== undefined && { active: d.active }),
      },
    })
    await logAdminAction({
      action: 'coupon_update',
      success: true,
      request,
      details: { id: coupon.id, code: coupon.code, fields: Object.keys(d) },
    })
    return NextResponse.json({ coupon })
  } catch {
    await logAdminAction({
      action: 'coupon_update',
      success: false,
      request,
      details: { id, reason: 'not_found' },
    })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

/**
 * DELETE /api/admin/coupons/[id] – soft delete (active=false)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermission('coupons:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params

  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: { active: false },
    })
    await logAdminAction({
      action: 'coupon_delete',
      success: true,
      request,
      details: { id: coupon.id, code: coupon.code },
    })
    return NextResponse.json({ coupon })
  } catch {
    await logAdminAction({
      action: 'coupon_delete',
      success: false,
      request,
      details: { id, reason: 'not_found' },
    })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
