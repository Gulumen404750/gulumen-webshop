import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { listAdminCartSnapshots, ABANDONED_CART_DAYS } from '@/lib/cart-snapshot'
import { isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/abandoned-carts?filter=abandoned|all&marketing=all|subscribed
 */
export async function GET(request: Request) {
  const gate = await requireAdminPermission('support:write')
  if (!gate.ok) return gate.response

  if (!isDbConfigured()) {
    return NextResponse.json({ carts: [], message: 'Database not configured' })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'abandoned'
  const marketing = searchParams.get('marketing') ?? 'all'
  const abandonedOnly = filter !== 'all'
  const marketingSubscribedOnly = marketing === 'subscribed'

  try {
    const carts = await listAdminCartSnapshots({
      abandonedOnly,
      marketingSubscribedOnly,
      limit: 300,
    })
    const abandonedCount = abandonedOnly
      ? carts.length
      : carts.filter((c) => c.isAbandoned).length

    return NextResponse.json({
      carts,
      abandonedDays: ABANDONED_CART_DAYS,
      total: carts.length,
      abandonedCount,
    })
  } catch (e) {
    console.error('[api/admin/abandoned-carts] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
