import { NextResponse } from 'next/server'
import { getAllProductsFromDb } from '@/lib/products'

/**
 * GET /api/products
 * Nyilvános: összes aktív storefront termék (DB konfigurált: getAllProductsFromDb, egyébként []).
 */
export async function GET() {
  try {
    const products = await getAllProductsFromDb()
    return NextResponse.json(products)
  } catch (e) {
    console.error('[api/products] GET', e)
    return NextResponse.json([])
  }
}
