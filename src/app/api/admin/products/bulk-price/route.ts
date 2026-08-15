import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isOwnerActor, requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import {
  createBulkPriceApproval,
  needsBulkMutationApproval,
  BULK_DELETE_APPROVAL_THRESHOLD,
} from '@/lib/admin-approval'
import { executeBulkPrice } from '@/lib/admin-bulk-price'
import { logAdminAction } from '@/lib/admin-audit'

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

/**
 * PATCH /api/admin/products/bulk-price
 * Tömeges ármódosítás: fix ár vagy százalékos emelés/csökkentés.
 * Non-owner + >10 id → PENDING_APPROVAL (5 perc owner ablak); owner / ≤10 → azonnali.
 */
export async function PATCH(request: Request) {
  const gate = await requireAdminPermission('products:write')
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

  const parsed = bulkPriceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { productIds, mode, priceHuf, percentChange } = parsed.data
  const ids = [...new Set(productIds)]

  if (needsBulkMutationApproval(gate.actor, ids.length)) {
    const approval = await createBulkPriceApproval({
      actor: gate.actor,
      ids,
      mode,
      priceHuf,
      percentChange,
      request,
    })
    return NextResponse.json(
      {
        ok: false,
        status: 'PENDING_APPROVAL',
        approvalId: approval.id,
        expiresAt: approval.expiresAt,
        secondsRemaining: approval.secondsRemaining,
        count: ids.length,
        threshold: BULK_DELETE_APPROVAL_THRESHOLD,
        message: `Több mint ${BULK_DELETE_APPROVAL_THRESHOLD} termék ármódosítása owner jóváhagyást igényel (5 perc).`,
      },
      { status: 202 }
    )
  }

  const result = await executeBulkPrice({
    ids,
    mode,
    priceHuf,
    percentChange,
    actor: gate.actor,
    request,
  })

  if (result.updated === 0) {
    return NextResponse.json({ error: 'No matching products found' }, { status: 404 })
  }

  await logAdminAction({
    action: 'product_bulk_price_immediate',
    success: true,
    request,
    actor: gate.actor,
    details: {
      ...result,
      ownerBypass: isOwnerActor(gate.actor),
      count: ids.length,
    },
  })

  return NextResponse.json({
    ok: true,
    status: 'UPDATED',
    updated: result.updated,
    missingIds: result.missingIds,
    mode: result.mode,
  })
}
