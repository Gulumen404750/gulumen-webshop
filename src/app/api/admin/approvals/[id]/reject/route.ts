import { NextResponse } from 'next/server'
import { requireOwner } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { markApprovalResolved } from '@/lib/admin-approval'
import { logAdminAction } from '@/lib/admin-audit'

/**
 * POST /api/admin/approvals/[id]/reject
 * Owner elutasítás — törlés nem fut.
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
    status: 'REJECTED',
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

  await logAdminAction({
    action: 'bulk_delete_rejected',
    success: true,
    request,
    actor: gate.actor,
    details: {
      approvalId: id,
      resource: resolved.payload.resource,
      count: resolved.payload.ids.length,
    },
  })
  return NextResponse.json({
    ok: true,
    status: 'REJECTED',
    approval: resolved.approval,
  })
}
