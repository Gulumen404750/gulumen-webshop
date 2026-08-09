import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma, isDbConfigured } from '@/lib/prisma'

const bulkPriceSchema = z
  .object({
    productIds: z.array(z.string().min(1)).min(1).max(200),
    mode: z.enum(['fixed', 'percent']),
    priceHuf: z.number().int().min(0).optional(),
    percentChange: z.number().min(-99).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'fixed' && data.priceHuf === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'priceHuf is required for fixed mode',
        path: ['priceHuf'],
      })
    }
    if (data.mode === 'percent' && data.percentChange === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'percentChange is required for percent mode',
        path: ['percentChange'],
      })
    }
  })

function computeNewPrices(
  currentHuf: number,
  currentEur: number,
  mode: 'fixed' | 'percent',
  priceHuf?: number,
  percentChange?: number
): { priceHuf: number; priceEur: number } {
  let newHuf: number
  if (mode === 'fixed') {
    newHuf = priceHuf!
  } else {
    newHuf = Math.max(0, Math.round(currentHuf * (1 + percentChange! / 100)))
  }
  const ratio = currentHuf > 0 ? currentEur / currentHuf : 0
  const newEur = Math.max(0, Math.round(newHuf * ratio))
  return { priceHuf: newHuf, priceEur: newEur }
}

/**
 * PATCH /api/admin/products/bulk-price
 * Tömeges ármódosítás: fix ár vagy százalékos emelés/csökkentés.
 */
export async function PATCH(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bulkPriceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { productIds, mode, priceHuf, percentChange } = parsed.data

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, priceHuf: true, priceEur: true },
  })

  if (products.length === 0) {
    return NextResponse.json({ error: 'No matching products found' }, { status: 404 })
  }

  const foundIds = new Set(products.map((p) => p.id))
  const missingIds = productIds.filter((id) => !foundIds.has(id))

  await prisma.$transaction(
    products.map((product) => {
      const prices = computeNewPrices(
        product.priceHuf,
        product.priceEur,
        mode,
        priceHuf,
        percentChange
      )
      return prisma.product.update({
        where: { id: product.id },
        data: prices,
      })
    })
  )

  return NextResponse.json({
    updated: products.length,
    missingIds,
    mode,
  })
}
