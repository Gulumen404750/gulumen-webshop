import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { markApprovalResolved } from '@/lib/admin-approval'
import { executeBulkDelete } from '@/lib/admin-bulk-delete'
import { executeBulkPriceFromPayload } from '@/lib/admin-bulk-price'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * POST /api/admin/approvals/[id]/approve
 * Owner jóváhagyás → törlés / tömeges módosítás végrehajtása (ha még PENDING és nem járt le).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireOwner()
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const { id } = await params
  const resolved = await markApprovalResolved({
    id,
    status: 'APPROVED',
    reviewer: gate.actor,
  })
  if (!resolved.ok) {
    const status =
      resolved.code === 'not_found' ? 404 : resolved.code === 'expired' ? 410 : 409
    return NextResponse.json(
      {
        error:
          resolved.code === 'expired'
            ? 'A kérelem lejárt (5 perc) — automatikusan elutasítva.'
            : resolved.code === 'not_found'
              ? 'Not found'
              : 'A kérelem már nincs függőben.',
        code: resolved.code,
      },
      { status }
    )
  }

  if (resolved.payload.kind === 'bulk_price') {
    const result = await executeBulkPriceFromPayload({
      payload: resolved.payload,
      actor: gate.actor,
      request,
    })
    await logAdminAction({
      action: 'bulk_price_approved',
      success: true,
      request,
      actor: gate.actor,
      details: {
        approvalId: id,
        resource: resolved.payload.resource,
        ...result,
      },
    })
    return NextResponse.json({
      ok: true,
      status: 'APPROVED',
      approval: resolved.approval,
      ...result,
    })
  }

  const result = await executeBulkDelete({
    resource: resolved.payload.resource,
    ids: resolved.payload.ids,
    actor: gate.actor,
    request,
  })
  await logAdminAction({
    action: 'bulk_delete_approved',
    success: true,
    request,
    actor: gate.actor,
    details: {
      approvalId: id,
      resource: resolved.payload.resource,
      ...result,
    },
  })
  return NextResponse.json({
    ok: true,
    status: 'APPROVED',
    approval: resolved.approval,
    ...result,
  })
}
