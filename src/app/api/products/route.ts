import { NextResponse } from 'next/server'
import { getAllProductsAsync } from '@/lib/data'
import { getProductOrdersCounts } from '@/lib/orders'

/**
 * GET /api/products
 * Nyilvános: összes aktív storefront termék (DB vagy mock fallback).
 */
export const revalidate = 10

export async function GET() {
  try {
    const products = await getAllProductsAsync()
    const sourcingIds = products.filter((p) => p.type === 'sourcing_deal').map((p) => p.id)
    if (sourcingIds.length > 0) {
      const counts = await getProductOrdersCounts(sourcingIds)
      for (const p of products) {
        if (p.type === 'sourcing_deal' && counts[p.id] != null) {
          (p as { ordersCount: number }).ordersCount = counts[p.id]
        }
      }
    }
    const res = NextResponse.json(products)
    res.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20')
    return res
  } catch (e) {
    console.error('[api/products] GET', e)
    return NextResponse.json([])
  }
}
