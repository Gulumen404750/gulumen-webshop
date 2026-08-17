/**
 * Gyártási / AI adatcsomag: SKU + darabszám + egyedi paraméterek.
 * A 3D nyomtató farm és az automatizálás ezt olvassa.
 */

export type OrderItemParameters = {
  colorName?: string
  colorHex?: string
  materialName?: string
}

export type ProductionJobItem = {
  sku: string | null
  productId: string
  name: string | null
  qty: number
  parameters: OrderItemParameters | null
}

export type ProductionJobPayload = {
  type: 'production_job'
  orderId: string
  orderGroupId: string | null
  status: string
  paidAt: string | null
  items: ProductionJobItem[]
}

export function cartOptionsToParameters(options?: {
  colorName?: string
  colorHex?: string
  materialName?: string
} | null): OrderItemParameters | undefined {
  if (!options) return undefined
  const parameters: OrderItemParameters = {}
  const colorName = options.colorName?.trim()
  const colorHex = options.colorHex?.trim()
  const materialName = options.materialName?.trim()
  if (colorName) parameters.colorName = colorName
  if (colorHex) parameters.colorHex = colorHex
  if (materialName) parameters.materialName = materialName
  return Object.keys(parameters).length > 0 ? parameters : undefined
}

export function parseOrderItemParameters(raw: unknown): OrderItemParameters | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const parameters: OrderItemParameters = {}
  if (typeof o.colorName === 'string' && o.colorName.trim()) parameters.colorName = o.colorName.trim()
  if (typeof o.colorHex === 'string' && o.colorHex.trim()) parameters.colorHex = o.colorHex.trim()
  if (typeof o.materialName === 'string' && o.materialName.trim()) {
    parameters.materialName = o.materialName.trim()
  }
  return Object.keys(parameters).length > 0 ? parameters : null
}

export function buildProductionJobPayload(input: {
  orderId: string
  orderGroupId?: string | null
  status: string
  paidAt?: string | null
  items: Array<{
    sku?: string | null
    productId: string
    name?: string | null
    qty: number
    parameters?: unknown
  }>
}): ProductionJobPayload {
  return {
    type: 'production_job',
    orderId: input.orderId,
    orderGroupId: input.orderGroupId ?? null,
    status: input.status,
    paidAt: input.paidAt ?? null,
    items: input.items.map((item) => ({
      sku: item.sku?.trim() || null,
      productId: item.productId,
      name: item.name ?? null,
      qty: item.qty,
      parameters: parseOrderItemParameters(item.parameters),
    })),
  }
}
