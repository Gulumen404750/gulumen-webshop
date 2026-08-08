import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin-auth'
import { slugifyProduct } from '@/lib/slug'
import { z } from 'zod'

async function uniqueProductSlug(base: string): Promise<string> {
  const root = slugifyProduct(base)
  let candidate = root
  let n = 2
  while (await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${n}`
    n += 1
  }
  return candidate
}

/**
 * GET /api/admin/products
 * Query: search, category, active, type, lowStock. List products for admin.
 */
export async function GET(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const category = searchParams.get('category')?.trim() || ''
  const activeStr = searchParams.get('active')
  const status = searchParams.get('status')?.trim() || ''
  const type = searchParams.get('type')?.trim() || ''
  const lowStock =
    searchParams.get('lowStock') === '1' || searchParams.get('lowStock') === 'true'

  const where: Record<string, unknown> = {}
  if (lowStock) {
    where.stock = { lt: 3 }
    where.active = true
  } else if (status === 'active') {
    where.active = true
    where.archived = false
  } else if (status === 'inactive') {
    where.active = false
    where.archived = false
  } else if (status === 'archived') {
    where.archived = true
  } else if (activeStr === 'true') {
    where.active = true
  } else if (activeStr === 'false') {
    where.active = false
  }
  if (category) where.category = category
  if (type) where.type = type
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ products })
}

const createProductSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  nameDe: z.string().optional(),
  nameRo: z.string().optional(),
  description_hu: z.string().optional(),
  description_en: z.string().optional(),
  description_de: z.string().optional(),
  description_ro: z.string().optional(),
  condition: z.string().optional(),
  category: z.string().min(1),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  images360: z.array(z.string()).optional(),
  colorImages: z
    .union([
      z.record(z.string(), z.array(z.string())),
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          hex: z.string(),
          images: z.array(z.string()),
          nameEn: z.string().optional(),
          nameDe: z.string().optional(),
          nameRo: z.string().optional(),
        })
      ),
    ])
    .optional()
    .nullable(),
  modelUrl: z.string().optional(),
  priceHuf: z.number().int().min(0),
  priceEur: z.number().int().min(0),
  discountPriceHuf: z.number().int().min(0).optional(),
  discountPriceEur: z.number().int().min(0).optional(),
  /** -1 = végtelen készlet; 0 = elfogyott; >0 = darabszám */
  stock: z.number().int().min(-1).optional(),
  variants: z.unknown().optional(),
  isNew: z.boolean().optional(),
  onSale: z.boolean().optional(),
  saleStartAt: z.string().datetime().optional().nullable(),
  saleEndAt: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  isColorable: z.boolean().optional(),
  type: z.enum(['stock', 'sourcing_deal']).optional(),
  sourcingEnabled: z.boolean().optional(),
  dealStartAt: z.string().datetime().optional(),
  dealEndAt: z.string().datetime().optional(),
  previewFrom: z.string().datetime().optional(),
  maxOrders: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional().nullable(),
})

/**
 * POST /api/admin/products – új termék
 */
export async function POST(request: Request) {
  const ok = await requireAdmin()
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  const slug = await uniqueProductSlug(d.slug || d.name)

  const product = await prisma.product.create({
    data: {
      slug,
      name: d.name,
      nameEn: d.nameEn ?? null,
      nameDe: d.nameDe ?? null,
      nameRo: d.nameRo ?? null,
      description_hu: d.description_hu ?? '',
      description_en: d.description_en ?? '',
      description_de: d.description_de ?? '',
      description_ro: d.description_ro ?? '',
      condition: d.condition ?? 'Új',
      category: d.category,
      image: d.image ?? '',
      images: d.images ?? [],
      images360: d.images360 ?? [],
      colorImages:
        d.colorImages === null
          ? Prisma.JsonNull
          : d.colorImages !== undefined
            ? d.colorImages
            : undefined,
      modelUrl: d.modelUrl ?? null,
      priceHuf: d.priceHuf,
      priceEur: d.priceEur,
      discountPriceHuf: d.discountPriceHuf ?? null,
      discountPriceEur: d.discountPriceEur ?? null,
      stock: d.stock === undefined ? -1 : d.stock,
      variants: d.variants === null ? Prisma.JsonNull : (d.variants ?? undefined),
      isNew: d.isNew ?? false,
      onSale: d.onSale ?? false,
      saleStartAt: d.saleStartAt ? new Date(d.saleStartAt) : null,
      saleEndAt: d.saleEndAt ? new Date(d.saleEndAt) : null,
      active: d.active ?? true,
      archived: d.archived ?? false,
      isColorable: d.isColorable ?? false,
      type: d.type ?? 'stock',
      sourcingEnabled: d.sourcingEnabled ?? false,
      dealStartAt: d.dealStartAt ? new Date(d.dealStartAt) : null,
      dealEndAt: d.dealEndAt ? new Date(d.dealEndAt) : null,
      previewFrom: d.previewFrom ? new Date(d.previewFrom) : null,
      maxOrders: d.maxOrders ?? null,
      sortOrder: d.sortOrder ?? null,
    },
  })

  return NextResponse.json({ product })
}
