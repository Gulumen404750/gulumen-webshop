import { NextResponse } from 'next/server'
import { requireAdminPermission, requireOwner } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { listPendingApprovals } from '@/lib/admin-approval'

/**
 * GET /api/admin/approvals
 * Owner: pending bulk-delete (és hasonló) kérelmek a dashboard alerhez.
 * Non-owner: üres lista (ne szivárogjon).
 */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const ownerGate = await requireOwner()
  if (!ownerGate.ok) {
    // Bejelentkezett non-owner: ne 403-zzon a poll — üres lista.
    const any = await requireAdminPermission('dashboard:read')
    if (!any.ok) return any.response
    return NextResponse.json({ approvals: [], pendingCount: 0 })
  }

  const approvals = await listPendingApprovals()
  return NextResponse.json({
    approvals,
    pendingCount: approvals.length,
  })
}
