import { NextResponse } from 'next/server'
import { prisma, isDbConfigured } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireAdminPermission } from '@/lib/admin-auth'
import { slugifyProduct } from '@/lib/slug'
import {
  sanitizeColorImages,
  sanitizeProductImagePatch,
} from '@/lib/product-images'
import { revalidateShopProducts } from '@/lib/revalidate-shop'
import { logAdminAction } from '@/lib/admin-audit'
import { alertBulkDeleteIfAnomalousSafe } from '@/lib/admin-anomaly-alert'
import { z } from 'zod'

async function uniqueProductSlug(base: string, excludeId: string): Promise<string> {
  const root = slugifyProduct(base)
  let candidate = root
  let n = 2
  while (
    await prisma.product.findFirst({
      where: { slug: candidate, NOT: { id: excludeId } },
      select: { id: true },
    })
  ) {
    candidate = `${root}-${n}`
    n += 1
  }
  return candidate
}

const updateProductSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  nameDe: z.string().optional(),
  nameRo: z.string().optional(),
  description_hu: z.string().optional(),
  description_en: z.string().optional(),
  description_de: z.string().optional(),
  description_ro: z.string().optional(),
  aiKnowledgeBase: z.string().max(20000).optional().nullable(),
  condition: z.string().optional(),
  category: z.string().min(1).optional(),
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
          isBase: z.boolean().optional(),
        })
      ),
    ])
    .optional()
    .nullable(),
  modelUrl: z.string().optional().nullable(),
  priceHuf: z.number().int().min(0).optional(),
  priceEur: z.number().int().min(0).optional(),
  discountPriceHuf: z.number().int().min(0).optional().nullable(),
  discountPriceEur: z.number().int().min(0).optional().nullable(),
  /** -1 = végtelen készlet; 0 = elfogyott; >0 = darabszám */
  stock: z.number().int().min(-1).optional(),
  variants: z.unknown().optional().nullable(),
  isNew: z.boolean().optional(),
  onSale: z.boolean().optional(),
  saleStartAt: z.string().datetime().optional().nullable(),
  saleEndAt: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
  isColorable: z.boolean().optional(),
  type: z.enum(['stock', 'sourcing_deal']).optional(),
  sourcingEnabled: z.boolean().optional(),
  dealStartAt: z.string().datetime().optional().nullable(),
  dealEndAt: z.string().datetime().optional().nullable(),
  previewFrom: z.string().datetime().optional().nullable(),
  maxOrders: z.number().int().min(0).optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('products:read')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ product })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('products:write')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  let nextSlug: string | undefined
  if (d.slug !== undefined) {
    // Csak ha nem URL-safe (ékezet, szóköz, nagybetű): átírjuk. Meglévő tiszta slugot nem bántjuk.
    const safe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug)
    nextSlug = safe ? d.slug : await uniqueProductSlug(d.slug, id)
  }

  const imagePatch = sanitizeProductImagePatch({
    image: d.image,
    images: d.images,
    images360: d.images360,
  })

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(nextSlug !== undefined && { slug: nextSlug }),
      ...(d.name !== undefined && { name: d.name }),
      ...(d.nameEn !== undefined && { nameEn: d.nameEn }),
      ...(d.nameDe !== undefined && { nameDe: d.nameDe }),
      ...(d.nameRo !== undefined && { nameRo: d.nameRo }),
      ...(d.description_hu !== undefined && { description_hu: d.description_hu }),
      ...(d.description_en !== undefined && { description_en: d.description_en }),
      ...(d.description_de !== undefined && { description_de: d.description_de }),
      ...(d.description_ro !== undefined && { description_ro: d.description_ro }),
      ...(d.aiKnowledgeBase !== undefined && {
        aiKnowledgeBase: d.aiKnowledgeBase?.trim() ? d.aiKnowledgeBase.trim() : null,
      }),
      ...(d.condition !== undefined && { condition: d.condition }),
      ...(d.category !== undefined && { category: d.category }),
      ...(imagePatch.image !== undefined && { image: imagePatch.image }),
      ...(imagePatch.images !== undefined && { images: imagePatch.images }),
      ...(imagePatch.images360 !== undefined && { images360: imagePatch.images360 }),
      ...(d.colorImages !== undefined && {
        colorImages:
          d.colorImages === null
            ? Prisma.JsonNull
            : (sanitizeColorImages(d.colorImages) as Prisma.InputJsonValue),
      }),
      ...(d.modelUrl !== undefined && { modelUrl: d.modelUrl }),
      ...(d.priceHuf !== undefined && { priceHuf: d.priceHuf }),
      ...(d.priceEur !== undefined && { priceEur: d.priceEur }),
      ...(d.discountPriceHuf !== undefined && { discountPriceHuf: d.discountPriceHuf }),
      ...(d.discountPriceEur !== undefined && { discountPriceEur: d.discountPriceEur }),
      ...(d.stock !== undefined && { stock: d.stock }),
      ...(d.variants !== undefined && { variants: d.variants === null ? Prisma.JsonNull : d.variants }),
      ...(d.isNew !== undefined && { isNew: d.isNew }),
      ...(d.onSale !== undefined && { onSale: d.onSale }),
      ...(d.saleStartAt !== undefined && { saleStartAt: d.saleStartAt ? new Date(d.saleStartAt) : null }),
      ...(d.saleEndAt !== undefined && { saleEndAt: d.saleEndAt ? new Date(d.saleEndAt) : null }),
      ...(d.active !== undefined && { active: d.active }),
      ...(d.archived !== undefined && { archived: d.archived }),
      ...(d.isColorable !== undefined && { isColorable: d.isColorable }),
      ...(d.type !== undefined && { type: d.type }),
      ...(d.sourcingEnabled !== undefined && { sourcingEnabled: d.sourcingEnabled }),
      ...(d.dealStartAt !== undefined && { dealStartAt: d.dealStartAt ? new Date(d.dealStartAt) : null }),
      ...(d.dealEndAt !== undefined && { dealEndAt: d.dealEndAt ? new Date(d.dealEndAt) : null }),
      ...(d.previewFrom !== undefined && { previewFrom: d.previewFrom ? new Date(d.previewFrom) : null }),
      ...(d.maxOrders !== undefined && { maxOrders: d.maxOrders }),
      ...(d.sortOrder !== undefined && { sortOrder: d.sortOrder }),
    },
  })

  revalidateShopProducts(product.slug)
  await logAdminAction({
    action: 'product_update',
    success: true,
    request,
    details: { id: product.id, slug: product.slug, fields: Object.keys(d) },
  })
  return NextResponse.json({ product })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdminPermission('products:delete')
  if (!gate.ok) return gate.response
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const { id } = await params
  const existing = await prisma.product.findUnique({ where: { id }, select: { slug: true } })
  if (!existing) {
    await logAdminAction({
      action: 'product_delete',
      success: false,
      request,
      details: { id, reason: 'not_found' },
    })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await prisma.product.delete({ where: { id } })
  revalidateShopProducts(existing.slug)
  await logAdminAction({
    action: 'product_delete',
    success: true,
    request,
    details: { id, slug: existing.slug },
  })
  await alertBulkDeleteIfAnomalousSafe(request)
  return NextResponse.json({ ok: true })
}
