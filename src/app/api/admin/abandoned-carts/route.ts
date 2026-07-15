import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listAdminCartSnapshots, ABANDONED_CART_DAYS } from '@/lib/cart-snapshot'
import { isDbConfigured } from '@/lib/prisma'

/**
 * GET /api/admin/abandoned-carts?filter=abandoned|all
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isDbConfigured()) {
    return NextResponse.json({ carts: [], message: 'Database not configured' })
  }

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'abandoned'
  const abandonedOnly = filter !== 'all'

  try {
    const carts = await listAdminCartSnapshots({ abandonedOnly, limit: 300 })
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
