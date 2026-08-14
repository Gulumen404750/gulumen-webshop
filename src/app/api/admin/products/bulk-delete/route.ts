import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isOwnerActor, requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import {
  createBulkDeleteApproval,
  needsBulkDeleteApproval,
  BULK_DELETE_APPROVAL_THRESHOLD,
} from '@/lib/admin-approval'
import { executeBulkDelete } from '@/lib/admin-bulk-delete'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(500),
})

/**
 * POST /api/admin/products/bulk-delete
 * Body: { productIds: string[] }
 * Non-owner + >10 id → PENDING_APPROVAL (5 perc owner ablak); owner / ≤10 → azonnali törlés.
 */
export async function POST(request: Request) {
  const gate = await requireAdminPermission('products:delete')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
  }

  const ids = [...new Set(parsed.data.productIds)]
  if (needsBulkDeleteApproval(gate.actor, ids.length)) {
    const approval = await createBulkDeleteApproval({
      actor: gate.actor,
      resource: 'products',
      ids,
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
        message: `Több mint ${BULK_DELETE_APPROVAL_THRESHOLD} termék törlése owner jóváhagyást igényel (5 perc).`,
      },
      { status: 202 }
    )
  }

  const result = await executeBulkDelete({
    resource: 'products',
    ids,
    actor: gate.actor,
    request,
  })
  await logAdminAction({
    action: 'product_bulk_delete_immediate',
    success: true,
    request,
    actor: gate.actor,
    details: {
      ...result,
      ownerBypass: isOwnerActor(gate.actor),
      count: ids.length,
    },
  })
  return NextResponse.json({ ok: true, status: 'DELETED', ...result })
}
