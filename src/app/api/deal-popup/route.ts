/**
 * GET /api/deal-popup
 * Nyilvános: popup be/ki, cím, leírás, és a megjelenítendő 3 termék (automatikus pótlással).
 */
import { NextResponse } from 'next/server'
import { getAllProductsAsync } from '@/lib/data'
import {
  getDealPopupConfigFromDb,
  getEligibleDealProducts,
  resolveDealPopupProducts,
  DEFAULT_CONFIG,
  type DealPopupConfig,
} from '@/lib/deal-popup'
import type { Product } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const allProducts = await getAllProductsAsync()
    const eligible = await getEligibleDealProducts(allProducts)
    const dbConfig = await getDealPopupConfigFromDb()

    const config: DealPopupConfig = dbConfig ?? {
      ...DEFAULT_CONFIG,
      productIds: [],
    }

    const products = resolveDealPopupProducts(config, eligible)

    return NextResponse.json({
      config: {
        enabled: config.enabled,
        title: config.title,
        description: config.description,
      },
      products: products as Product[],
    })
  } catch (e) {
    console.error('[api/deal-popup] GET', e)
    return NextResponse.json({
      config: { enabled: false, title: '', description: '' },
      products: [],
    })
  }
}
