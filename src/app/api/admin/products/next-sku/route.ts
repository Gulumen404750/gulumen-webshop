import { NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/prisma'
import { requireAdminPermission } from '@/lib/admin-auth'
import { allocateNextProductSku } from '@/lib/product-sku-db'

/**
 * GET /api/admin/products/next-sku
 * Következő automatikus GUL-XXXXXXXXXX kód (admin generálás gombhoz).
 */
export async function GET() {
  const gate = await requireAdminPermission('products:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const sku = await allocateNextProductSku()
  return NextResponse.json({ sku })
}
