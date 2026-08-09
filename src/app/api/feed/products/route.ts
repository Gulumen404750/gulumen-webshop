import { NextResponse } from 'next/server'
import { mockProducts } from '@/lib/data'
import { buildMerchantFeedXml } from '@/lib/merchant-feed'
import { getStockProductsFromDb } from '@/lib/products'
import { isDbConfigured } from '@/lib/prisma'

/** Google Merchant Center termékfeed – csak active stock termékek. */
export const revalidate = 3600

export async function GET() {
  try {
    const products = isDbConfigured()
      ? await getStockProductsFromDb()
      : mockProducts.filter((p) => p.type === 'stock' && p.active !== false)

    const xml = buildMerchantFeedXml(products)
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    })
  } catch (e) {
    console.error('[api/feed/products] GET', e)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel></channel></rss>',
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      }
    )
  }
}
