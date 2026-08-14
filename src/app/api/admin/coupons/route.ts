import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-audit'
import { z } from 'zod'

const discountTypeSchema = z.enum(['percent', 'fixed'])

function validateDiscountValue(
  data: { discountType: 'percent' | 'fixed'; discountValue: number },
  ctx: z.RefinementCtx
) {
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

const createCouponSchema = z
  .object({
    code: z.string().min(1).transform((s) => s.trim().toUpperCase()),
    discountType: discountTypeSchema,
    discountValue: z.number().int(),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    minOrderHuf: z.number().int().min(0).optional().nullable(),
    maxUses: z.number().int().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    validateDiscountValue(data, ctx)
    validateDateRange(data, ctx)
  })

/**
 * GET /api/admin/coupons
 * Query: active (true|false), source (gamification|admin|registration)
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const activeStr = searchParams.get('active')
  const source = searchParams.get('source')?.trim() || ''

  const where: Record<string, unknown> = {}
  if (activeStr === 'true') where.active = true
  else if (activeStr === 'false') where.active = false
  if (source) where.source = source

  const coupons = await prisma.coupon.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ coupons })
}

/**
 * POST /api/admin/coupons – új kupon (source=admin)
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const codeExists = await prisma.coupon.findUnique({ where: { code: d.code } })
  if (codeExists) {
    await logAdminAction({
      action: 'coupon_create',
      success: false,
      request,
      details: { code: d.code, reason: 'duplicate_code' },
    })
    return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
  }

  const coupon = await prisma.coupon.create({
    data: {
      code: d.code,
      discountType: d.discountType,
      discountValue: d.discountValue,
      active: true,
      validFrom: d.validFrom ? new Date(d.validFrom) : null,
      validUntil: d.validUntil ? new Date(d.validUntil) : null,
      minOrderHuf: d.minOrderHuf ?? null,
      maxUses: d.maxUses ?? null,
      source: 'admin',
    },
  })

  await logAdminAction({
    action: 'coupon_create',
    success: true,
    request,
    details: { id: coupon.id, code: coupon.code },
  })
  return NextResponse.json({ coupon })
}
