import { logger } from '@/lib/logger'
import { prisma, isDbConfigured } from '@/lib/prisma'
import {
  buildProductionJobPayload,
  parseOrderItemParameters,
  withGyartasiRecept,
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
  const itemUpdates = order.items.map((item) => {
    const sku = item.sku || skuByProductId.get(item.productId) || null
    const parsed = parseOrderItemParameters(item.parameters)
    const withRecept = withGyartasiRecept(order.id, {
      name: item.name,
      sku,
      qty: item.qty,
      parameters: parsed,
    })
    const needsSku = !item.sku && !!sku
    const needsRecept = !parsed?.recept && !!withRecept.parameters?.recept
    return {
      id: item.id,
      sku,
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      parameters: withRecept.parameters ?? parsed,
      persist: needsSku || needsRecept,
    }
  })

  const persist = itemUpdates.filter((item) => item.persist)
  if (persist.length > 0) {
    await prisma.$transaction(
      persist.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            sku: item.sku,
            parameters: item.parameters ?? undefined,
          },
        })
      )
    )
  }

  const payload = buildProductionJobPayload({
    orderId: order.id,
    orderGroupId: order.orderGroupId,
    status: order.status,
    paidAt: order.paidAt?.toISOString() ?? null,
    items: itemUpdates,
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
      body: JSON.stringify({
        rendeles_azonosito: payload.rendeles_azonosito,
        termekek: payload.termekek,
        receptek: payload.receptek,
        ...(payload.receptek.length === 1 ? { termek: payload.receptek[0]?.termek } : {}),
      }),
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
