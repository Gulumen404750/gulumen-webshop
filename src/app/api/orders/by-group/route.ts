import { NextResponse } from 'next/server'
import { getOrdersByGroupId } from '@/lib/orders'

/**
 * GET /api/orders/by-group?order_group_id=grp_xxx
 * Új checkout flow: csoport alapján visszaadja a rendeléseket (1 vagy 2).
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

  const orders = getOrdersByGroupId(orderGroupId)
  return NextResponse.json(orders)
}
