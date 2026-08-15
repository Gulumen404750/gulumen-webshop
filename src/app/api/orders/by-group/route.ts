import { NextResponse } from 'next/server'
import { getOrdersByGroupId } from '@/lib/orders'
import { getSession, resolveSessionUserId } from '@/lib/auth'
import { toPublicOrderViews } from '@/lib/order-public'

/**
 * GET /api/orders/by-group?order_group_id=grp_xxx
 * Új checkout flow: csoport alapján visszaadja a rendeléseket (1 vagy 2).
 * Nyilvánosan csak összefoglaló mezők; PII + shippingEditToken csak a bejelentkezett tulajdonosnak.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderGroupId = searchParams.get('order_group_id')
  if (!orderGroupId) {
    return NextResponse.json(
      { error: 'Missing order_group_id' },
      { status: 400 }
    )
  }

  const orders = await getOrdersByGroupId(orderGroupId)
  if (!orders.length) {
    return NextResponse.json([])
  }

  const session = await getSession(request)
  const sessionUserId = session ? await resolveSessionUserId(session) : null

  const views = toPublicOrderViews(orders, {
    isOwner: (order) => Boolean(sessionUserId && order.userId && order.userId === sessionUserId),
  })

  return NextResponse.json(views)
}
