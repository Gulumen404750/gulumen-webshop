/**
 * GET /api/admin/settings/deal-popup
 * Admin: popup konfig + az összes akciós (eligible) termék a kiválasztóhoz.
 */
import { NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin-auth'
import { isDbConfigured } from '@/lib/prisma'
import { getAllProductsAsync } from '@/lib/data'
import {
  getDealPopupConfigFromDb,
  getEligibleDealProducts,
  setDealPopupConfigInDb,
  DEFAULT_CONFIG,
  type DealPopupConfig,
} from '@/lib/deal-popup'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminPermission('settings:write')
  if (!auth.ok) return auth.response

  if (!isDbConfigured()) {
    const allProducts = await getAllProductsAsync()
    const eligibleProducts = await getEligibleDealProducts(allProducts)
    return NextResponse.json({
      config: { ...DEFAULT_CONFIG, productIds: [] },
      eligibleProducts,
      message: 'Adatbázis nincs konfigurálva; a popup az első 3 akciós terméket jeleníti meg. A beállítások mentése nem elérhető.',
    })
  }

  try {
    const [config, allProducts] = await Promise.all([
      getDealPopupConfigFromDb(),
      getAllProductsAsync(),
    ])
    const eligibleProducts = await getEligibleDealProducts(allProducts)

    return NextResponse.json({
      config: config ?? { ...DEFAULT_CONFIG, productIds: [] },
      eligibleProducts,
    })
  } catch (e) {
    console.error('[api/admin/settings/deal-popup] GET', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const configSchema = {
  enabled: (v: unknown) => typeof v === 'boolean',
  title: (v: unknown) => typeof v === 'string',
  description: (v: unknown) => typeof v === 'string',
  productIds: (v: unknown) => Array.isArray(v) && v.every((id) => typeof id === 'string'),
}

/** PATCH /api/admin/settings/deal-popup – popup beállítás mentése. */
export async function PATCH(request: Request) {
  const auth = await requireAdminPermission('settings:write')
  if (!auth.ok) return auth.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  if (!configSchema.enabled(o.enabled) || !configSchema.title(o.title) || !configSchema.description(o.description) || !configSchema.productIds(o.productIds)) {
    return NextResponse.json(
      { error: 'Body: enabled (boolean), title (string), description (string), productIds (string[]) required' },
      { status: 400 }
    )
  }

  const config: DealPopupConfig = {
    enabled: o.enabled as boolean,
    title: String(o.title).trim() || DEFAULT_CONFIG.title,
    description: String(o.description).trim() || DEFAULT_CONFIG.description,
    productIds: (o.productIds as string[]).slice(0, 3),
  }

  try {
    await setDealPopupConfigInDb(config)
    return NextResponse.json({ ok: true, config })
  } catch (e) {
    console.error('[api/admin/settings/deal-popup] PATCH', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
