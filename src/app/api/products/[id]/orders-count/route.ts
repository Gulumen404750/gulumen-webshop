import { NextResponse } from 'next/server'
import { getProductByIdAsync } from '@/lib/data'
import { getProductOrdersCount } from '@/lib/orders'

/**
 * GET /api/products/[id]/orders-count
 * Sourcing deal: valós ordersCount (DB aggregáció). Soldout / SourcingDeal state machine szerver oldalon.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
  if (!productId) {
    return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
  }
  const product = await getProductByIdAsync(productId)
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (product.type !== 'sourcing_deal') {
    return NextResponse.json({ ordersCount: 0, maxOrders: null })
  }
  const ordersCount = await getProductOrdersCount(productId)
  return NextResponse.json({
    ordersCount,
    maxOrders: product.maxOrders ?? null,
  })
}
