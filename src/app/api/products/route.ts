import { NextResponse } from 'next/server'
import { getAllProductsFromDb } from '@/lib/products'

/**
 * GET /api/products
 * Nyilvános: összes aktív storefront termék (DB konfigurált: getAllProductsFromDb, egyébként []).
 * Cache: rövid (10 s), hogy a készlet mindenhol naprakész legyen.
 */
export const revalidate = 10

export async function GET() {
  try {
    const products = await getAllProductsFromDb()
    const res = NextResponse.json(products)
    res.headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20')
    return res
  } catch (e) {
    console.error('[api/products] GET', e)
    return NextResponse.json([])
  }
}
