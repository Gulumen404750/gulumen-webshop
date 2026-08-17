import { logger } from '@/lib/logger'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  buildProductionJobPayload,
  type ProductionJobPayload,
} from '@/lib/production-payload'

const PRODUCTION_WEBHOOK_TIMEOUT_MS = 8_000

export async function snapshotOrderItemSkusFromProducts(
  items: Array<{ productId: string; sku?: string | null }>
): Promise<Map<string, string>> {
  const skuByProductId = new Map<string, string>()
  if (!isDbConfigured()) return skuByProductId
  const missingIds = [
    ...new Set(
      items
        .filter((item) => !item.sku?.trim())
        .map((item) => item.productId)
        .filter(Boolean)
    ),
  ]
  if (missingIds.length === 0) return skuByProductId
  const products = await prisma.product.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, sku: true },
  })
  for (const product of products) {
    if (product.sku) skuByProductId.set(product.id, product.sku)
  }
  return skuByProductId
}

/**
 * Fizetés után: hiányzó tétel-SKU-k kitöltése a termék aktuális sku mezőjéből,
 * majd gyártási adatcsomag összeállítása (és opcionális webhook a farmnak).
 */
export async function dispatchProductionJobForPaidOrder(
  orderId: string
): Promise<ProductionJobPayload | null> {
  if (!isDbConfigured()) return null

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return null

  const skuByProductId = await snapshotOrderItemSkusFromProducts(order.items)
  const updates = order.items.filter((item) => !item.sku && skuByProductId.get(item.productId))
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: { sku: skuByProductId.get(item.productId) ?? null },
        })
      )
    )
  }

  const items = order.items.map((item) => ({
    sku: item.sku || skuByProductId.get(item.productId) || null,
    productId: item.productId,
    name: item.name,
    qty: item.qty,
    parameters: item.parameters,
  }))

  const payload = buildProductionJobPayload({
    orderId: order.id,
    orderGroupId: order.orderGroupId,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
    items,
  })

  logger.info(
    { orderId: payload.orderId, itemCount: payload.items.length, skus: payload.items.map((i) => i.sku) },
    'production job payload ready'
  )

  await postProductionWebhook(payload)
  return payload
}

async function postProductionWebhook(payload: ProductionJobPayload): Promise<void> {
  const url = process.env.PRODUCTION_WEBHOOK_URL?.trim()
  if (!url) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = process.env.PRODUCTION_WEBHOOK_SECRET?.trim()
  if (secret) headers['X-Webhook-Secret'] = secret

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PRODUCTION_WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      logger.error(
        { orderId: payload.orderId, status: res.status },
        'production webhook failed'
      )
    }
  } catch (err) {
    logger.error({ err, orderId: payload.orderId }, 'production webhook error')
  } finally {
    clearTimeout(timer)
  }
}
