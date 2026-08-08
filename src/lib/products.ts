/**
 * Termékek betöltése adatbázisból (storefront). mockProducts fallback csak
 * NODE_ENV=development + nincs DATABASE_URL esetén – lásd data.ts async API-k.
 */
import { prisma, isDbConfigured } from '@/lib/prisma'
import type { Product, Condition } from '@/lib/data'
import { normalizeColorImages } from '@/lib/filamentColors'
import { productSlugLookupCandidates } from '@/lib/slug'

function mapCondition(c: string): Condition {
  const allowed: Condition[] = ['Új', 'Új, címkés', 'Új kinézetű', 'Kiváló', 'Jó']
  return allowed.includes(c as Condition) ? (c as Condition) : 'Új'
}

function dbProductToProduct(row: {
  id: string
  slug: string
  name: string
  nameEn: string | null
  nameDe: string | null
  nameRo: string | null
  description_hu: string
  description_en: string
  description_de: string
  description_ro: string
  condition: string
  category: string
  image: string
  images: string[]
  images360: string[]
  colorImages?: unknown
  modelUrl: string | null
  priceHuf: number
  priceEur: number
  discountPriceHuf: number | null
  discountPriceEur: number | null
  stock: number
  variants: unknown
  isNew: boolean
  onSale: boolean
  active: boolean
  archived: boolean
  saleStartAt: Date | null
  saleEndAt: Date | null
  isColorable: boolean
  likesCount: number
  type: string
  sourcingEnabled: boolean
  dealStartAt: Date | null
  dealEndAt: Date | null
  previewFrom: Date | null
  maxOrders: number | null
  sourcingStatus: string | null
}): Product {
  const variants = row.variants as { size?: string; color?: string }[] | null
  const descEn = row.description_en || row.description_hu || row.description_de || row.description_ro
  const colorImages = normalizeColorImages(row.colorImages)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEn: row.nameEn ?? row.name,
    nameDe: row.nameDe ?? undefined,
    nameRo: row.nameRo ?? undefined,
    description: descEn,
    description_hu: row.description_hu || undefined,
    description_en: row.description_en || undefined,
    description_de: row.description_de || undefined,
    description_ro: row.description_ro || undefined,
    condition: mapCondition(row.condition),
    category: row.category,
    image: row.image,
    images: row.images?.length ? row.images : [row.image],
    images360: row.images360?.length ? row.images360 : undefined,
    colorImages: Object.keys(colorImages).length > 0 ? colorImages : undefined,
    modelUrl: row.modelUrl ?? undefined,
    priceHuf: row.priceHuf,
    priceEur: row.priceEur,
    discountPriceHuf: row.discountPriceHuf ?? undefined,
    discountPriceEur: row.discountPriceEur ?? undefined,
    stock: row.stock,
    variants: variants ?? undefined,
    isNew: row.isNew,
    onSale: row.onSale,
    active: row.active,
    archived: row.archived,
    saleStartAt: row.saleStartAt?.toISOString(),
    saleEndAt: row.saleEndAt?.toISOString(),
    type: row.type === 'sourcing_deal' ? 'sourcing_deal' : 'stock',
    previewFrom: row.previewFrom?.toISOString(),
    saleFrom: row.dealStartAt?.toISOString(),
    saleTo: row.dealEndAt?.toISOString(),
    maxOrders: row.maxOrders ?? undefined,
    likesCount: row.likesCount,
    isColorable: row.isColorable,
  }
}

/** Összes aktív termék (a vásárlói oldalhoz). */
export async function getAllProductsFromDb(): Promise<Product[]> {
  if (!isDbConfigured()) return []
  const rows = await prisma.product.findMany({
    where: { active: true, archived: false },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(dbProductToProduct)
}

/** Slug alapján egy termék. */
export async function getProductBySlugFromDb(slug: string): Promise<Product | null> {
  if (!isDbConfigured()) return null
  const candidates = productSlugLookupCandidates(slug)
  const row = await prisma.product.findFirst({
    where: { slug: { in: candidates }, active: true, archived: false },
  })
  return row ? dbProductToProduct(row) : null
}

/** ID alapján egy termék (aktív vagy inaktív is). */
export async function getProductByIdFromDb(id: string): Promise<Product | null> {
  if (!isDbConfigured()) return null
  const row = await prisma.product.findUnique({
    where: { id },
  })
  return row ? dbProductToProduct(row) : null
}

/** Több termék ID alapján – kedvencek listához, kedvelés sorrendben. */
export async function getProductsByIdsFromDb(ids: string[]): Promise<Product[]> {
  if (!isDbConfigured() || ids.length === 0) return []
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
  })
  const byId = new Map(rows.map((row) => [row.id, dbProductToProduct(row)]))
  return ids.map((id) => byId.get(id)).filter((p): p is Product => p != null)
}

/** Csak sourcing_deal típusú, aktív termékek (beszerzésre rendelhető oldalhoz). sortOrder szerint, majd dealEndAt. */
export async function getSourcingDealProductsFromDb(): Promise<Product[]> {
  if (!isDbConfigured()) return []
  const rows = await prisma.product.findMany({
    where: { active: true, archived: false, type: 'sourcing_deal', sourcingEnabled: true },
    orderBy: [{ sortOrder: { sort: 'asc', nulls: 'last' } }, { dealEndAt: 'asc' }],
  })
  return rows.map(dbProductToProduct)
}

/** Stock típusú termékek (nem sourcing), pl. shop grid. */
export async function getStockProductsFromDb(): Promise<Product[]> {
  if (!isDbConfigured()) return []
  const rows = await prisma.product.findMany({
    where: { active: true, archived: false, type: 'stock' },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(dbProductToProduct)
}

/** Hasonló termékek: ugyanaz a kategória, aktív, kizárva az aktuális. */
export async function getSimilarProductsFromDb(
  category: string,
  excludeProductId: string,
  limit = 4
): Promise<Product[]> {
  if (!isDbConfigured()) return []
  const rows = await prisma.product.findMany({
    where: {
      category,
      active: true,
      archived: false,
      id: { not: excludeProductId },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })
  return rows.map(dbProductToProduct)
}
